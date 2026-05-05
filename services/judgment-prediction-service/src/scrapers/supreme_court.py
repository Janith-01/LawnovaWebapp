import os
import time
import requests
import re
from datetime import datetime
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pypdf

# Import Database Manager
from src.database.db_manager import DatabaseManager

# Configuration
BASE_URL = "https://supremecourt.lk/judgements/"
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PDF_DIR = os.path.join(_PROJECT_ROOT, "data", "pdfs", "supreme_court")
MAX_PAGES = 1

class SupremeCourtScraper:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
        os.makedirs(PDF_DIR, exist_ok=True)
        self.driver = self.setup_driver()
        self.log_callback = None
        self.check_cancel_callback = None

    def set_callbacks(self, log_func, check_cancel_func):
        self.log_callback = log_func
        self.check_cancel_callback = check_cancel_func

    def log(self, message):
        print(message)
        if self.log_callback:
            self.log_callback(message)

    def check_cancel(self):
        if self.check_cancel_callback:
            return self.check_cancel_callback()
        return False

    def setup_driver(self):
        """Sets up the Selenium WebDriver in headless mode."""
        chrome_options = Options()
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        # Add a user agent to avoid being blocked
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        return webdriver.Chrome(options=chrome_options)

    def clean_text(self, text):
        """Cleans up whitespace from text."""
        if text:
            return " ".join(text.split())
        return ""

    def get_safe_filename(self, s):
        """Converts a string to a safe filename."""
        s = str(s).strip().replace(" ", "-")
        return re.sub(r'(?u)[^-\w.]', '', s)

    def extract_pdf_text(self, pdf_path):
        """Extracts text from a PDF file using pypdf."""
        text = ""
        try:
            reader = pypdf.PdfReader(pdf_path)
            for page in reader.pages:
                text += page.extract_text() or ""
        except Exception as e:
            print(f"Error extracting text from {pdf_path}: {e}")
        return text

    def download_file(self, url, dest_path):
        """Downloads a file from a URL to a destination path."""
        try:
            response = requests.get(url, stream=True, verify=False, timeout=30) # Verify false to avoid SSL issues
            if response.status_code == 200:
                with open(dest_path, 'wb') as f:
                    for chunk in response.iter_content(1024):
                        f.write(chunk)
                return True
            else:
                print(f"Failed to download {url}: Status {response.status_code}")
                return False
        except Exception as e:
            print(f"Error downloading {url}: {e}")
            return False

    def process_row(self, row_data):
        """Processes a single row of judgment data and saves to DB."""
        # Unpack data
        date_str = row_data.get('date', 'Unknown')
        case_no = row_data.get('case_no', 'Unknown')
        parties = row_data.get('parties', '')
        judge = row_data.get('judge', '')
        pdf_url = row_data.get('pdf_url', '')

        if not case_no or not pdf_url:
            self.log("Skipping row due to missing Case No or PDF URL")
            return

        # Check if already exists in DB to skip expensive PDF download
        if self.db.check_exists(pdf_url):
            self.log(f"Skipping duplicate (URL exists): {case_no}")
            return

        # Parse date
        date_decided = None
        year = None
        try:
            date_decided = datetime.strptime(date_str, "%Y-%m-%d")
            year = date_decided.year
        except ValueError:
            self.log(f"Could not parse date: {date_str}")
        
        # Create unique identifier for file storage
        safe_case_no = self.get_safe_filename(case_no.replace("/", "-"))
        doc_filename = f"{date_str}-{safe_case_no}.pdf"
        pdf_path = os.path.join(PDF_DIR, doc_filename)

        self.log(f"Processing: {case_no} | Date: {date_str}")

        # Download PDF
        extracted_text = ""
        if self.download_file(pdf_url, pdf_path):
            # Extract Text
            extracted_text = self.extract_pdf_text(pdf_path)
        else:
            self.log(f"Failed to download PDF for {case_no}")
            # We might still want to save metadata even if PDF fails, or skip. 
            # Letting it proceed with empty text for now.

        # Prepare DB Record
        doc_record = {
            "source_url": pdf_url,
            "doc_type": "JUDGMENT",
            "court": "Supreme Court",
            "year": year,
            "case_number": case_no,
            "date_decided": date_decided,
            "title": f"{parties} (Judge: {judge})", # Storing parties/judge info in title/misc
            "raw_text": extracted_text,
            "s3_key": pdf_path # Storing local path for now
        }

        # Save to DB
        try:
            self.db.save_document(doc_record)
            self.log(f"Saved to DB: {case_no}")
        except Exception as e:
            self.log(f"Error saving to DB: {e}")

    def get_online_count(self):
        """
        Navigates to the page and extracts the total number of entries
        from the dataTable info text (e.g. 'Showing 1 to 10 of 1,532 entries').
        """
        try:
            self.log("Connecting to Supreme Court archive...")
            self.driver.get(BASE_URL)
            
            # Wait for table info to appear
            # Often .dataTables_info contains "Showing X to Y of Z entries"
            self.log("Waiting for data table to load...")
            element = WebDriverWait(self.driver, 20).until(
                 EC.presence_of_element_located((By.CLASS_NAME, "dataTables_info"))
            )
            text = element.text
            self.log(f"Found info text: {text}")

            # Extract number after "of"
            match = re.search(r'of\s+([\d,]+)', text)
            if match:
                count_str = match.group(1).replace(',', '')
                val = int(count_str)
                self.log(f"Parsed total count: {val}")
                return val
            return 0
        except Exception as e:
            self.log(f"Error fetching online count: {e}")
            return 0
        finally:
            self.driver.quit()

    def scrape(self, max_pages: int = MAX_PAGES):
        self.driver.get(BASE_URL)
        page_num = 1

        try:
            # Wait for table to load
            WebDriverWait(self.driver, 20).until(
                 EC.presence_of_element_located((By.CSS_SELECTOR, "table tbody tr"))
            )
            
            while True:
                if self.check_cancel():
                    self.log("Scraping cancelled by user.")
                    break

                if max_pages and page_num > max_pages:
                    self.log(f"Reached max pages ({max_pages}). Stopping.")
                    break
                
                # Ensure the table body actually has rows
                time.sleep(2) # Brief pause to ensure rendering
                    
                self.log(f"Scraping Page {page_num}...")
                
                soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                
                # Find the correct table
                tables = soup.find_all('table')
                target_table = None
                for t in tables:
                    tbody = t.find('tbody')
                    if tbody and tbody.find_all('tr'):
                         target_table = t
                         break
                
                if not target_table:
                    self.log("No table with data found!")
                    break
                
                table = target_table
                tbody = table.find('tbody')
                rows = tbody.find_all('tr')
                
                if not rows:
                    self.log("No rows found in table body!")
                    break
                
                for row in rows:
                    if self.check_cancel():
                        self.log("Scraping cancelled by user.")
                        break

                    cols = row.find_all('td')
                    if len(cols) < 5:
                        continue
                    
                    date_val = self.clean_text(cols[0].text)
                    case_val = self.clean_text(cols[1].text)
                    parties_val = self.clean_text(cols[2].text)
                    judge_val = self.clean_text(cols[3].text)
                    
                    pdf_link_elem = cols[4].find('a')
                    if not pdf_link_elem:
                         # Try searching in other cols
                         for c in cols:
                             found = c.find('a')
                             if found and 'pdf' in found.get('href', '').lower():
                                 pdf_link_elem = found
                                 break
                    
                    pdf_val = pdf_link_elem['href'] if pdf_link_elem else None
                    
                    row_data = {
                        'date': date_val,
                        'case_no': case_val,
                        'parties': parties_val,
                        'judge': judge_val,
                        'pdf_url': pdf_val
                    }
                    
                    self.process_row(row_data)

                if self.check_cancel():
                    break

                # Pagination
                try:
                    next_btn = self.driver.find_element(By.CSS_SELECTOR, ".dataTables_paginate .next")
                    
                    if "disabled" in next_btn.get_attribute("class"):
                        self.log("Reached last page.")
                        break
                    
                    self.driver.execute_script("arguments[0].click();", next_btn)
                    time.sleep(3) 
                    page_num += 1
                    
                except Exception as e:
                    self.log(f"Pagination error or end of list: {e}")
                    break
                    
        except Exception as e:
            self.log(f"An error occurred: {e}")
        finally:
            self.driver.quit()

if __name__ == "__main__":
    db = DatabaseManager()
    scraper = SupremeCourtScraper(db)
    # scraper.scrape()
    print(f"Online Count: {scraper.get_online_count()}")
