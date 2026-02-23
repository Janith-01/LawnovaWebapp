import sys
import os
import logging
from sqlalchemy import create_engine

# Add project root to path
sys.path.append(os.getcwd())

from src.database.db_manager import DatabaseManager
from src.database.models import Document
from src.processing.ocr import OCRService

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    db = DatabaseManager()
    
    # Initialize OCR Service (auto-detects paths)
    ocr = OCRService()
    
    with db.session_scope() as session:
        # Query docs without raw_text
        # Limit to 5 for testing/dry-run, or remove limit for full run
        docs = session.query(Document).filter(
            (Document.doc_type.in_(['JUDGMENT', 'ACT'])) & 
            (Document.raw_text == None)
        ).limit(5).all()
        
        logger.info(f"Found {len(docs)} documents needing OCR.")
        
        count = 0
        for doc in docs:
            logger.info(f"Processing Doc ID {doc.id}: {doc.source_url}")
            
            local_path = doc.s3_key
            if not local_path or not os.path.exists(local_path):
                logger.warning(f"File not found locally: {local_path}")
                continue
                
            text = ocr.extract_text(local_path)
            
            if text:
                doc.raw_text = text
                session.add(doc) # Mark as dirty
                count += 1
                logger.info(f"Successfully extracted {len(text)} characters.")
            else:
                logger.warning("No text extracted.")
                
        logger.info(f"OCR Job Complete. Updated {count} documents.")

if __name__ == "__main__":
    main()
