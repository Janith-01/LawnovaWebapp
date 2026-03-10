import pandas as pd
import re
import os

# Get the directory where the script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Load your raw data
# Now relative to the script location
DATA_PATH = os.path.join(SCRIPT_DIR, 'legal_dataset_final.csv')
df_raw = pd.read_csv(DATA_PATH) 

def process_judgments(df):
    processed_data = []
    
    # Keywords for Label 1 (Law/Statute)
    law_patterns = [
    r"Section \d+", r"Law No\.", r"valid in law", r"terms of Section",
    r"Deed No", r"notary public", r"attested by", r"Settlement of Debts",
    r"Evidence Ordinance", r"Penal Code", r"Article \d+"
]
    
    # Keywords for Label 0 (Facts/Scenarios)
    fact_patterns = [
        r"Plaintiff", r"Defendant", r"Respondent", r"Appellant", 
        r"Fiscal", r"Surveyor", r"Police station", r"witness", 
        r"Lot No", r"Case No", r"occurred on", r"testified"
    ]

    for index, row in df.iterrows():
        text = str(row['text'])
        # Split text into paragraphs/chunks of roughly 2-3 sentences
        chunks = re.split(r'\n|(?<=[.!?]) +', text)
        
        for chunk in chunks:
            chunk = chunk.strip()
            if len(chunk) < 50: continue # Skip very short noise
            
            label = None
            # Heuristic labeling
            if any(re.search(p, chunk, re.IGNORECASE) for p in law_patterns):
                label = 1
            elif any(re.search(p, chunk, re.IGNORECASE) for p in fact_patterns):
                label = 0
            
            if label is not None:
                processed_data.append({'text': chunk, 'label': label})
                
    return pd.DataFrame(processed_data)

# Run the processor
df_final = process_judgments(df_raw)

# 2. Balance the Dataset
# Ensure we don't have too much of one class
counts = df_final['label'].value_counts()
min_size = counts.min()

df_balanced = pd.concat([
    df_final[df_final['label'] == 1].sample(min_size, random_state=42),
    df_final[df_final['label'] == 0].sample(min_size, random_state=42)
]).sample(frac=1).reset_index(drop=True)

print(f"Dataset generated: {len(df_balanced)} balanced samples.")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, '..', 'LAWNOVA_MASTER_TRAINING_DATA.csv')
df_balanced.to_csv(OUTPUT_PATH, index=False)
print(f"Saved to: {os.path.abspath(OUTPUT_PATH)}")
