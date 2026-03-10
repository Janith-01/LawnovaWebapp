import json
import csv
import os

# --- CONFIGURATION ---
NEW_INPUT_FILE = "lk_appeal_court_judgements.jsonl"
EXISTING_CSV = "legal_dataset.csv"

# Same keywords (They apply to Appeal Court too)
WIN_KEYWORDS = ["appeal allowed", "application granted", "set aside", "acquitted", "conviction is quashed"]
LOSS_KEYWORDS = ["appeal dismissed", "application refused", "application dismissed", "affirm the judgment"]

def get_label(text):
    if not text: return None
    text_lower = text.lower().strip()[-3000:] 
    for kw in WIN_KEYWORDS:
        if kw in text_lower: return 1
    for kw in LOSS_KEYWORDS:
        if kw in text_lower: return 0
    return None

def append_data():
    print(f"🚀 Appending data from {NEW_INPUT_FILE} to {EXISTING_CSV}...")
    
    if not os.path.exists(NEW_INPUT_FILE):
        print("❌ Error: Appeal Court JSONL file not found.")
        return

    count = 0
    
    # Open in 'a' (Append) mode so we don't delete Supreme Court data
    with open(EXISTING_CSV, 'a', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        
        with open(NEW_INPUT_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    text = data.get('judgment_text', '')
                    
                    label = get_label(text)
                    
                    if label is not None:
                        clean_text = text.replace("\n", " ").replace("\r", " ")
                        writer.writerow([clean_text, label])
                        count += 1
                except: pass

    print(f"✅ Added {count} Appeal Court cases to your dataset.")
    print(f"📊 Total dataset is now larger!")

if __name__ == "__main__":
    append_data()
