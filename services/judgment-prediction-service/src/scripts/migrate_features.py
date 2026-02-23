import sys
import os
import sqlite3

# Add project root to path
sys.path.append(os.getcwd())

def migrate():
    db_path = "lawnowa.db"
    
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    columns = [
        ("outcome", "TEXT"),
        ("citations", "TEXT")
    ]
    
    for col_name, col_type in columns:
        try:
            print(f"Attempting to add '{col_name}' column to 'judgment_metadata' table...")
            cursor.execute(f"ALTER TABLE judgment_metadata ADD COLUMN {col_name} {col_type}")
            conn.commit()
            print(f"Migration successful: '{col_name}' column added.")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e):
                 print(f"Column '{col_name}' already exists.")
            else:
                print(f"Error migrating '{col_name}': {e}")
                
    conn.close()

if __name__ == "__main__":
    migrate()
