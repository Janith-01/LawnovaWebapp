from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, UniqueConstraint, Enum, Boolean
from sqlalchemy.orm import declarative_base, relationship
import enum

Base = declarative_base()

class JobStatus(enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    CANCELLED = "CANCELLED"

class Job(Base):
    __tablename__ = 'jobs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_type = Column(String, nullable=False) # e.g. 'SCRAPE_SUPREME_COURT'
    status = Column(String, default=JobStatus.PENDING.value)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    result = Column(Text, nullable=True) # JSON or text summary
    error = Column(Text, nullable=True)
    logs = Column(Text, nullable=True) # Real-time logs

    def __repr__(self):
        return f"<Job(id={self.id}, type='{self.job_type}', status='{self.status}')>"

class Document(Base):
    __tablename__ = 'documents'

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_url = Column(String, nullable=False, unique=True)
    file_hash_sha256 = Column(String, unique=True, nullable=True)
    doc_type = Column(String, nullable=False)  # 'JUDGMENT', 'ACT'
    court = Column(String, nullable=True) # 'Supreme Court', 'Court of Appeal', 'None' (for Acts)
    year = Column(Integer, nullable=True)
    
    # Metadata fields
    case_number = Column(String, nullable=True)
    date_decided = Column(DateTime, nullable=True)
    title = Column(String, nullable=True) # For Acts or Appeals
    
    raw_text = Column(Text, nullable=True) # OCR text
    
    # OCR Status Fields
    is_ocr_completed = Column(Boolean, default=False)
    ocr_completed_at = Column(DateTime, nullable=True)
    language = Column(String, nullable=True) # 'SINHALA', 'ENGLISH', 'TAMIL', 'MIXED'

    structure = Column(Text, nullable=True) # JSON String for segmented struct
    s3_key = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship for Acts specific metadata (if needed)
    act_metadata = relationship("ActMetadata", uselist=False, back_populates="document")

    def __repr__(self):
        return f"<Document(id={self.id}, doc_type='{self.doc_type}', source='{self.source_url}')>"

class ActMetadata(Base):
    __tablename__ = 'act_metadata'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey('documents.id'), unique=True)
    act_name = Column(String, nullable=False)
    act_number = Column(String, nullable=True)
    enactment_year = Column(Integer, nullable=True)
    is_amendment = Column(Integer, default=0) # Boolean or 0/1
    parent_act_key = Column(String, nullable=True) # Key to group Principal + Amendments
    
    document = relationship("Document", back_populates="act_metadata")

class JudgmentMetadata(Base):
    __tablename__ = 'judgment_metadata'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey('documents.id'), unique=True)
    
    # Extracted Fields
    presiding_judge = Column(String, nullable=True)
    other_judges = Column(Text, nullable=True) # Comma-separated
    
    counsel_petitioner = Column(Text, nullable=True)
    counsel_respondent = Column(Text, nullable=True)
    
    # Feature Engineering Fields
    outcome = Column(String, nullable=True) # ALLOWED, DISMISSED, OTHER
    citations = Column(Text, nullable=True) # JSON list of citations
    
    keywords = Column(Text, nullable=True)
    
    document = relationship("Document", back_populates="judgment_metadata")

# Add the back_populates to Document as well
Document.judgment_metadata = relationship("JudgmentMetadata", uselist=False, back_populates="document")
