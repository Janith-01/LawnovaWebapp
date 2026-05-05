from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

from src.api.routes import router

app = FastAPI(
    title="Lawnowa Legal Intelligence API",
    description="API for triggering scrapers and retrieving legal data.",
    version="1.0.0"
)

app.include_router(router)

from src.database.db_manager import DatabaseManager
from src.database.models import Job, JobStatus
from datetime import datetime

@app.on_event("startup")
def startup_event():
    """
    Clean up any stuck jobs from previous run.
    """
    try:
        db = DatabaseManager()
        with db.session_scope() as session:
            stuck_jobs = session.query(Job).filter(
                Job.status.in_([
                    JobStatus.RUNNING.value, 
                    JobStatus.PENDING.value,
                    JobStatus.CANCEL_REQUESTED.value
                ])
            ).all()
            
            if stuck_jobs:
                print(f"Startup: Cleaning up {len(stuck_jobs)} zombie jobs...")
                for job in stuck_jobs:
                    job.status = JobStatus.FAILED.value
                    job.error = "Detailed: Server restarted while job was running."
                    job.completed_at = datetime.utcnow()
                    session.add(job)
    except Exception as e:
        print(f"Startup Cleanup Error: {e}")

import logging
import sys
import os as _os

# Configure logging at module level so it runs on import
_LOG_DIR = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", ".."))
logging.basicConfig(
    filename=_os.path.join(_LOG_DIR, 'server.log'), 
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
# Also log to stderr for uvicorn to catch
console = logging.StreamHandler(sys.stderr)
console.setLevel(logging.INFO)
logging.getLogger('').addHandler(console)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.main:app", host="127.0.0.1", port=8000, reload=True)
