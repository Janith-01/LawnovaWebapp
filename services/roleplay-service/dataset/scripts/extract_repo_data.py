import os
import json

# --- CONFIGURATION ---
# The root folder where the data starts (based on your log output)
SOURCE_ROOT = os.path.join("lk_supreme_court_judgements", "data", "lk_supreme_court_judgements")
OUTPUT_FILE = "lk_supreme_court_judgements.jsonl"

def create_recursive_jsonl():
    print(f"🚀 Starting Deep Scan in: {SOURCE_ROOT}")
    
    if not os.path.exists(SOURCE_ROOT):
        print(f"❌ Error: Root folder not found: {SOURCE_ROOT}")
        return

    count = 0
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        # os.walk goes into every subfolder automatically
        for root, dirs, files in os.walk(SOURCE_ROOT):
            
            # We specifically look for 'doc.json' as seen in your logs
            if "doc.json" in files:
                file_path = os.path.join(root, "doc.json")
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as infile:
                        data = json.load(infile)
                    
                    # Add the filename/case ID to the data so you know which case it is
                    # The folder name usually contains the case ID (e.g., 2025-05-30-SC-APPEAL...)
                    case_id = os.path.basename(root)
                    data['case_id'] = case_id
                    
                    # Write to the big file
                    json.dump(data, outfile, ensure_ascii=False)
                    outfile.write('\n')
                    
                    count += 1
                    
                    if count % 100 == 0:
                        print(f"   Collected {count} cases...", end='\r')
                        
                except Exception as e:
                    print(f"\n⚠️  Error reading {file_path}: {e}")

    print(f"\n\n✅ Success! Created {OUTPUT_FILE}")
    print(f"📊 Total Cases Compiled: {count}")

if __name__ == "__main__":
    create_recursive_jsonl()
