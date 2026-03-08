import os
import pytesseract
from pdf2image import convert_from_path
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Configuration
DATASET_PATH = '../../roleplay-service/dataset/lk_act_data/data'
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=150,
    separators=["\n\n", "\n", "Section", "Article", " ", ""]
)

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def perform_ocr(pdf_path):
    """Fallback: Convert PDF to text if .txt is empty"""
    poppler_bin_path = r'C:\Users\janit\Downloads\confirmation letter\poppler-25.12.0\Library\bin' 
    
    pages = convert_from_path(
        pdf_path, 
        300, 
        poppler_path=poppler_bin_path
    ) 
    
    full_text = ""
    for page in pages:
        full_text += pytesseract.image_to_string(page) + "\n"
    return full_text

processed_chunks = []

for root, dirs, files in os.walk(DATASET_PATH):
    txt_path = os.path.join(root, 'doc.txt')
    pdf_path = os.path.join(root, 'doc.pdf')
    
    # Try to read the text file first
    text = ""
    if os.path.exists(txt_path):
        with open(txt_path, 'r', encoding='utf-8') as f:
            text = f.read().strip()
            
    # FALLBACK: If empty, use OCR on the PDF
    if not text and os.path.exists(pdf_path):
        print(f"Running OCR on {os.path.basename(root)} (This might take a while...)")
        text = perform_ocr(pdf_path)
    
    if text:
        chunks = text_splitter.split_text(text)
        for i, chunk in enumerate(chunks):
            processed_chunks.append({
                "id": f"{os.path.basename(root)}_{i}",
                "text": chunk,
                "metadata": {"source": os.path.basename(root)}
            })
        print(f"Processed {os.path.basename(root)} -> {len(chunks)} chunks.")

print(f"Total chunks created: {len(processed_chunks)}")