import sys
import os
import logging
from sqlalchemy import create_engine

# Add project root to path
sys.path.append(os.getcwd())

from src.database.db_manager import DatabaseManager
from src.database.models import Document, JudgmentMetadata, Base
from src.processing.metadata import JudgmentMetadataExtractor

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    db = DatabaseManager()
    
    # Ensure tables exist (creates JudgmentMetadata if missing)
    Base.metadata.create_all(db.engine)
    
    extractor = JudgmentMetadataExtractor()
    
    with db.session_scope() as session:
        # Get all Judgments without metadata (or all for now to update)
        # Ideally we check left join where metadata is null, but for now lets iterate all
        docs = session.query(Document).filter(Document.doc_type == "JUDGMENT").all()
        logger.info(f"Found {len(docs)} judgments to process.")
        
        count = 0
        for doc in docs:
            # Check if metadata already exists
            if doc.judgment_metadata:
                continue # Skip if already processed
            
            if not doc.raw_text:
                continue
                
            logger.info(f"Processing doc {doc.id}: {doc.case_number}")
            
            meta_dict = extractor.extract(doc.raw_text)
            
            if meta_dict:
                # Create Metadata Object
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
                
        logger.info(f"Processed {count} documents.")

if __name__ == "__main__":
    main()
