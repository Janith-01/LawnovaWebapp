# Save as: train_prep.py
import json
import csv
import os

INPUT_FILE = r"D:\RE\LawnovaWebapp\services\roleplay-service\dataset\raw_data\lk_supreme_court_judgements.jsonl"
OUTPUT_FILE = "legal_dataset.csv"

# Win/Loss Keywords
WIN_KEYWORDS = ["appeal allowed", "application granted", "set aside", "acquitted", "conviction is quashed"]
LOSS_KEYWORDS = ["appeal dismissed", "application refused", "application dismissed", "affirm the judgment"]

def get_label(text):
    if not text: return None
    text_lower = text.lower().strip()[-2000:] # Check last 2000 chars
    for kw in WIN_KEYWORDS:
        if kw in text_lower: return 1
    for kw in LOSS_KEYWORDS:
        if kw in text_lower: return 0
    return None

def process():
    print(f"🚀 Processing {INPUT_FILE}...")
    if not os.path.exists(INPUT_FILE):
        print("❌ JSONL file not found! Run the recursive script first.")
        return

    count = 0
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["text", "label"])
        
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    text = data.get('judgment_text') or data.get('judgment') or data.get('content')
                    label = get_label(text)
                    if label is not None:
                        writer.writerow([text.replace("\n", " "), label])
                        count += 1
                except: pass

    print(f"✅ Done! Found {count} usable Win/Loss cases.")
    print(f"📂 Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    process()
