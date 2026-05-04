import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base, Document, ActMetadata

class DatabaseManager:
    def __init__(self, db_url=None):
        # Allow override via env while keeping current default behavior.
        if db_url is None:
            db_url = os.getenv("JUDGMENT_DB_URL", "sqlite:///data/lawnowa.db")

        # Ensure SQLite directory exists before opening/creating DB file.
        if db_url.startswith("sqlite:///"):
            sqlite_path = db_url.replace("sqlite:///", "", 1)
            db_dir = os.path.dirname(sqlite_path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)

        self.engine = create_engine(db_url)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    @contextmanager
    def session_scope(self):
        """Provide a transactional scope around a series of operations."""
        session = self.Session()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def save_document(self, doc_data: dict, act_data: dict = None):
        """
        Save or update a document. Checks for duplicates based on source_url.
        """
        with self.session_scope() as session:
            # Check if exists by URL
            existing_doc = session.query(Document).filter_by(source_url=doc_data['source_url']).first()
            
            if existing_doc:
                # Update existing fields
                for key, value in doc_data.items():
                    setattr(existing_doc, key, value)
                doc = existing_doc
            else:
                # Create new
                doc = Document(**doc_data)
                session.add(doc)
                session.flush() # Flush to get ID if needed
            
            # Handle Act Metadata if provided
            if act_data:
                if doc.act_metadata:
                    for key, value in act_data.items():
                        setattr(doc.act_metadata, key, value)
                else:
                    act_meta = ActMetadata(**act_data)
                    doc.act_metadata = act_meta
            
            return doc.id

    def check_exists(self, source_url):
        with self.session_scope() as session:
             return session.query(Document).filter_by(source_url=source_url).count() > 0
