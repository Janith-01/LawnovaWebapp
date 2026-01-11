import sys
import os
import re
import random
from sqlalchemy import create_engine

# Add project root to path
sys.path.append(os.getcwd())

from src.database.db_manager import DatabaseManager
from src.database.models import Document

# Force utf-8 output for console
sys.stdout.reconfigure(encoding='utf-8')

def analyze():
    db = DatabaseManager()
    with db.session_scope() as session:
        # Get Judgments with text
        judgments = session.query(Document).filter(
            (Document.doc_type == "JUDGMENT") & 
            (Document.raw_text != None)
        ).limit(100).all() # Get a pool to sample from
        
        sample = random.sample(judgments, min(len(judgments), 5))
        
        print("=== JUDGMENT ANALYSIS ===")
        for doc in sample:
            text = doc.raw_text
            print(f"\n--- Doc {doc.id} ({doc.case_number}) ---")
            
            # Print first 500 chars (Header analysis)
            print("[HEAD START]")
            print(text[:300].replace("\n", "\\n"))
            print("[HEAD END]")
            
            # Print last 500 chars (Verdict analysis)
            print("[TAIL START]")
            print(text[-300:].replace("\n", "\\n"))
            print("[TAIL END]")
            
            # Look for potential section keywords
            keywords = ["Heard on", "Argued on", "Decided on", "Judgment", "ORDER", "Conclusion", "Facts", "Held"]
            found = []
            for k in keywords:
                matches = list(re.finditer(re.escape(k), text, re.IGNORECASE))
                if matches:
                    found.append(f"{k} ({len(matches)}x)")
            print(f"Keywords found: {', '.join(found)}")

        # Get Acts
        acts = session.query(Document).filter(
            (Document.doc_type == "ACT") & 
            (Document.raw_text != None)
        ).limit(20).all()
        
        if acts:
            sample_acts = random.sample(acts, min(len(acts), 3))
            print("\n=== ACT ANALYSIS ===")
            for doc in sample_acts:
                text = doc.raw_text
                print(f"\n--- Act {doc.id} ({doc.title}) ---")
                print("[HEAD START]")
                print(text[:300].replace("\n", "\\n"))
                
                # Look for "Section" patterns
                sec_matches = re.findall(r'(?i)^Section\s+\d+|^\d+\.\s+[A-Z]', text, re.MULTILINE)
                print(f"Potential Section Headers: {sec_matches[:5]}...")

if __name__ == "__main__":
    analyze()
