from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Generic, TypeVar

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    total_pages: int

class DocumentResponse(BaseModel):
    id: int
    source_url: str
    doc_type: str
    court: Optional[str] = None
    year: Optional[int] = None
    case_number: Optional[str] = None
    date_decided: Optional[datetime] = None
    title: Optional[str] = None
    
    # OCR Fields
    is_ocr_completed: Optional[bool] = False
    ocr_completed_at: Optional[datetime] = None
    language: Optional[str] = None
    # raw_text: Optional[str] = None # Maybe too large for list view?
    
    class Config:
        from_attributes = True # Pydantic v2 equivalent of orm_mode = True


class PredictionRequest(BaseModel):
    text: str


class CaseNumberRequest(BaseModel):
    case_number: str


class PredictionWithExplanationRequest(BaseModel):
    text: str
    case_number: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    limit: int = 5
