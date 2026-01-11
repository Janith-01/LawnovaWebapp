import sys
import os
import json
import logging
from sqlalchemy import create_engine

# Add project root to path
sys.path.append(os.getcwd())

from src.database.db_manager import DatabaseManager
from src.database.models import Document, JudgmentMetadata
from src.processing.features import FeatureExtractor

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    db = DatabaseManager()
    extractor = FeatureExtractor()
    
    with db.session_scope() as session:
        # Get Judgments with structure
        docs = session.query(Document).filter(
            (Document.doc_type == "JUDGMENT") & 
            (Document.structure != None)
        ).all()
        
        logger.info(f"Found {len(docs)} judgments for feature extraction.")
        
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
                # Need to create it? Or usually extracted by regex earlier?
                # If earlier step (regex metadata) didn't run or failed, we might not have it.
                # Let's create empty one if missing, though typically we should have it.
                meta = JudgmentMetadata(document_id=doc.id)
                session.add(meta)
            
            meta.outcome = outcome
            meta.citations = citations
            count += 1
            
        logger.info(f"Features Extraction Complete. Updated {count} records.")

if __name__ == "__main__":
    main()
