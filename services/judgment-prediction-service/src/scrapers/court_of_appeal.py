import os
import time
import requests
import pdfplumber
import logging
import re
from urllib.parse import urlparse, parse_qs
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from src.database.db_manager import DatabaseManager
from datetime import datetime

# Configuration
BASE_URL = "https://courtofappeal.lk/"
PDF_DIR = "data/pdfs/court_of_appeal"

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CourtOfAppealScraper:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
        os.makedirs(PDF_DIR, exist_ok=True)
        self.driver = self.setup_driver()
        self.log_callback = None
        self.check_cancel_callback = None

        # Regex patterns from user suggestion / generalized
        self.case_pattern = re.compile(
            r"(CA|Court of Appeal|Writ|Appeal|H\.C\.?|H\.C\.?A\.?)\s?/?\s?(\d{1,4}/\d{2,4})",
            re.IGNORECASE
        )

    def set_callbacks(self, log_func, check_cancel_func):
        self.log_callback = log_func
        self.check_cancel_callback = check_cancel_func

    def _parse_date(self, date_str):
        if not date_str: return None
        try:
            # Normalize separators
            clean_str = re.sub(r'[-/.]', '-', date_str)
            return datetime.strptime(clean_str, "%Y-%m-%d")
        except ValueError:
            return None

    def log(self, message):
        logger.info(message)
        if self.log_callback:
            self.log_callback(message)

    def check_cancel(self):
        if self.check_cancel_callback:
            return self.check_cancel_callback()
        return False

    def setup_driver(self):
        """Sets up the Selenium WebDriver with resilience options."""
        options = webdriver.ChromeOptions()
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_argument("--log-level=3")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--blink-settings=imagesEnabled=false") # Disable images for speed
        options.page_load_strategy = 'eager' 
        
        # Selenium 4.6+ uses built-in Selenium Manager to auto-download correct ChromeDriver
        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(90) # Increased to 90s
        driver.set_script_timeout(90)
        return driver

    def get_links(self):
        """Uses Selenium to recursively find all Month pages in the menu."""
        self.log("Navigating to home page to extract links...")
        
        for attempt in range(3):
            try:
                self.driver.get(BASE_URL)
                WebDriverWait(self.driver, 30).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                break # Success
            except Exception as e:
                self.log(f"Attempt {attempt+1}/3 failed to load home page: {e}")
                if attempt == 2:
                    return []
                time.sleep(5)
                # Restart driver on failure to clear bad state
                try: self.driver.quit()
                except: pass
                self.driver = self.setup_driver()

        # JS traversal logic (proven to work)
        links = self.driver.execute_script("""
            const links = [];
            const clean = t => t ? t.textContent.trim() : '';
            const allAnchors = Array.from(document.querySelectorAll('a'));
            const judgmentsLink = allAnchors.find(a => clean(a).toUpperCase() === 'JUDGMENTS');
            if (!judgmentsLink) return [];
            
            const rootLi = judgmentsLink.closest('li');
            if (!rootLi) return [];

            function extractLinksFromUl(ulElement) {
                const results = [];
                const listItems = ulElement.children; 
                for (let li of listItems) {
                    const anchor = li.querySelector('a');
                    if (!anchor) continue;
                    const text = clean(anchor);
                    const href = anchor.href;
                    const subMenu = li.querySelector('ul.sub-menu');
                    if (subMenu) {
                        results.push(...extractLinksFromUl(subMenu));
                    } else {
                        if (href && !href.includes('#') && !href.startsWith('javascript')) {
                            results.push({ text: text, href: href });
                        }
                    }
                }
                return results;
            }

            const mainSubMenu = rootLi.querySelector('ul.sub-menu');
            if (mainSubMenu) {
                links.push(...extractLinksFromUl(mainSubMenu));
            }
            
            const unique = [];
            const seen = new Set();
            for (const l of links) {
                if (!seen.has(l.href)) {
                    seen.add(l.href);
                    unique.push(l);
                }
            }
            return unique;
        """)
        self.log(f"Found {len(links)} month pages.")
        return links

    def get_online_count(self):
        """
        Iterates through ALL month pages to count total documents.
        This provides a true 'Total Documents' count as requested.
        """
        total_docs = 0
        try:
            self.log("Connecting to Court of Appeal archives...")
            links = self.get_links()
            total_months = len(links)
            self.log(f"Found {total_months} month folders. Starting deep scan...")
            
            for index, link in enumerate(links):
                if self.check_cancel(): break
                
                try:
                    # Navigate to month page
                    self.driver.get(link['href'])
                    
                    # Wait briefly for render
                    try:
                        WebDriverWait(self.driver, 5).until(
                            lambda d: len(d.find_elements(By.TAG_NAME, "a")) > 20
                        )
                    except: pass

                    # Count 'melsta' or pdf links
                    soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                    anchors = soup.find_all('a', href=True)
                    page_count = 0
                    for a in anchors:
                        href = a['href']
                        if 'melsta_doc_download' in href or href.lower().endswith('.pdf'):
                            page_count += 1
                    
                    total_docs += page_count
                    self.log(f"Scanned {index+1}/{total_months} ({link['text']}): Found {page_count}. Total: {total_docs}")
                    
                except Exception as e:
                    self.log(f"Failed to scan {link['text']}: {e}")
                    # Refresh driver just in case
                    try: 
                        self.driver.quit()
                        self.driver = self.setup_driver()
                    except: pass

            self.log(f"Scan complete. Total Documents: {total_docs}")
            return total_docs
            
        except Exception as e:
            self.log(f"Error checking stats: {e}")
            return total_docs # Return whatever we found

    def parse_metadata_from_link(self, url, text_context):
        """
        Extracts metadata from the URL (filename param) or surrounding text.
        """
        meta = {
            "case_no": "Unknown",
            "year": None,
            "filename": None,
            "date": None
        }

        # 1. Parse URL params
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        
        filename = params.get('filename', [None])[0]
        if filename:
            meta['filename'] = filename
            # Try to grab Case No from filename
            # e.g. "CA-Writ-48-2018.pdf"
            name_only = filename.replace('.pdf', '').replace('_', ' ').replace('-', ' ')
            meta['case_no'] = name_only # Default to cleaned filename
            
            # refined regex search
            match = self.case_pattern.search(name_only)
            if match:
                 meta['case_no'] = match.group(0)

        # 2. Try to find date in text context
        # (Naive: look for YYYY-MM-DD or similar)
        date_match = re.search(r'\d{4}[-/.]\d{2}[-/.]\d{2}', text_context)
        if date_match:
            meta['date'] = date_match.group(0)
        else:
             # Fallback: try to find Year in text or URL
             year_match = re.search(r'20\d{2}', text_context + " " + (filename or ""))
             if year_match:
                 meta['year'] = int(year_match.group(0))
        
        return meta

    def download_pdf(self, url, save_path):
        try:
            response = requests.get(url, stream=True, verify=False, timeout=60)
            if response.status_code == 200:
                with open(save_path, 'wb') as f:
                    for chunk in response.iter_content(1024):
                        f.write(chunk)
                return True
        except Exception as e:
            logger.error(f"Download failed {url}: {e}")
        return False

    def scrape(self, max_pages: int = None):
        try:
            month_links = self.get_links()
            pages_processed = 0
            
            for link in month_links:
                if self.check_cancel(): break
                if max_pages and pages_processed >= max_pages: break

                self.log(f"Scraping Page: {link['text']} ({link['href']})")
                
                # Resilient Navigation
                try:
                    self.driver.get(link['href'])
                except Exception as e:
                    self.log(f"Timeout on {link['href']}. restarting driver...")
                    try: self.driver.quit()
                    except: pass
                    self.driver = self.setup_driver()
                    continue

                # Wait for content or "No Data"
                try:
                    # Wait for any links to appear (hydration)
                    WebDriverWait(self.driver, 10).until(
                        lambda d: "No Data Available" in d.page_source or len(d.find_elements(By.TAG_NAME, "a")) > 20
                    )
                except:
                    pass # Just proceed to parse what we have

                # Parse with BeautifulSoup (Hybrid Approach)
                soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                
                # Find all download links
                # Strategy: href contains 'melsta_doc_download' OR ends with .pdf
                anchors = soup.find_all('a', href=True)
                doc_links = []
                
                for a in anchors:
                    href = a['href']
                    full_url = href if href.startswith('http') else BASE_URL.rstrip('/') + href
                    
                    if 'melsta_doc_download' in href or href.lower().endswith('.pdf'):
                        # Get row context (parent tr) if possible
                        row_text = ""
                        parent_tr = a.find_parent('tr')
                        if parent_tr:
                            row_text = parent_tr.get_text(" ", strip=True)
                        
                        doc_links.append((full_url, row_text))
                
                self.log(f"Found {len(doc_links)} documents.")

                for url, context_text in doc_links:
                    if self.check_cancel(): break
                    
                    if self.db.check_exists(url):
                        continue
                        
                    meta = self.parse_metadata_from_link(url, context_text)
                    
                    # Generate safe filename
                    safe_name = meta['filename'] or f"doc_{int(time.time())}.pdf"
                    pdf_path = os.path.join(PDF_DIR, safe_name)
                    
                    self.log(f"Processing: {meta['case_no']}")
                    
                    extracted_text = ""
                    if self.download_pdf(url, pdf_path):
                        # Simple extraction
                        try:
                            with pdfplumber.open(pdf_path) as pdf:
                                extracted_text = "\n".join([p.extract_text() or "" for p in pdf.pages])
                        except:
                            pass
                        
                        # Save
                        doc_record = {
                            "source_url": url,
                            "doc_type": "JUDGMENT",
                            "court": "Court of Appeal",
                            "year": meta['year'],
                            "case_number": meta['case_no'],
                            "date_decided": self._parse_date(meta['date']) if meta['date'] else datetime.now(),
                            "title": context_text[:200], # Store row text as title helper
                            "raw_text": extracted_text,
                            "s3_key": pdf_path
                        }
                        self.db.save_document(doc_record)
                
                pages_processed += 1
                time.sleep(1)

        finally:
            self.driver.quit()
