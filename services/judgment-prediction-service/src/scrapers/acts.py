import os
import requests
import re
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime
from src.database.db_manager import DatabaseManager

# Configuration
BASE_URL = "https://documents.gov.lk/view/act/"
MAIN_PAGE = "https://documents.gov.lk/view/act/acts.html"
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PDF_DIR = os.path.join(_PROJECT_ROOT, "data", "pdfs", "acts")

# Verify False Warnings Suppression
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

from src.processing.acts_metadata import ActMetadataExtractor

class ActsScraper:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
        self.meta_extractor = ActMetadataExtractor()
        self.log_callback = None
        self.check_cancel_callback = None
        os.makedirs(PDF_DIR, exist_ok=True)

    def set_callbacks(self, log_callback, check_cancel_callback):
        self.log_callback = log_callback
        self.check_cancel_callback = check_cancel_callback

    def log(self, message):
        if self.log_callback:
            self.log_callback(message)
        else:
            logger.info(message)

    def check_cancellation(self):
        if self.check_cancel_callback and self.check_cancel_callback():
            self.log("Cancellation requested by user.")
            raise Exception("Cancelled by user")

    def get_online_count(self):
        """
        Deep Scan: Iterates through recent years (or all) to count total available acts.
        """
        self.log("Starting Deep Scan for Acts... This relies on page traversal.")
        total_acts = 0
        try:
            years = self.get_available_years()
            self.log(f"Found {len(years)} year archives.")
            
            for i, year in enumerate(years):
                self.check_cancellation()
                url = f"{BASE_URL}acts_{year}.html"
                try:
                    self.log(f"Scanning {year} ({i+1}/{len(years)})... Found so far: {total_acts}")
                    response = requests.get(url, verify=False, timeout=10)
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.content, 'html.parser')
                        rows = soup.select('table tbody tr')
                        valid_rows = 0
                        for row in rows:
                            if len(row.select('td')) >= 4:
                                valid_rows += 1
                        total_acts += valid_rows
                except Exception as e:
                    self.log(f"Error scanning {year}: {e}")
            
            self.log(f"Deep Scan Completed. Total Acts: {total_acts}")
            return total_acts
        except Exception as e:
            self.log(f"Deep Scan Failed: {e}")
            return 0

    def get_available_years(self):
        """Parses individual year links from the main page."""
        self.log(f"Fetching main page: {MAIN_PAGE}")
        try:
            response = requests.get(MAIN_PAGE, verify=False, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            years = set()
            # Search all links, not just btn-primary
            for link in soup.find_all('a', href=True):
                href = link.get('href')
                if 'acts_' in href and href.endswith('.html'):
                    try:
                        # expected format: acts_2024.html
                        # extract numbers
                        match = re.search(r'acts_(\d{4})', href)
                        if match:
                            years.add(int(match.group(1)))
                    except Exception:
                        pass
            
            sorted_years = sorted(list(years), reverse=True)
            self.log(f"Found {len(sorted_years)} years: {sorted_years}")
            return sorted_years
        except Exception as e:
            self.log(f"Error fetching main page: {e}")
            return []

    def download_file(self, url, folder):
        if not url:
            return None
        
        try:
            filename = url.split('/')[-1]
            filepath = os.path.join(folder, filename)
            
            if os.path.exists(filepath):
                return filepath
            
            # self.log(f"Downloading {filename}...")
            response = requests.get(url, stream=True, verify=False, timeout=30)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return filepath
        except Exception as e:
            logger.warning(f"Failed to download {url}: {e}")
            return None

    def scrape_year(self, year):
        self.check_cancellation()
        url = f"{BASE_URL}acts_{year}.html"
        self.log(f"Scraping year {year}...")
        
        try:
            response = requests.get(url, verify=False, timeout=20)
            if response.status_code == 404:
                 self.log(f"Page not found for year {year}")
                 return
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            rows = soup.select('table tbody tr')
            # self.log(f"Found {len(rows)} acts for {year}")

            processed_count = 0
            for row in rows:
                self.check_cancellation()
                cols = row.select('td')
                if len(cols) < 4:
                    continue
                
                try:
                    act_no = cols[0].get_text(strip=True)
                    date_str = cols[1].get_text(strip=True)
                    title = cols[2].get_text(strip=True)
                    
                    # Extract Download Links
                    download_col = cols[3]
                    english_pdf = None
                    sinhala_pdf = None
                    
                    links = download_col.select('a')
                    for link in links:
                        btn = link.find('button')
                        href = link.get('href')
                        if not href or not btn:
                            continue
                        
                        full_link = urljoin(url, href)
                        classes = btn.get('class', [])
                        
                        if 'btn-primary' in classes: 
                            english_pdf = full_link
                        elif 'btn-secondary' in classes:
                            sinhala_pdf = full_link

                    # Priorities English, then Sinhala
                    target_url = english_pdf if english_pdf else sinhala_pdf
                    if not target_url:
                        continue
                    
                    if self.db.check_exists(target_url):
                        continue

                    # Download
                    year_dir = os.path.join(PDF_DIR, str(year))
                    os.makedirs(year_dir, exist_ok=True)
                    
                    local_path = self.download_file(target_url, year_dir)
                    
                    # Parse Metadata
                    meta_info = self.meta_extractor.extract_from_title(title)
                    
                    # Save to DB
                    act_meta = {
                        "act_name": title,
                        "act_number": act_no,
                        "enactment_year": year,
                        "is_amendment": meta_info['is_amendment'],
                        "parent_act_key": meta_info['parent_act_key']
                    }
                    
                    doc_data = {
                        "source_url": target_url,
                        "doc_type": "ACT",
                        "court": None,
                        "year": year,
                        "case_number": f"Act {act_no} of {year}", # Virtual case number
                        "date_decided": None,
                        "title": title,
                        "s3_key": local_path
                    }
                    
                    # Try to parse date
                    if date_str:
                        try:
                            # Try common formats
                            for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y"):
                                try:
                                    doc_data["date_decided"] = datetime.strptime(date_str, fmt).date()
                                    break
                                except ValueError:
                                    continue
                        except Exception:
                            pass
                    
                    self.db.save_document(doc_data, act_data=act_meta)
                    processed_count += 1
                    
                except Exception as e:
                    logger.error(f"Error processing row: {e}")
            
            if processed_count > 0:
                self.log(f"Saved {processed_count} new acts for {year}.")

        except Exception as e:
            self.log(f"Error scraping year {year}: {e}")

    def scrape(self, years_to_scrape: list = None, max_years: int = 0):
        if not years_to_scrape:
            self.log("Fetching available years...")
            years_to_scrape = self.get_available_years()
            
            if not years_to_scrape:
                self.log("No years found.")
                return
            
            # Apply limit if specified
            if max_years and max_years > 0:
                self.log(f"Auto-detected {len(years_to_scrape)} years. Syncing most recent {max_years} years.")
                years_to_scrape = years_to_scrape[:max_years]
            else:
                self.log(f"Auto-detected {len(years_to_scrape)} years. Syncing ALL years.")

        self.log(f"Starting sync for years: {years_to_scrape}")
        for year in years_to_scrape:
            self.scrape_year(year)
        self.log("Sync completed.")

if __name__ == "__main__":
    db = DatabaseManager()
    scraper = ActsScraper(db)
    scraper.scrape()
