import os
import json

# We will look at the specific case you found empty
target_case = "2017-09-14-SC-CHC-APPEAL-18-2008"
root_folder = os.path.join("lk_supreme_court_judgements", "data", "lk_supreme_court_judgements")

def find_and_print_block():
    print(f"🔍 Searching for case: {target_case}...")
    
    for root, dirs, files in os.walk(root_folder):
        if target_case in root and "blocks.json" in files:
            file_path = os.path.join(root, "blocks.json")
            print(f"📂 Found file: {file_path}\n")
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    # Print the first 5 items to see the structure
                    print("--- RAW DATA PREVIEW (First 5 items) ---")
                    print(json.dumps(data[:5], indent=2, ensure_ascii=False))
                    print("\n----------------------------------------")
                    
                    # Check what keys exist if it's a dictionary list
                    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                        print(f"🔑 Keys found in first block: {list(data[0].keys())}")
                        
            except Exception as e:
                print(f"❌ Error reading file: {e}")
            return

    print("❌ Could not find that specific case folder.")

if __name__ == "__main__":
    find_and_print_block()