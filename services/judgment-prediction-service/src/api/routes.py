import os
import json
from fastapi import APIRouter, BackgroundTasks, HTTPException
from src.scrapers.supreme_court import SupremeCourtScraper
from src.database.db_manager import DatabaseManager
from src.database.models import Job, JobStatus, Document, ActMetadata, JudgmentMetadata
from datetime import datetime
import traceback

import logging
import traceback

router = APIRouter()
logger = logging.getLogger(__name__)

from src.api.schemas import (
    DocumentResponse,
    PaginatedResponse,
    PredictionRequest,
    CaseNumberRequest,
    PredictionWithExplanationRequest,
    SearchRequest,
)
from typing import List

@router.get("/stats/supreme-court")
async def get_sc_stats():
    """
    Get sync statistics: Online total vs Local total.
    """
    db = DatabaseManager()
    online_count = 0
    local_count = 0
    last_synced = None

    # Get Local Count
    try:
        with db.session_scope() as session:
            local_count = session.query(Document).filter(
                Document.doc_type == "JUDGMENT",
                Document.court == "Supreme Court"
            ).count()
            
    # Get Last Synced Time (Last successful job)
            last_job = session.query(Job).filter(
                Job.job_type == "SCRAPE_SUPREME_COURT",
                Job.status == JobStatus.COMPLETED.value
            ).order_by(Job.completed_at.desc()).first()
            
            if last_job:
                last_synced = last_job.completed_at
    except Exception as e:
        logger.error(f"Error fetching local stats: {e}")

    # Get Online Count from last stats job? 
    # Actually, we rely on the FE polling the specific "CHECK_ONLINE_STATS" job for the live number.
    # But to persist it across refresh, we might want to store it?
    # For now, we return 0/-1, and the FE runs a check job to get the live number.
    online_count = -1 
    
    # Check if we have a recent completed STATS job
    try:
        with db.session_scope() as session:
            last_stats_job = session.query(Job).filter(
                Job.job_type == "CHECK_ONLINE_STATS",
                Job.status == JobStatus.COMPLETED.value
            ).order_by(Job.completed_at.desc()).first()
            if last_stats_job and last_stats_job.result:
                 # Result usually text "Online Count: 1234"
                 import re
                 match = re.search(r'Count: (\d+)', last_stats_job.result)
                 if match:
                     online_count = int(match.group(1))
    except:
        pass

    return {
        "online_total": online_count,
        "local_total": local_count,
        "missing": max(0, online_count - local_count) if online_count > 0 else 0,
        "last_synced_at": last_synced
    }

