from src.database.db_manager import DatabaseManager
from src.database.models import Job, JobStatus
from datetime import datetime

def reset_stuck_jobs():
    db = DatabaseManager()
    with db.session_scope() as session:
        stuck_jobs = session.query(Job).filter(
            Job.status.in_([
                JobStatus.RUNNING.value, 
                JobStatus.PENDING.value,
                JobStatus.CANCEL_REQUESTED.value
            ])
        ).all()
        
        print(f"Found {len(stuck_jobs)} stuck jobs.")
        
        for job in stuck_jobs:
            print(f"Resetting Job {job.id} ({job.job_type})...")
            job.status = JobStatus.FAILED.value
            job.error = "Job reset by system cleanup (server restart detected)."
            job.completed_at = datetime.utcnow()
            session.add(job)
            
        print("Done.")

if __name__ == "__main__":
    reset_stuck_jobs()
