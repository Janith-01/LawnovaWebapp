import sys
import os
import json
import logging
import pandas as pd
from sqlalchemy import create_engine

# Add project root to path
sys.path.append(os.getcwd())

from src.database.db_manager import DatabaseManager
from src.database.models import Document, JudgmentMetadata

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def export_dataset(output_path="data/dataset.csv"):
    db = DatabaseManager()
    
    data = []
    
    with db.session_scope() as session:
        # Join Document + Metadata
        # Filter for valid outcomes
        query = session.query(Document, JudgmentMetadata).join(
            JudgmentMetadata, Document.id == JudgmentMetadata.document_id
        ).filter(
            JudgmentMetadata.outcome.in_(['ALLOWED', 'DISMISSED'])
        )
        
        results = query.all()
        logger.info(f"Found {len(results)} labeled judgments.")
        
        for doc, meta in results:
             # Get Facts
             try:
                 struct = json.loads(doc.structure)
                 facts = struct.get('facts', '')
                 
                 # Strategy:
                 # 1. Use Facts if > 100 chars
                 # 2. Else, use Header + first 2000 chars of Analysis (Context)
                 # 3. Else, use raw text start
                 
                 text_content = ""
                 if facts and len(facts) > 100:
                     text_content = facts
                 else:
                     header = struct.get('header', '')
                     analysis = struct.get('analysis', '')
                     # Combined context
                     combined = f"{header}\n{analysis[:2000]}"
                     text_content = combined
                 
                 # Cleanup
                 text_content = text_content.replace('\n', ' ').strip()
                 
                 if len(text_content) < 100: 
                     continue
                 
                 data.append({
                     "text": text_content,
                     "label": 1 if meta.outcome == 'ALLOWED' else 0
                 })
                 
             except:
                 continue
                 
    if not data:
        logger.warning("No valid training data found!")
        return
        
    df = pd.DataFrame(data)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    logger.info(f"Dataset exported to {output_path} ({len(df)} samples).")
    logger.info(f"Class distribution:\n{df['label'].value_counts()}")

if __name__ == "__main__":
    export_dataset()