def run_stats_check_job(job_id: int):
    db = DatabaseManager()
    
    def log_message(msg):
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    job.logs = (job.logs or "") + f"{msg}\n"
                    session.add(job)
        except: pass

    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        scraper = SupremeCourtScraper(db)
        scraper.set_callbacks(log_message, None)
        
        count = scraper.get_online_count()
        
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.COMPLETED.value
                job.completed_at = datetime.utcnow()
                job.result = f"Online Count: {count}" # Parsable format
                session.add(job)
                
    except Exception as e:
        log_message(f"Error: {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.error = str(e)
                session.add(job)

@router.post("/stats/supreme-court/check")
async def check_sc_stats_job(background_tasks: BackgroundTasks):
    """Start a background job to check online stats with live steps."""
    db = DatabaseManager()
    with db.session_scope() as session:
        job = Job(job_type="CHECK_ONLINE_STATS", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id
    
    background_tasks.add_task(run_stats_check_job, job_id)
    return {"job_id": job_id, "status": "accepted"}

# --- Document Management APIs ---

@router.get("/documents/supreme-court", response_model=PaginatedResponse[DocumentResponse])
async def list_sc_documents(page: int = 1, limit: int = 50):
    """List Supreme Court documents with pagination"""
    try:
        db = DatabaseManager()
        with db.session_scope() as session:
            # Base query
            query = session.query(Document).filter(
                Document.doc_type == "JUDGMENT",
                Document.court == "Supreme Court"
            )
            
            # Total count
            total_count = query.count()
            
            # Pagination
            offset = (page - 1) * limit
            docs = query.order_by(Document.date_decided.desc()).offset(offset).limit(limit).all()
            
            # Serialization
            results = []
            for doc in docs:
                try:
                    results.append(DocumentResponse.model_validate(doc))
                except Exception as ve:
                    logger.error(f"Validation error for doc {doc.id}: {ve}")
                    continue 

            import math
            total_pages = math.ceil(total_count / limit) if limit > 0 else 1

            return {
                "items": results,
                "total": total_count,
                "page": page,
                "limit": limit,
                "total_pages": total_pages
            }
    except Exception as e:
        logger.error(f"Error listing docs: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/documents/supreme-court/{doc_id}")
async def delete_sc_document(doc_id: int):
    """Delete a single document and its file"""
    db = DatabaseManager()
    with db.session_scope() as session:
        doc = session.query(Document).get(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Delete file
        if doc.s3_key and os.path.exists(doc.s3_key):
            try:
                os.remove(doc.s3_key)
            except Exception as e:
                logger.error(f"Failed to delete file {doc.s3_key}: {e}")
        
        session.delete(doc)
        return {"message": f"Document {doc_id} deleted"}

@router.delete("/documents/supreme-court")
async def clear_sc_documents():
    """Delete ALL Supreme Court documents"""
    db = DatabaseManager()
    with db.session_scope() as session:
        docs = session.query(Document).filter(
            Document.doc_type == "JUDGMENT",
            Document.court == "Supreme Court"
        ).all()
        
        count = 0
        for doc in docs:
            if doc.s3_key and os.path.exists(doc.s3_key):
                try:
                    os.remove(doc.s3_key)
                except Exception as e:
                    logger.error(f"Failed to delete file {doc.s3_key}: {e}")
            session.delete(doc)
            count += 1
            
        return {"message": f"Cleared {count} Supreme Court documents"}

def run_supreme_court_scraper(max_pages: int):
    """
    Background task to run the scraper.
    """
    # Initialize DB Manager new session per task usually, 
    # but our manager handles session per operation which is safe.
    try:
        db = DatabaseManager()
        # Initialize Job
        with db.session_scope() as session:
             # Just query to make sure table exists/connection works
             pass
             
    except Exception as e:
        print(f"DB Init Error: {e}")

@router.get("/jobs")
async def list_jobs(limit: int = 20):
    """
    List recent background jobs.
    """
    db = DatabaseManager()
    with db.session_scope() as session:
        jobs = session.query(Job).order_by(Job.created_at.desc()).limit(limit).all()
        return jobs

@router.get("/jobs/{job_id}")
async def get_job(job_id: int):
    """
    Get status of a specific job.
    """
    db = DatabaseManager()
    with db.session_scope() as session:
        job = session.query(Job).get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "id": job.id,
            "job_type": job.job_type,
            "status": job.status,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "result": job.result,
            "result": job.result,
            "error": job.error,
            "logs": job.logs
        }

@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: int):
    """
    Request cancellation of a running job.
    """
    db = DatabaseManager()
    with db.session_scope() as session:
        job = session.query(Job).get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.status in [JobStatus.PENDING.value, JobStatus.RUNNING.value]:
            job.status = JobStatus.CANCEL_REQUESTED.value
            session.add(job)
            return {"message": "Cancellation requested"}
        else:
             return {"message": "Job already completed or failed", "status": job.status}

def run_supreme_court_scraper(job_id: int, max_pages: int):
    """
    Background task to run the scraper.
    """
    db = DatabaseManager()
    
    # Callback to check cancellation
    def check_cancel():
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job and job.status == JobStatus.CANCEL_REQUESTED.value:
                return True
        return False

    # Callback to log messages
    def log_message(msg):
        # We append to the existing log. 
        # CAUTION: Frequent DB writes. 
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    timestamp = datetime.utcnow().strftime("%H:%M:%S")
                    new_line = f"[{timestamp}] {msg}\n"
                    # If logs is None, start empty
                    current_logs = job.logs or ""
                    job.logs = current_logs + new_line
                    session.add(job)
        except Exception as e:
            print(f"Logging failed: {e}")

    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)
        
        scraper = SupremeCourtScraper(db)
        scraper.set_callbacks(log_message, check_cancel)

        logger.info(f"Background Task: Starting Supreme Court Scraper (max_pages={max_pages})")
        log_message(f"Starting Supreme Court Scraper (max_pages={max_pages})")
        
        scraper.scrape(max_pages=max_pages)
        
        # Check final status - did we cancel?
        final_status = JobStatus.COMPLETED.value
        if check_cancel(): 
             final_status = JobStatus.CANCELLED.value
             log_message("Scraper cancelled.")
        else:
             log_message("Scraper completed successfully.")
             logger.info("Background Task: Supreme Court Scraper completed.")

        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = final_status
                job.completed_at = datetime.utcnow()
                job.result = f"Scraping finished. Pages requested: {max_pages}"
                session.add(job)
                
    except Exception as e:
        logger.error(f"Background Task Error: {e}")
        log_message(f"Error: {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.completed_at = datetime.utcnow()
                job.error = str(e) + "\n" + traceback.format_exc()
                session.add(job)

@router.post("/sync/supreme-court")
async def sync_supreme_court(background_tasks: BackgroundTasks, max_pages: int = 1):
    """
    Trigger the Supreme Court scraper in the background.
    
    - **max_pages**: Number of paginated pages to scrape.
    """
    db = DatabaseManager()
    
    # Check for existing active job
    with db.session_scope() as session:
        # Check for any job that is not completed/failed/cancelled
        active_job = session.query(Job).filter(
            Job.job_type == "SCRAPE_SUPREME_COURT",
            Job.status.in_([
                JobStatus.PENDING.value, 
                JobStatus.RUNNING.value, 
                JobStatus.CANCEL_REQUESTED.value
            ])
        ).first()

        if active_job:
            logger.info(f"Duplicate trigger prevented. Returning existing job {active_job.id}")
            return {
                "status": "existing",
                "job_id": active_job.id,
                "message": f"Scraper is already running (Job {active_job.id}). Reconnected."
            }

        # No active job, create new one
        job = Job(job_type="SCRAPE_SUPREME_COURT", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_supreme_court_scraper, job_id, max_pages)
    return {
        "status": "accepted", 
        "job_id": job_id,
        "message": f"Supreme Court sync started with max_pages={max_pages}"
    }

# --- Court of Appeal ---
from src.scrapers.court_of_appeal import CourtOfAppealScraper

def run_ca_scraper(job_id: int, max_pages: int):
    db = DatabaseManager()

    def check_cancel():
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job and job.status == JobStatus.CANCEL_REQUESTED.value:
                return True
        return False

    def log_message(msg):
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    timestamp = datetime.utcnow().strftime("%H:%M:%S")
                    new_line = f"[{timestamp}] {msg}\n"
                    # If logs is None, start empty
                    current_logs = job.logs or ""
                    job.logs = current_logs + new_line
                    session.add(job)
        except Exception as e:
            print(f"Log Error: {e}")

    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        scraper = CourtOfAppealScraper(db)
        scraper.set_callbacks(log_message, check_cancel)

        logger.info(f"Background Task: Starting CA Scraper (max_pages={max_pages})")
        log_message(f"Background Task: Starting CA Scraper (max_pages={max_pages})")
        
        scraper.scrape(max_pages=max_pages)
        
        final_status = JobStatus.COMPLETED.value
        if check_cancel():
             final_status = JobStatus.CANCELLED.value
             log_message("Scraper cancelled.")
        else:
             logger.info("Background Task: CA Scraper completed.")
             log_message("CA Scraper completed.")
        
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = final_status
                job.completed_at = datetime.utcnow()
                job.result = f"CA Scraping finished. Pages: {max_pages}"
                session.add(job)

    except Exception as e:
        logger.error(f"Background Task Error: {e}")
        log_message(f"Error: {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.completed_at = datetime.utcnow()
                job.error = str(e) + "\n" + traceback.format_exc()
                session.add(job)

@router.post("/sync/appeal-court")
async def sync_court_of_appeal(background_tasks: BackgroundTasks, max_pages: int = 1):
    """
    Trigger the Court of Appeal scraper in the background.
    """
    db = DatabaseManager()
    
    # Check for existing active job
    with db.session_scope() as session:
        active_job = session.query(Job).filter(
            Job.job_type == "SCRAPE_COURT_OF_APPEAL",
            Job.status.in_([
                JobStatus.PENDING.value, 
                JobStatus.RUNNING.value, 
                JobStatus.CANCEL_REQUESTED.value
            ])
        ).first()

        if active_job:
            return {
                "status": "existing",
                "job_id": active_job.id,
                "message": f"Scraper is already running (Job {active_job.id}). Reconnected."
            }
            
    job_id = None
    with db.session_scope() as session:
        job = Job(job_type="SCRAPE_COURT_OF_APPEAL", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_ca_scraper, job_id, max_pages)
    return {
        "status": "accepted",
        "job_id": job_id,
        "message": f"CA sync started with max_pages={max_pages}"
    }

@router.get("/stats/appeal-court")
async def get_ca_stats():
    """
    Get sync statistics for Court of Appeal.
    """
    db = DatabaseManager()
    local_count = 0
    online_count = -1
    last_synced = None

    try:
        with db.session_scope() as session:
            local_count = session.query(Document).filter(
                Document.doc_type == "JUDGMENT",
                Document.court == "Court of Appeal"
            ).count()
            
            last_job = session.query(Job).filter(
                Job.job_type == "SCRAPE_COURT_OF_APPEAL",
                Job.status == JobStatus.COMPLETED.value
            ).order_by(Job.completed_at.desc()).first()
            
            if last_job:
                last_synced = last_job.completed_at
            
            # Get Check Job result (using new DEEP scan key to avoid legacy folder counts)
            last_stats_job = session.query(Job).filter(
                Job.job_type == "CHECK_ONLINE_STATS_CA_DEEP",
                Job.status == JobStatus.COMPLETED.value
            ).order_by(Job.completed_at.desc()).first()
            
            if last_stats_job and last_stats_job.result:
                 import re
                 match = re.search(r'Count: (\d+)', last_stats_job.result)
                 if match:
                     online_count = int(match.group(1))
    except Exception as e:
        logger.error(f"Error fetching CA stats: {e}")
    
    return {
        "online_total": online_count,
        "local_total": local_count,
        "missing": max(0, online_count - local_count) if online_count > 0 else 0,
        "last_synced_at": last_synced
    }

def run_ca_stats_check_job(job_id: int):
    db = DatabaseManager()
    
    def log_message(msg):
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    job.logs = (job.logs or "") + f"{msg}\n"
                    session.add(job)
        except: pass

    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        scraper = CourtOfAppealScraper(db)
        scraper.set_callbacks(log_message, None)
        
        count = scraper.get_online_count()
        
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.COMPLETED.value
                job.completed_at = datetime.utcnow()
                job.result = f"Online Count: {count}" # Parsable format
                session.add(job)
                
    except Exception as e:
        log_message(f"Error: {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.error = str(e)
                session.add(job)

@router.post("/stats/appeal-court/check")
async def check_ca_stats_job(background_tasks: BackgroundTasks):
    """Start a background job to check online stats (Archive Folder count)."""
    db = DatabaseManager()
    with db.session_scope() as session:
        job = Job(job_type="CHECK_ONLINE_STATS_CA_DEEP", status=JobStatus.PENDING.value, logs="Initializing Deep Scan...")
        session.add(job)
        session.flush()
        job_id = job.id
    
    background_tasks.add_task(run_ca_stats_check_job, job_id)
    return {"job_id": job_id, "status": "accepted"}

@router.post("/sync/acts")
async def sync_acts(
    background_tasks: BackgroundTasks, 
    max_years: int = 3
):
    """
    Trigger Acts Scraper.
    params:
      max_years: number of recent years to scrape (0 = all found years)
    """
    db = DatabaseManager()
    
    # Concurrency Check
    with db.session_scope() as session:
        existing_job = session.query(Job).filter(
            Job.job_type == "SCRAPE_ACTS",
            Job.status.in_([JobStatus.RUNNING.value, JobStatus.PENDING.value])
        ).first()
        if existing_job:
             return {"status": "error", "message": "Job already running", "job_id": existing_job.id}

    job_id = None
    with db.session_scope() as session:
        job = Job(job_type="SCRAPE_ACTS", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_acts_scraper, job_id, max_years)
    return {
        "status": "accepted", 
        "job_id": job_id, 
        "message": f"Acts sync started (max_years={max_years})"
    }

def run_acts_scraper(job_id: int, max_years: int):
    db = DatabaseManager()
    
    def log_message(msg):
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    job.logs = (job.logs or "") + f"{msg}\n"
                    session.add(job)
        except: pass

    def check_cancel():
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job and job.status == JobStatus.CANCEL_REQUESTED.value:
                    return True
        except: pass
        return False

    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        from src.scrapers.acts import ActsScraper
        scraper = ActsScraper(db)
        scraper.set_callbacks(log_message, check_cancel)
        
        # Determine years
        years = None
        if max_years > 0:
            avail = scraper.get_available_years()
            years = avail[:max_years]
        
        scraper.scrape(years_to_scrape=years)

        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job and job.status != JobStatus.FAILED.value:
                job.status = JobStatus.COMPLETED.value
                job.completed_at = datetime.utcnow()
                session.add(job)

    except Exception as e:
        log_message(f"Job Failed: {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.error = str(e)
                session.add(job)

# --- Acts Stats Endpoints ---

@router.get("/stats/acts")
async def get_acts_stats():
    db = DatabaseManager()
    local_count = 0
    online_count = -1
    last_synced = None

    try:
        with db.session_scope() as session:
            local_count = session.query(Document).filter(
                Document.doc_type == "ACT"
            ).count()
            
            last_job = session.query(Job).filter(
                Job.job_type == "SCRAPE_ACTS",
                Job.status == JobStatus.COMPLETED.value
            ).order_by(Job.completed_at.desc()).first()
            
            if last_job:
                last_synced = last_job.completed_at
            
            # Get Check Job result
            last_stats_job = session.query(Job).filter(
                Job.job_type == "CHECK_ONLINE_STATS_ACTS",
                Job.status == JobStatus.COMPLETED.value
            ).order_by(Job.completed_at.desc()).first()
            
            if last_stats_job and last_stats_job.result:
                 import re
                 match = re.search(r'Count: (\d+)', last_stats_job.result)
                 if match:
                     online_count = int(match.group(1))
    except Exception as e:
        logger.error(f"Error fetching Acts stats: {e}")
    
    return {
        "online_total": online_count,
        "local_total": local_count,
        "missing": max(0, online_count - local_count) if online_count > 0 else 0,
        "last_synced_at": last_synced
    }

def run_acts_stats_check_job(job_id: int):
    db = DatabaseManager()
    
    def log_message(msg):
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    job.logs = (job.logs or "") + f"{msg}\n"
                    session.add(job)
        except: pass

    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        from src.scrapers.acts import ActsScraper
        scraper = ActsScraper(db)
        scraper.set_callbacks(log_message, None)
        
        count = scraper.get_online_count()
        
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.COMPLETED.value
                job.completed_at = datetime.utcnow()
                job.result = f"Online Count: {count}" # Parsable format
                session.add(job)
                
    except Exception as e:
        log_message(f"Error: {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.error = str(e)
                session.add(job)

@router.post("/stats/acts/check")
async def check_acts_stats_job(background_tasks: BackgroundTasks):
    """Start a background job to check online stats (Deep Scan)."""
    db = DatabaseManager()
    with db.session_scope() as session:
        job = Job(job_type="CHECK_ONLINE_STATS_ACTS", status=JobStatus.PENDING.value, logs="Initializing Acts Deep Scan...")
        session.add(job)
        session.flush()
        job_id = job.id
    
    background_tasks.add_task(run_acts_stats_check_job, job_id)
    return {"job_id": job_id, "status": "accepted"}

@router.delete("/documents/acts/{doc_id}")
async def delete_act(doc_id: int):
    db = DatabaseManager()
    try:
        with db.session_scope() as session:
            doc = session.query(Document).get(doc_id)
            if not doc:
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Delete file if exists
            if doc.s3_key and os.path.exists(doc.s3_key):
                try:
                    os.remove(doc.s3_key)
                except OSError:
                    pass
            
            session.delete(doc)
        return {"message": f"Act {doc_id} deleted"}
    except Exception as e:
        logger.error(f"Error deleting act: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete act")

@router.delete("/documents/acts")
async def delete_all_acts():
    db = DatabaseManager()
    try:
        with db.session_scope() as session:
            # Get all act docs
            docs = session.query(Document).filter(Document.doc_type == "ACT").all()
            count = len(docs)
            for doc in docs:
                if doc.s3_key and os.path.exists(doc.s3_key):
                    try: os.remove(doc.s3_key)
                    except: pass
                session.delete(doc)
        return {"message": f"Deleted {count} acts"}
    except Exception as e:
        logger.error(f"Error clearing acts: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear acts")

@router.get("/documents/acts", response_model=PaginatedResponse[DocumentResponse])
async def list_acts(page: int = 1, limit: int = 50):
    db = DatabaseManager()
    offset = (page - 1) * limit
    try:
        with db.session_scope() as session:
            query = session.query(Document).filter(Document.doc_type == "ACT")
            
            total_count = query.count()
            import math
            total_pages = math.ceil(total_count / limit) if limit > 0 else 1
            
            docs = query.order_by(Document.year.desc()).offset(offset).limit(limit).all()
            
            valid_docs = []
            for doc in docs:
                try:
                    valid_docs.append(DocumentResponse.model_validate(doc))
                except Exception:
                    continue

            return PaginatedResponse(
                items=valid_docs,
                total=total_count,
                page=page,
                limit=limit,
                total_pages=total_pages
            )
    except Exception as e:
        logger.error(f"Error listing acts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents/appeal-court", response_model=PaginatedResponse[DocumentResponse])
async def list_ca_documents(page: int = 1, limit: int = 50):
    """
    List Court of Appeal judgments with pagination.
    """
    db = DatabaseManager()
    offset = (page - 1) * limit
    try:
        with db.session_scope() as session:
            query = session.query(Document).filter(
                Document.doc_type == "JUDGMENT",
                Document.court == "Court of Appeal"
            )
            
            total_count = query.count()
            import math
            total_pages = math.ceil(total_count / limit) if limit > 0 else 1
            
            docs = query.order_by(Document.date_decided.desc()).offset(offset).limit(limit).all()
            
            valid_docs = []
            for doc in docs:
                try:
                    valid_docs.append(DocumentResponse.model_validate(doc))
                except Exception:
                    continue

            return PaginatedResponse(
                items=valid_docs,
                total=total_count,
                page=page,
                limit=limit,
                total_pages=total_pages
            )
    except Exception as e:
        logger.error(f"Error listing CA documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/documents/appeal-court/{doc_id}")
async def delete_ca_document(doc_id: int):
    """Delete a Court of Appeal document."""
    db = DatabaseManager()
    with db.session_scope() as session:
        doc = session.query(Document).get(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        session.delete(doc)
    return {"message": "Document deleted"}

@router.delete("/documents/appeal-court")
async def delete_all_ca_documents():
    """Delete ALL Court of Appeal documents."""
    db = DatabaseManager()
    with db.session_scope() as session:
        count = session.query(Document).filter(
            Document.doc_type == "JUDGMENT",
            Document.court == "Court of Appeal"
        ).delete(synchronize_session=False)
        return {"message": f"Deleted {count} documents"}

# --- Acts ---
from src.scrapers.acts import ActsScraper

def run_acts_scraper(job_id: int, years: list, max_years: int = 0):
    db = DatabaseManager()
    
    def log_message(msg):
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    # Append new log line
                    job.logs = (job.logs or "") + f"{msg}\n"
                    session.add(job)
        except: pass

    def check_cancellation():
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job and job.status == JobStatus.CANCEL_REQUESTED.value:
                    return True
        except: pass
        return False

    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        scraper = ActsScraper(db)
        scraper.set_callbacks(log_message, check_cancellation)
        
        logger.info(f"Background Task: Starting Acts Scraper (years={years}, max_years={max_years})")
        scraper.scrape(years_to_scrape=years, max_years=max_years)
        logger.info("Background Task: Acts Scraper completed.")
        
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.COMPLETED.value
                job.completed_at = datetime.utcnow()
                job.result = f"Acts Scraping completed for years: {years}"
                session.add(job)

    except Exception as e:
        logger.error(f"Background Task Error: {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.completed_at = datetime.utcnow()
                job.error = str(e) + "\n" + traceback.format_exc()
                session.add(job)

@router.post("/sync/acts")
async def sync_acts(background_tasks: BackgroundTasks, years: str = None, max_years: int = 0):
    """
    Trigger the Acts scraper.
    
    - **years**: Optional comma-separated list of years (e.g., "2023,2024"). If empty, auto-detects latest.
    - **max_years**: limit recent years if auto-detecting. Set to 0 for all.
    """
    year_list = []
    if years:
        try:
            year_list = [int(y.strip()) for y in years.split(",")]
        except:
            raise HTTPException(status_code=400, detail="Invalid numbers in years parameter")
            
    db = DatabaseManager()
    job_id = None
    with db.session_scope() as session:
        job = Job(job_type="SCRAPE_ACTS", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_acts_scraper, job_id, year_list, max_years)
    return {
        "status": "accepted",
        "job_id": job_id,
        "message": f"Acts sync started (years={year_list if year_list else 'auto'}, max={max_years})"
    }

# --- Metadata Extraction ---
from src.processing.metadata import JudgmentMetadataExtractor
from src.database.models import Document, JudgmentMetadata

def run_metadata_extraction(job_id: int, limit: int = None):
    db = DatabaseManager()
    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)
        
        extractor = JudgmentMetadataExtractor()
        
        with db.session_scope() as session:
            # Query Judgments
            query = session.query(Document).filter(Document.doc_type == "JUDGMENT")
            if limit:
                query = query.limit(limit)
            
            docs = query.all()
            logger.info(f"Background Task: Starting Metadata Extraction for {len(docs)} docs...")
            
            count = 0
            for doc in docs:
                # Optimized: Skip if already exists (optional, maybe we want to re-run?)
                # For now, let's re-run or check. Checking is safer to avoid duplicates unless we handle updates.
                if doc.judgment_metadata:
                    continue
                
                if not doc.raw_text:
                    continue
                    
                meta_dict = extractor.extract(doc.raw_text)
                if meta_dict:
                    meta_obj = JudgmentMetadata(
                        document_id=doc.id,
                        presiding_judge=meta_dict.get("presiding_judge"),
                        other_judges=meta_dict.get("other_judges"),
                        counsel_petitioner=meta_dict.get("counsel_petitioner"),
                        counsel_respondent=meta_dict.get("counsel_respondent"),

                        keywords=meta_dict.get("keywords")
                    )
                    session.add(meta_obj)
                    count += 1
            
            logger.info(f"Background Task: Metadata Extraction complete. Processed {count} new records.")
            
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    job.status = JobStatus.COMPLETED.value
                    job.completed_at = datetime.utcnow()
                    job.result = f"Metadata Extraction complete. Processed {count} new records."
                    session.add(job)
            
    except Exception as e:
        logger.error(f"Background Task Error (Metadata): {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.completed_at = datetime.utcnow()
                job.error = str(e) + "\n" + traceback.format_exc()
                session.add(job)

@router.post("/metadata/extract")
async def extract_metadata(background_tasks: BackgroundTasks, limit: int = None):
    """
    Trigger metadata extraction for Judgments (Regex-based).
    - **limit**: Optional limit on number of documents to process.
    """
    db = DatabaseManager()
    job_id = None
    with db.session_scope() as session:
        job = Job(job_type="EXTRACT_METADATA", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_metadata_extraction, job_id, limit)
    return {
        "status": "accepted",
        "job_id": job_id,
        "message": "Metadata extraction started."
    }

# --- Acts Metadata ---
from src.processing.acts_metadata import ActMetadataExtractor
from src.database.models import ActMetadata

def run_acts_metadata_refinement(job_id: int):
    db = DatabaseManager()
    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        extractor = ActMetadataExtractor()
        
        with db.session_scope() as session:
            # Get all Acts
            acts = session.query(ActMetadata).all()
            logger.info(f"Background Task: Refining Metadata for {len(acts)} acts...")
            
            count = 0
            for act in acts:
                # Re-parse title
                if not act.act_name:
                    continue
                    
                meta_info = extractor.extract_from_title(act.act_name)
                
                # Update fields if changed (or just overwrite)
                act.is_amendment = meta_info['is_amendment']
                act.parent_act_key = meta_info['parent_act_key']
                count += 1
            
            logger.info(f"Background Task: Acts Metadata Refinement complete. Processed {count} records.")

            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    job.status = JobStatus.COMPLETED.value
                    job.completed_at = datetime.utcnow()
                    job.result = f"Acts Metadata Refinement complete. Processed {count} records."
                    session.add(job)

    except Exception as e:
        logger.error(f"Background Task Error (Acts Metadata): {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.completed_at = datetime.utcnow()
                job.error = str(e) + "\n" + traceback.format_exc()
                session.add(job)

@router.post("/metadata/extract-acts")
async def extract_acts_metadata(background_tasks: BackgroundTasks):
    """
    Trigger re-extraction/refinement of Acts metadata (from Titles).
    Useful after improving parsing logic.
    """
    db = DatabaseManager()
    job_id = None
    with db.session_scope() as session:
        job = Job(job_type="REFINE_ACTS_METADATA", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_acts_metadata_refinement, job_id)
    return {
        "status": "accepted",
        "job_id": job_id,
        "message": "Acts metadata refinement started."
    }

# --- OCR Pipeline ---
from src.processing.ocr import OCRService

def run_ocr_pipeline(job_id: int, limit: int = 10, target_id: int = None):
    db = DatabaseManager()
    
    def log_message(msg):
        """Helper to append log to Job record."""
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    job.logs = (job.logs or "") + f"[{timestamp}] {msg}\n"
                    session.add(job)
        except Exception:
            pass # Avoid breaking the loop on log failure

    def check_cancel():
        """Helper to check if cancellation was requested."""
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job and job.status == JobStatus.CANCEL_REQUESTED.value:
                    return True
        except Exception:
            pass
        return False

    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        ocr = OCRService()
        log_message("OCR Pipeline Initialized.")
        
        ocr = OCRService()
        log_message("OCR Pipeline Initialized.")
        
        # 1. Fetch IDs first (read-only)
        doc_ids = []
        with db.session_scope() as session:
            query = session.query(Document.id).filter(
                (Document.doc_type.in_(['JUDGMENT', 'ACT'])) & 
                ((Document.is_ocr_completed == False) | (Document.is_ocr_completed == None))
            )
            
            if target_id:
                query = query.filter(Document.id == target_id)
            elif limit:
                query = query.limit(limit)
                
            doc_ids = [r[0] for r in query.all()]

        log_message(f"Starting OCR for {len(doc_ids)} documents...")
        
        count = 0
        for i, doc_id in enumerate(doc_ids):
            if check_cancel():
                log_message("Cancellation requested. Stopping pipeline.")
                break

            # 2. Process each document in its own transaction
            with db.session_scope() as session:
                doc = session.query(Document).get(doc_id)
                if not doc: continue

                if not doc.s3_key:
                    log_message(f"Skipping Doc {doc.id}: No file path.")
                    continue
                
                # Verify local file integration
                local_path = doc.s3_key
                log_message(f"Processing Doc {doc.id} ({i+1}/{len(doc_ids)}): {os.path.basename(local_path)}...")
                
                # Pass callbacks to OCR Service
                text = ocr.extract_text(local_path, log_callback=log_message, check_cancel=check_cancel)
                
                if text:
                    doc.raw_text = text
                    doc.is_ocr_completed = True
                    doc.ocr_completed_at = datetime.utcnow()
                    doc.language = "sin+eng"
                    session.add(doc)
                    count += 1
                    log_message(f"Doc {doc.id} Completed.")
                else:
                    log_message(f"Doc {doc.id} Failed or Cancelled.")
            
            if check_cancel():
                log_message("Job Cancelled by user.")
                final_status = JobStatus.CANCELLED.value
            else:
                log_message(f"OCR Job Complete. Updated {count} documents.")
                final_status = JobStatus.COMPLETED.value
            
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    job.status = final_status
                    job.completed_at = datetime.utcnow()
                    job.result = f"Updated {count} documents."
                    session.add(job)

    except Exception as e:
        logger.error(f"Background Task Error (OCR): {e}")
        log_message(f"Critical Error: {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.completed_at = datetime.utcnow()
                job.error = str(e) + "\n" + traceback.format_exc()
                session.add(job)

@router.post("/process/ocr")
async def process_ocr(background_tasks: BackgroundTasks, limit: int = 10, doc_id: int = None):
    """
    Trigger OCR extraction for documents missing raw text.
    - **limit**: Max documents to process (default 10).
    - **doc_id**: Optional specific Document ID to process (useful for testing).
    """
    db = DatabaseManager()
    job_id = None
    with db.session_scope() as session:
        job = Job(job_type="OCR_PIPELINE", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_ocr_pipeline, job_id, limit, doc_id)
    return {
        "status": "accepted",
        "job_id": job_id,
        "message": "OCR pipeline started."
    }

# --- Segmentation ---
# --- Segmentation ---
from src.processing.segmentation.gemini import GeminiSegmenter

def run_segmentation_pipeline(job_id: int, limit: int = 50):
    db = DatabaseManager()
    
    def log_message(msg):
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    job.logs = (job.logs or "") + f"[{timestamp}] {msg}\n"
                    session.add(job)
        except: pass

    def check_cancel():
        try:
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job and job.status == JobStatus.CANCEL_REQUESTED.value:
                    return True
        except: pass
        return False

    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)
        
        # Initialize Gemini Segmenter
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            log_message("Error: GEMINI_API_KEY not found. Cannot run Gemini Segmentation.")
            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                job.status = JobStatus.FAILED.value
                job.error = "Missing GOOGLE_API_KEY"
            return

        segmenter = GeminiSegmenter(api_key=api_key)
        segmenter.set_callbacks(log_message, check_cancel)
        
        log_message("Gemini Segmentation Pipeline Initialized.")
        
        # 1. Fetch Candidate IDs
        doc_ids = []
        with db.session_scope() as session:
            query = session.query(Document.id).filter(
                (Document.raw_text != None) & 
                ((Document.structure == None) | (Document.structure == ""))
            )
            if limit > 0:
                query = query.limit(limit)
            
            doc_ids = [r[0] for r in query.all()]
            
        log_message(f"Found {len(doc_ids)} documents pending segmentation.")
        
        count = 0
        for i, doc_id in enumerate(doc_ids):
            if check_cancel():
                log_message("Cancellation requested.")
                break
                
            with db.session_scope() as session:
                doc = session.query(Document).get(doc_id)
                if not doc: continue
                
                log_message(f"Processing Doc {doc_id} ({i+1}/{len(doc_ids)})...")
                
                # Call Gemini
                struct_data = segmenter.segment(doc.raw_text)
                
                if struct_data:
                    import json
                    doc.structure = json.dumps(struct_data)
                    
                    # --- Feature Engineering Integration ---
                    features = struct_data.get("features")
                    if features:
                        # Ensure JudgmentMetadata exists
                        from src.database.models import JudgmentMetadata
                        meta = session.query(JudgmentMetadata).filter_by(document_id=doc.id).first()
                        if not meta:
                            meta = JudgmentMetadata(document_id=doc.id)
                            session.add(meta)
                        
                        # Populate Metadata
                        meta.outcome = features.get("outcome")
                        
                        citations = features.get("citations", [])
                        if isinstance(citations, list):
                            meta.citations = json.dumps(citations)
                        
                        keywords = features.get("keywords", [])
                        if isinstance(keywords, list):
                            meta.keywords = ", ".join(keywords)
                            
                        log_message(f"Doc {doc_id} Features Extracted: {meta.outcome}")

                    session.add(doc)
                    count += 1
                    log_message(f"Doc {doc_id} Segmented Successfully.")
                else:
                    log_message(f"Doc {doc_id} Failed to segment.")
        
        # Final Status Update
        if check_cancel():
            final_status = JobStatus.CANCELLED.value
            log_message("Job Cancelled.")
        else:
            final_status = JobStatus.COMPLETED.value
            log_message(f"Segmentation Job Complete. Updated {count} documents.")

        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = final_status
                job.completed_at = datetime.utcnow()
                job.result = f"Updated {count} documents."
                session.add(job)

    except Exception as e:
        logger.error(f"Background Task Error (Segmentation): {e}")
        log_message(f"Critical Error: {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.error = str(e)
                session.add(job)

@router.post("/process/segment")
async def process_segmentation(background_tasks: BackgroundTasks, limit: int = 10):
    """
    Trigger AI structural segmentation.
    Limit 0 = No limit.
    """
    db = DatabaseManager()
    job_id = None
    with db.session_scope() as session:
        job = Job(job_type="GEMINI_SEGMENTATION", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_segmentation_pipeline, job_id, limit)
    return {
        "status": "accepted",
        "job_id": job_id,
        "message": "Segmentation pipeline started."
    }

# --- Feature Engineering ---
from src.processing.features import FeatureExtractor
from src.database.models import JudgmentMetadata

def run_feature_pipeline(job_id: int, limit: int = 50):
    db = DatabaseManager()
    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        extractor = FeatureExtractor()
        
        with db.session_scope() as session:
            # Process Judgments with structure
            docs = session.query(Document).filter(
                (Document.doc_type == "JUDGMENT") & 
                (Document.structure != None)
            )
            if limit:
                docs = docs.limit(limit)
            
            docs = docs.all()
            logger.info(f"Background Task: Starting Feature Extraction for {len(docs)} judgments...")
            
            count = 0
            for doc in docs:
                try:
                    struct = json.loads(doc.structure)
                except:
                    continue
                    
                verdict = struct.get('verdict')
                analysis = struct.get('analysis')
                
                outcome = extractor.determine_outcome(verdict)
                citations = extractor.extract_citations(analysis)
                
                # Update or Create Metadata
                meta = doc.judgment_metadata
                if not meta:
                    meta = JudgmentMetadata(document_id=doc.id)
                    session.add(meta)
                
                meta.outcome = outcome
                meta.citations = citations
                count += 1
            
            logger.info(f"Background Task: Features Extraction Complete. Updated {count} records.")

            with db.session_scope() as session:
                job = session.query(Job).get(job_id)
                if job:
                    job.status = JobStatus.COMPLETED.value
                    job.completed_at = datetime.utcnow()
                    job.result = f"Features Extraction Complete. Updated {count} records."
                    session.add(job)

    except Exception as e:
        logger.error(f"Background Task Error (Features): {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.completed_at = datetime.utcnow()
                job.error = str(e) + "\n" + traceback.format_exc()
                session.add(job)

@router.post("/process/features")
async def process_features(background_tasks: BackgroundTasks, limit: int = 50):
    """
    Trigger feature extraction (Outcome, Citations) for segmented judgments.
    """
    db = DatabaseManager()
    job_id = None
    with db.session_scope() as session:
        job = Job(job_type="EXTRACT_FEATURES", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_feature_pipeline, job_id, limit)
    return {
        "status": "accepted",
        "job_id": job_id,
        "message": "Feature Extraction pipeline started."
    }

# --- ML Prediction ---
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# Global Model Cache
ml_model = None
ml_tokenizer = None

# Anchor paths to the project root (two levels up from this file: src/api/routes.py -> project root)
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

def load_ml_model():
    global ml_model, ml_tokenizer
    model_path = os.path.join(_PROJECT_ROOT, "models", "judgment_predictor")
    if os.path.exists(model_path):
        try:
            print("Loading ML model...")
            ml_tokenizer = AutoTokenizer.from_pretrained(model_path)
            ml_model = AutoModelForSequenceClassification.from_pretrained(model_path)
            print("ML model loaded.")
        except Exception as e:
            print(f"Error loading ML model: {e}")

@router.post("/predict/judgment")
async def predict_judgment(body: PredictionRequest):
    """
    Predict outcomes (ALLOWED/DISMISSED) based on case facts.
    Accepts JSON body: { "text": "..." }
    """
    text = body.text
    if not ml_model:
        load_ml_model()
        
    if not ml_model:
        raise HTTPException(status_code=503, detail="Model not loaded or training in progress.")
        
    inputs = ml_tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        outputs = ml_model(**inputs)
        
    logits = outputs.logits
    predicted_class_id = logits.argmax().item()
    
    # 0 = DISMISSED, 1 = ALLOWED (Based on dataset.py logic: label 1 if ALLOWED)
    label = "ALLOWED" if predicted_class_id == 1 else "DISMISSED"
    confidence = torch.softmax(logits, dim=1).tolist()[0]
    
    return {
        "prediction": label,
        "confidence": {
            "dismissed": confidence[0],
            "allowed": confidence[1]
        }
    }

@router.post("/predict/by-case-number")
async def predict_by_case_number(body: CaseNumberRequest):
    """
    Lookup a case by number, extract facts, and predict outcome.
    Useful for testing the model against known cases.
    Accepts JSON body: { "case_number": "..." }
    """
    if not ml_model:
        load_ml_model()
        
    normalized_input = (body.case_number or "").strip()
    if not normalized_input:
        raise HTTPException(status_code=400, detail="case_number is required.")

    db = DatabaseManager()
    with db.session_scope() as session:
        # 1) Direct fuzzy match on common input variants
        variants = {
            normalized_input,
            normalized_input.replace("/", " "),
            normalized_input.replace("-", " "),
            " ".join(normalized_input.split()),
        }

        doc = None
        for variant in variants:
            if not variant:
                continue
            doc = session.query(Document).filter(
                (Document.doc_type == "JUDGMENT") &
                (Document.case_number.ilike(f"%{variant}%"))
            ).order_by(Document.date_decided.desc()).first()
            if doc:
                break

        # 2) Token-based fallback to handle storage format differences
        if not doc:
            import re
            tokens = re.findall(r"[A-Za-z0-9]+", normalized_input.upper())
            if tokens:
                token_query = session.query(Document).filter(Document.doc_type == "JUDGMENT")
                for token in tokens:
                    token_query = token_query.filter(Document.case_number.ilike(f"%{token}%"))
                doc = token_query.order_by(Document.date_decided.desc()).first()
        
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"Case not found for case_number='{normalized_input}'."
            )
            
        # Get Facts
        try:
            struct = json.loads(doc.structure)
            facts = struct.get('facts', '')
            # Fallback logic same as dataset.py
            if not facts or len(facts) < 100:
                header = struct.get('header', '')
                analysis = struct.get('analysis', '')
                facts = f"{header}\n{analysis[:2000]}"
        except:
             raise HTTPException(status_code=500, detail="Error parsing document structure.")
             
        if not facts:
             raise HTTPException(status_code=400, detail="No facts found in document.")

        # Predict
        cleaned_text = facts.replace('\n', ' ').strip()
        inputs = ml_tokenizer(cleaned_text, return_tensors="pt", truncation=True, padding=True, max_length=512)
        with torch.no_grad():
            outputs = ml_model(**inputs)
            
        logits = outputs.logits
        predicted_class_id = logits.argmax().item()
        label = "ALLOWED" if predicted_class_id == 1 else "DISMISSED"
        confidence = torch.softmax(logits, dim=1).tolist()[0]
        
        # Actual Outcome
        actual = "Unknown"
        if doc.judgment_metadata and doc.judgment_metadata.outcome:
            actual = doc.judgment_metadata.outcome
            
        return {
            "case_number": doc.case_number,
            "actual_outcome": actual,
            "predicted_outcome": label,
            "confidence": {
                "dismissed": confidence[0],
                "allowed": confidence[1]
            },
            "facts_snippet": facts[:200] + "..."
        }

def run_training_pipeline(job_id: int):
    db = DatabaseManager()
    try:
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.utcnow()
                session.add(job)

        from src.ml.train import train_model
        train_model()
        
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.COMPLETED.value
                job.completed_at = datetime.utcnow()
                job.result = "Model Training successfully completed."
                session.add(job)

    except Exception as e:
        logger.error(f"Background Task Error (Training): {e}")
        with db.session_scope() as session:
            job = session.query(Job).get(job_id)
            if job:
                job.status = JobStatus.FAILED.value
                job.completed_at = datetime.utcnow()
                job.error = str(e) + "\n" + traceback.format_exc()
                session.add(job)

@router.post("/train/judgment")
async def train_judgment(background_tasks: BackgroundTasks):
    """
    Trigger re-training of the Judgment Prediction Model.
    """
    db = DatabaseManager()
    job_id = None
    with db.session_scope() as session:
        job = Job(job_type="TRAIN_MODEL", status=JobStatus.PENDING.value)
        session.add(job)
        session.flush()
        job_id = job.id

    background_tasks.add_task(run_training_pipeline, job_id)
    return {
        "status": "accepted",
        "job_id": job_id,
        "message": "Training started."
    }

# --- RAG Search ---
from src.rag.store import SimpleVectorStore

# Global Store Cache
rag_store = None

def get_rag_store():
    global rag_store
    if not rag_store:
        rag_store = SimpleVectorStore()
    return rag_store

@router.post("/search")
async def search_documents(body: SearchRequest):
    """
    Semantic search over Judgments and Acts.
    Accepts JSON body: { "query": "...", "limit": 5 }
    """
    store = get_rag_store()
    results = store.search(body.query, k=body.limit)
    return {"results": results}

# --- Explanation Layer (Gemini) ---
from src.llm.gemini import GeminiExplainer

# Global Explainer Cache
gemini_explainer = None

def get_explainer():
    global gemini_explainer
    if not gemini_explainer:
        gemini_explainer = GeminiExplainer()
    return gemini_explainer

@router.post("/predict/with-explanation")
async def predict_with_explanation(body: PredictionWithExplanationRequest):
    """
    Predict outcome and generate an Explanation using Gemini + RAG.
    """
    # 1. Get Prediction
    # We can reuse the logic from predict_judgment, but let's call it directly or refactor.
    # For now, invoking the logic inline to avoid HTTP overhead of self-call.
    text = body.text
    case_number = body.case_number
    
    if not ml_model:
        load_ml_model()
    
    if not ml_model:
        raise HTTPException(status_code=503, detail="Prediction Model not available.")

    # Prediction Logic
    try:
        inputs = ml_tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
        with torch.no_grad():
            outputs = ml_model(**inputs)
            
        logits = outputs.logits
        predicted_class_id = logits.argmax().item()
        label = "ALLOWED" if predicted_class_id == 1 else "DISMISSED"
        confidence = torch.softmax(logits, dim=1).tolist()[0]
        conf_dict = {"dismissed": confidence[0], "allowed": confidence[1]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction Error: {str(e)}")
    
    # 2. Get RAG Context
    try:
        # Search for similar cases/laws using the Facts text
        store = get_rag_store()
        # Limit to top 3 for context window efficiency
        search_results = store.search(text, k=3)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG Error: {str(e)}")
    
    # 3. Generate Explanation
    explanation = "AI legal explanation is currently unavailable."
    explanation_status = "unavailable"
    explanation_message = "Explanation generation failed."
    can_retry = False

    try:
        explainer = get_explainer()
        explanation_payload = explainer.generate_explanation(
            facts=text,
            predicted_outcome=label,
            confidence=conf_dict,
            context_docs=search_results
        )

        if isinstance(explanation_payload, dict):
            explanation = explanation_payload.get("text") or explanation
            explanation_status = explanation_payload.get("status") or explanation_status
            explanation_message = explanation_payload.get("message") or explanation_message
            can_retry = bool(explanation_payload.get("can_retry", False))
        elif isinstance(explanation_payload, str) and explanation_payload.strip():
            explanation = explanation_payload
            explanation_status = "generated"
            explanation_message = None
            can_retry = False
    except Exception:
        logger.exception("Failed to generate explanation")
    
    return {
        "prediction": label,
        "confidence": conf_dict,
        "explanation": explanation,
        "explanation_status": explanation_status,
        "explanation_message": explanation_message,
        "can_retry": can_retry,
        "citing_documents": [res['id'] for res in search_results]
    }

# --- Dashboard Stats ---

@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """
    Get system statistics for the Admin Dashboard.
    """
    stats = {
        "documents": 0,
        "judgments": 0,
        "acts": 0,
        "pending_ocr": 0,
        "pending_features": 0
    }
    
    try:
        db = DatabaseManager()
        with db.session_scope() as session:
            # Total Docs
            stats["documents"] = session.query(Document).count()
            
            # Judgments
            stats["judgments"] = session.query(Document).filter(Document.doc_type == "JUDGMENT").count()
            
            # Acts
            stats["acts"] = session.query(Document).filter(Document.doc_type == "ACT").count()
            
            # OCR Pending (Assumes raw_text is null)
            stats["pending_ocr"] = session.query(Document).filter(Document.raw_text == None).count()
            
            # Features Pending (Assumes structure is null)
            stats["pending_features"] = session.query(Document).filter(Document.structure == None).count()
            
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        
    return stats

# --- OCR Pipeline Endpoints ---

@router.get("/stats/ocr")
async def get_ocr_stats():
    """Get stats for OCR Pipeline."""
    db = DatabaseManager()
    stats = {
        "total": 0,
        "completed": 0,
        "pending": 0
    }
    try:
        with db.session_scope() as session:
            stats["total"] = session.query(Document).count()
            stats["completed"] = session.query(Document).filter(Document.is_ocr_completed == True).count()
            stats["pending"] = stats["total"] - stats["completed"]
    except Exception as e:
        logger.error(f"Error fetching OCR stats: {e}")
    return stats

# --- Segmentation Endpoints ---

@router.get("/stats/segmentation")
async def get_segmentation_stats():
    """Get stats for Segmentation Pipeline."""
    db = DatabaseManager()
    stats = {
        "total": 0,
        "completed": 0,
        "pending": 0
    }
    try:
        with db.session_scope() as session:
            # We care about docs that have raw_text (candidates)
            stats["total"] = session.query(Document).filter(Document.raw_text != None).count()
            stats["completed"] = session.query(Document).filter(
                (Document.raw_text != None) & 
                (Document.structure != None) & 
                (Document.structure != "")
            ).count()
            stats["pending"] = stats["total"] - stats["completed"]
    except Exception as e:
        logger.error(f"Error fetching Segmentation stats: {e}")
    return stats

@router.get("/documents/segmentation", response_model=PaginatedResponse[DocumentResponse])
async def list_segmentation_documents(page: int = 1, limit: int = 50, status: str = 'all'):
    """
    List documents for segmentation view.
    status: 'all', 'completed', 'pending'
    """
    db = DatabaseManager()
    offset = (page - 1) * limit
    try:
        with db.session_scope() as session:
            query = session.query(Document).filter(Document.raw_text != None)
            
            if status == 'completed':
                query = query.filter((Document.structure != None) & (Document.structure != ""))
            elif status == 'pending':
                query = query.filter((Document.structure == None) | (Document.structure == ""))
            
            total_count = query.count()
            import math
            total_pages = math.ceil(total_count / limit) if limit > 0 else 1
            
            # Order by ID desc
            docs = query.order_by(Document.id.desc()).offset(offset).limit(limit).all()
            
            valid_docs = []
            for doc in docs:
                try:
                    valid_docs.append(DocumentResponse.model_validate(doc))
                except Exception: continue

            return PaginatedResponse(
                items=valid_docs,
                total=total_count,
                page=page,
                limit=limit,
                total_pages=total_pages
            )
    except Exception as e:
        logger.error(f"Error listing Segmentation documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents/{doc_id}/structure")
async def get_document_structure(doc_id: int):
    """Get the JSON structure for a document."""
    db = DatabaseManager()
    with db.session_scope() as session:
        doc = session.query(Document).get(doc_id)
        if not doc or not doc.structure:
            raise HTTPException(status_code=404, detail="Structure not found")
        return {"structure": doc.structure}

@router.get("/documents/ocr", response_model=PaginatedResponse[DocumentResponse])
async def list_ocr_documents(page: int = 1, limit: int = 50, status: str = 'all'):
    """
    List documents with OCR status.
    status: 'all', 'completed', 'pending'
    """
    db = DatabaseManager()
    offset = (page - 1) * limit
    try:
        with db.session_scope() as session:
            query = session.query(Document)
            
            if status == 'completed':
                query = query.filter(Document.is_ocr_completed == True)
            elif status == 'pending':
                query = query.filter(Document.is_ocr_completed == False)
            
            total_count = query.count()
            import math
            total_pages = math.ceil(total_count / limit) if limit > 0 else 1
            
            # Order by recently updated or created
            docs = query.order_by(Document.id.desc()).offset(offset).limit(limit).all()
            
            valid_docs = []
            for doc in docs:
                try:
                    valid_docs.append(DocumentResponse.model_validate(doc))
                except Exception:
                    continue

            return PaginatedResponse(
                items=valid_docs,
                total=total_count,
                page=page,
                limit=limit,
                total_pages=total_pages
            )
    except Exception as e:
        logger.error(f"Error listing OCR documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents/{doc_id}/ocr-text")
async def get_ocr_text_content(doc_id: int):
    """Get the raw OCR text for a document."""
    db = DatabaseManager()
    try:
        with db.session_scope() as session:
            doc = session.query(Document).get(doc_id)
            if not doc:
                raise HTTPException(status_code=404, detail="Document not found")
            
            return {
                "id": doc.id,
                "text": doc.raw_text if doc.raw_text else "No OCR text available."
            }
    except Exception as e:
        logger.error(f"Error fetching OCR text: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard/overview")
async def get_dashboard_overview():
    """
    Get comprehensive stats for the Admin Overview Dashboard.
    """
    db = DatabaseManager()
    stats = {
        "documents": {
            "total": 0,
            "judgments": 0,
            "acts": 0
        },
        "pipelines": {
            "ocr_pending": 0,
            "ocr_completed": 0,
            "seg_pending": 0,
            "seg_completed": 0
        },
        "recent_jobs": []
    }

    # Server stats should not crash dashboard if unavailable.
    try:
        import psutil
        mem = psutil.virtual_memory()
        stats["server_stats"] = {
            "cpu_usage": psutil.cpu_percent(interval=None),
            "ram_usage": mem.percent,
            "ram_total": round(mem.total / (1024 * 1024 * 1024), 2), # GB
            "ram_free": round(mem.available / (1024 * 1024 * 1024), 2) # GB
        }
    except Exception as ps_err:
        logger.warning(f"dashboard_overview.server_stats_unavailable: {ps_err}")
        stats["server_stats"] = None

    try:
        with db.session_scope() as session:
            # Document stats
            try:
                stats["documents"]["total"] = session.query(Document).count()
                stats["documents"]["judgments"] = session.query(Document).filter(Document.doc_type == "JUDGMENT").count()
                stats["documents"]["acts"] = session.query(Document).filter(Document.doc_type == "ACT").count()
            except Exception as doc_err:
                logger.error(f"dashboard_overview.documents_query_failed: {doc_err}")

            # Pipeline stats
            try:
                # Prefer explicit OCR flag; fallback for older schemas.
                try:
                    stats["pipelines"]["ocr_pending"] = session.query(Document).filter(
                        Document.raw_text == None,
                        Document.is_ocr_completed == False
                    ).count()
                    stats["pipelines"]["ocr_completed"] = session.query(Document).filter(
                        Document.is_ocr_completed == True
                    ).count()
                except Exception as ocr_err:
                    logger.warning(f"dashboard_overview.ocr_stats_fallback: {ocr_err}")
                    stats["pipelines"]["ocr_pending"] = session.query(Document).filter(Document.raw_text == None).count()
                    stats["pipelines"]["ocr_completed"] = session.query(Document).filter(Document.raw_text != None).count()

                stats["pipelines"]["seg_pending"] = session.query(Document).filter(
                    Document.raw_text != None,
                    (Document.structure == None) | (Document.structure == "")
                ).count()
                stats["pipelines"]["seg_completed"] = session.query(Document).filter(
                    Document.structure != None,
                    Document.structure != ""
                ).count()
            except Exception as pipe_err:
                logger.error(f"dashboard_overview.pipeline_stats_failed: {pipe_err}")

            # Recent jobs
            try:
                jobs = session.query(Job).order_by(Job.created_at.desc()).limit(5).all()
                stats["recent_jobs"] = [
                    {
                        "id": j.id,
                        "type": j.job_type,
                        "status": j.status,
                        "created_at": j.created_at,
                        "completed_at": j.completed_at
                    } for j in jobs
                ]
            except Exception as jobs_err:
                logger.error(f"dashboard_overview.recent_jobs_failed: {jobs_err}")
    except Exception as db_err:
        logger.error(f"dashboard_overview.db_session_failed: {db_err}")
        raise HTTPException(status_code=500, detail=str(db_err))

    return stats
