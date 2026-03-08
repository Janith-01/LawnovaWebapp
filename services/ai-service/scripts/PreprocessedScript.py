import json
import re

# --- CONFIGURATION ---
INPUT_FILE = '../processed_chunks.json'
OUTPUT_FILE = '../cleaned_chunks.json'

def clean_legal_text(text):
    """Removes OCR noise and common gazette headers."""
    # 1. Remove common printer/price noise using Regex
    noise_patterns = [
        r"Price\s*:\s*\d+\s*cents",
        r"Postage\s*:\s*\d+\s*cents",
        r"PRINTED AT THE DEPARTMENT OF GOVERNMENT PRINTING.*",
        r"TO BE PURCHASED AT THE GOVT\. PUBLICATIONS BUREAU.*",
        r"Published as a Supplement to Part II.*",
        r"Certified on \d+th \w+, \d{4}"
    ]
    
    for pattern in noise_patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    
    # 2. Clean up extra newlines and spaces
    text = re.sub(r'\n+', '\n', text)
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

def preprocess_data():
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        chunks = json.load(f)
    
    cleaned_data = []
    
    for item in chunks:
        # Step A: Clean the raw OCR noise
        raw_text = item['text']
        cleaned_body = clean_legal_text(raw_text)
        
        # Step B: Context Injection
        # We take the source (Act name) and put it inside the text
        # This is vital so the AI knows which law it's looking at
        act_name = item['metadata']['source'].replace('-', ' ')
        final_text = f"ACT CONTEXT: {act_name}\nCONTENT: {cleaned_body}"
        
        # Update the item
        item['text'] = final_text
        cleaned_data.append(item)
    
    # Save the cleaned version
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Cleaned and Context-Injected {len(cleaned_data)} chunks.")

if __name__ == "__main__":
    preprocess_data()