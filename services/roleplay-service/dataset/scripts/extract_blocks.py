import json
import re
import pandas as pd
import spacy
from tqdm import tqdm
import os

# Load spaCy for Named Entity Recognition (NER)
# Note: Ensure you run 'python -m spacy download en_core_web_sm' first
try:
    nlp = spacy.load("en_core_web_sm")
except:
    import os
    os.system("python -m spacy download en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

# Configuration for your local environment
INPUT_PATH = r"D:\RE\LawnovaWebapp\services\roleplay-service\dataset\raw_data\lk_supreme_court_judgements.jsonl"
OUTPUT_DIR = r"D:\RE\LawnovaWebapp\services\roleplay-service\dataset\processed_data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "structured_criminal_data.csv")

def extract_legal_entities(text):
    """Extracts key parties and legal provisions using NER."""
    doc = nlp(text[:8000]) # Process first 8k chars for efficiency
    entities = {"parties": [], "dates": []}
    for ent in doc.ents:
        if ent.label_ in ["PERSON", "ORG"]:
            entities["parties"].append(ent.text)
        elif ent.label_ == "DATE":
            entities["dates"].append(ent.text)
    return entities

def structure_judgment(text):
    """
    Segments raw text into Facts (Input) and Verdict (Label).
    Also extracts relevant Penal Code sections.
    """
    # Clean noise and normalize text
    text_clean = re.sub(r'\s+', ' ', text).strip()
    
    # 1. Extract Facts: Usually follows the introduction of parties
    # Matches patterns like 'FACTS OF THE CASE' or starts from beginning
    facts_match = re.search(r"(?:FACTS OF THE CASE|BACKGROUND|CASE DESCRIPTION)(.*?)(?:LEGAL ISSUES|ANALYSIS|CONCLUSION|JUDGMENT)", text_clean, re.IGNORECASE | re.DOTALL)
    facts = facts_match.group(1).strip() if facts_match else text_clean[:4000]
    
    # 2. Extract Statutes: Specifically looking for SL Penal Code
    statutes = list(set(re.findall(r"(?:Section|Sectional)\s+\d+\s+of\s+the\s+Penal\s+Code", text_clean, re.IGNORECASE)))
    
    # 3. Extract Verdict: Typically at the very end of the document
    verdict_match = re.search(r"(?:CONCLUSION|VERDICT|ORDER|The appeal is|I would therefore)(.*?)$", text_clean, re.IGNORECASE | re.DOTALL)
    verdict = verdict_match.group(0).strip() if verdict_match else text_clean[-2000:]
    
    return facts, statutes, verdict

def main():
    if not os.path.exists(OUTPUT_DIR): os.makedirs(OUTPUT_DIR)
    
    processed_data = []
    print(f"Starting Extraction from: {INPUT_PATH}")
    
    with open(INPUT_PATH, 'r', encoding='utf-8') as f:
        for line in tqdm(f):
            try:
                case = json.loads(line)
                full_text = case.get('judgment_text', '')
                
                # Filter for Criminal/Theft Keywords to align with scope
                criminal_keywords = ["Penal Code", "Attorney General", "Theft", "Burglary", "Conviction"]
                if not any(kw.lower() in full_text.lower() for kw in criminal_keywords):
                    continue
                
                # Perform Structuring
                facts, statutes, verdict = structure_judgment(full_text)
                entities = extract_legal_entities(full_text)
                
                processed_data.append({
                    "case_id": case.get("case_id"),
                    "parties": ", ".join(list(set(entities["parties"]))[:5]),
                    "statutes": ", ".join(statutes),
                    "facts_input": facts,
                    "verdict_label_text": verdict
                })
            except Exception as e:
                continue

    # Create structured dataset for training
    df = pd.DataFrame(processed_data)
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nExtraction Complete! {len(processed_data)} cases structured.")
    print(f"Data saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()