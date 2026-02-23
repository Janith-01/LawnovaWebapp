import sqlite3
import os

DB_PATH = "data/lawnowa.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found, nothing to migrate (it will be created fresh).")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Attempting to add 'logs' column to 'jobs' table...")
        cursor.execute("ALTER TABLE jobs ADD COLUMN logs TEXT")
        print("Success: Column 'logs' added.")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
            print("Column 'logs' already exists.")
        else:
            print(f"Error adding column: {e}")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
