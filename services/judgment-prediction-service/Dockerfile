FROM python:3.9-slim

WORKDIR /app

# Install system dependencies (e.g., for psutil, git, or other libs)
# Tesseract OCR and Poppler are needed for your OCR/PDF features
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-sin \
    poppler-utils \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Expose port (FastAPI default)
EXPOSE 8000

# Run the application
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
