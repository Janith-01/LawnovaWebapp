import pandas as pd
import re

# --- CONFIGURATION ---
INPUT_CSV = "legal_dataset.csv"
OUTPUT_CSV = "legal_dataset_final.csv"

def clean_text(text):
    if not isinstance(text, str):
        return ""
    
    # 1. Remove Newlines and Tabs (The "/n" you saw)
    text = text.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
    
    # 2. Remove Sinhala Characters (Unicode Range \u0D80-\u0DFF)
    # This regex looks for any character in the Sinhala block and removes it
    text = re.sub(r'[\u0D80-\u0DFF]+', '', text)
    
    # 3. Remove "Page Numbers" artifacts
    # PDF extractions often leave lone numbers like " 24 " or " -24- " in the middle of sentences.
    # This regex removes standalone numbers that are surrounded by spaces.
    # Be careful: This might remove "Section 5", so we only target numbers 
    # that look like loose artifacts (e.g., 1-3 digits floating alone).
    # Regex: space + 1-3 digits + space
    text = re.sub(r'\s\d{1,3}\s', ' ', text)
    
    # 4. Remove extra spaces (caused by removing the stuff above)
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def process_cleaning():
    print(f"🧹 Loading {INPUT_CSV}...")
    
    try:
        df = pd.read_csv(INPUT_CSV)
    except FileNotFoundError:
        print("❌ Error: legal_dataset.csv not found.")
        return

    original_count = len(df)
    print(f"📊 Original Row Count: {original_count}")

    # --- STEP 1: Remove Null/Empty Rows ---
    print("running... Removing empty rows...")
    df = df.dropna(subset=['text', 'label'])
    df = df[df['text'].str.strip() != ""] # Remove rows that are just whitespace

    # --- STEP 2: Remove Duplicates ---
    print("running... Removing duplicate cases...")
    # We check duplicates based on the 'text' column
    df = df.drop_duplicates(subset=['text'])

    # --- STEP 3: Deep Text Cleaning ---
    print("running... Cleaning text (removing \\n, Sinhala, page nums)...")
    df['text'] = df['text'].apply(clean_text)
    
    # Check if cleaning made any rows empty (e.g. a row was ONLY Sinhala)
    df = df[df['text'].str.strip() != ""]

    final_count = len(df)
    removed_count = original_count - final_count

    # --- STEP 4: Save ---
    print(f"💾 Saving to {OUTPUT_CSV}...")
    df.to_csv(OUTPUT_CSV, index=False)

    print("-" * 30)
    print("✅ CLEANING COMPLETE!")
    print(f"🔻 Removed {removed_count} 'junk' rows.")
    print(f"✨ Final Dataset Size: {final_count} cases.")
    print(f"👉 Upload '{OUTPUT_CSV}' to Google Colab now.")

if __name__ == "__main__":
    process_cleaning()