import os
import shutil
import logging
import pytesseract
from pdf2image import convert_from_path
from PIL import Image

logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self, tesseract_cmd=None, poppler_path=None):
        self._configure_tesseract(tesseract_cmd)
        self.poppler_path = self._find_poppler(poppler_path)
        
    def _configure_tesseract(self, tesseract_cmd):
        """Find and configure Tesseract executable."""
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
            return

        # Attempt automatic discovery
        cmd = shutil.which('tesseract')
        if not cmd:
            # Common Windows default
            possible_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            if os.path.exists(possible_path):
                cmd = possible_path
        
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
            logger.info(f"Tesseract found at: {cmd}")
        else:
            logger.warning("Tesseract not found in PATH or standard locations.")

    def _find_poppler(self, provided_path):
        """Find Poppler bin directory."""
        if provided_path and os.path.exists(provided_path):
            return provided_path
            
        if shutil.which("pdftoppm"):
            return None # In PATH
            
        # Check local 'poppler' folder relative to this file or project root
        # Strategy: Look in project_root/poppler or current_dir/poppler
        candidates = [
            os.path.join(os.getcwd(), "poppler"),
            os.path.join(os.path.dirname(__file__), "poppler")
        ]
        
        for base in candidates:
            if os.path.exists(base):
                bin_path = os.path.join(base, "bin")
                if os.path.exists(bin_path):
                    return bin_path
                # Or maybe strictly in base
                if "pdftoppm.exe" in os.listdir(base):
                    return base
                    
        return None

    def extract_text(self, pdf_path: str, lang='sin+eng', log_callback=None, check_cancel=None) -> str:
        """
        Convert PDF to images and perform OCR.
        """
        if not os.path.exists(pdf_path):
            logger.error(f"PDF not found: {pdf_path}")
            return None

        logger.info(f"OCR Processing: {pdf_path}")
        if log_callback: log_callback(f"Starting OCR for: {os.path.basename(pdf_path)}")
        
        try:
            if log_callback: log_callback("Converting PDF to images...")
            images = convert_from_path(pdf_path, dpi=300, poppler_path=self.poppler_path)
            if log_callback: log_callback(f"Converted {len(images)} pages.")
        except Exception as e:
            logger.error(f"PDF to Image conversion failed: {e}. Check Poppler.")
            if log_callback: log_callback(f"Error converting PDF: {e}")
            return None

        extracted_text = ""
        total = len(images)
        
        for i, image in enumerate(images):
            # Check cancellation
            if check_cancel and check_cancel():
                if log_callback: log_callback("OCR Cancelled by user.")
                return None

            if log_callback: log_callback(f"Processing Page {i+1}/{total}...")

            # Preprocessing (Grayscale + Threshold)
            image = image.convert('L')
            image = image.point(lambda x: 0 if x < 128 else 255, '1')
            
            try:
                page_text = pytesseract.image_to_string(image, lang=lang)
                extracted_text += f"\n\n--- Page {i + 1} ---\n\n"
                extracted_text += page_text
            except pytesseract.TesseractError as e:
                logger.error(f"Tesseract error on page {i+1}: {e}")
                if log_callback: log_callback(f"Tesseract Error on page {i+1}: {e}")
                break
                
        return extracted_text
