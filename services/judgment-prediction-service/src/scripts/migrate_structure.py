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
    
    try:
        print("Attempting to add 'structure' column to 'documents' table...")
        cursor.execute("ALTER TABLE documents ADD COLUMN structure TEXT")
        conn.commit()
        print("Migration successful: 'structure' column added.")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
             print("Column 'structure' already exists.")
        else:
            print(f"Error migrating: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
