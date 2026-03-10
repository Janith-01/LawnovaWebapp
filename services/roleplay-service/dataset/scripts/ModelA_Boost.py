import pandas as pd
import re
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load your 35k master dataset
DATA_PATH = os.path.join(SCRIPT_DIR, 'legal_dataset_final.csv')
df_master = pd.read_csv(DATA_PATH) 

def extract_logic_expert_data(df):
    # Phrases indicating strong lawyer/judge logical evaluation
    strong_logic_markers = [
        r"it is abundantly clear", r"evidence establishes the fact",
        r"burden of proof lies on", r"prima facie proved",
        r"consistent only with the guilt", r"satisfactorily established"
    ]
    
    # Phrases indicating weak/failed logical links
    weak_logic_markers = [
        r"failed to establish", r"failed to prove", r"doubtful when considering",
        r"cannot be considered as evidence", r"full of inconsistencies",
        r"not a reliable witness"
    ]

    logic_samples = []
    for _, row in df.iterrows():
        text = str(row['text'])
        if any(re.search(p, text, re.IGNORECASE) for p in strong_logic_markers):
            logic_samples.append({'text': text, 'label': 1})
        elif any(re.search(p, text, re.IGNORECASE) for p in weak_logic_markers):
            logic_samples.append({'text': text, 'label': 0})
            
    return pd.DataFrame(logic_samples)

# Generate the logic-boost set
df_boost = extract_logic_expert_data(df_master)
print(f"Extracted {len(df_boost)} specialized legal logic samples for Model A.")
df_boost.to_csv('MODEL_A_LEGAL_LOGIC_BOOST.csv', index=False)
