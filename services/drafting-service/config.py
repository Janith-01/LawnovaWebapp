import os
from pathlib import Path

from dotenv import load_dotenv


SERVICE_DIR = Path(__file__).resolve().parent
SRC_DIR = SERVICE_DIR / "src"
TEMPLATES_DIR = SERVICE_DIR / "templates"
DATASETS_DIR = SERVICE_DIR / "datasets"
OUTPUT_DIR = SERVICE_DIR / "output"
ASSETS_DIR = SERVICE_DIR / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"

load_dotenv(SERVICE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
SUPPORTED_LANGUAGES = ["en", "si"]
SUPPORTED_DOC_TYPES = ["AFFIDAVIT", "CONTRACT", "PETITION"]

REQUIRED_FIELDS = {
    "AFFIDAVIT": [
        "deponent_name",
        "deponent_nic",
        "deponent_address",
        "statement_facts",
        "date",
        "jurisdiction",
    ],
    "CONTRACT": [
        "party_a",
        "party_b",
        "contract_purpose",
        "obligations_a",
        "obligations_b",
        "payment_terms",
        "start_date",
        "end_date",
        "jurisdiction",
    ],
    "PETITION": [
        "petitioner_name",
        "petitioner_nic",
        "petitioner_address",
        "respondent_name",
        "court_name",
        "subject_matter",
        "relief_sought",
        "date",
    ],
}

FIELD_LABELS = {
    "deponent_name": {
        "en": "Name of the person making the declaration",
        "si": "ප්‍රකාශය කරන පුද්ගලයාගේ නම",
    },
    "deponent_nic": {
        "en": "NIC number of the deponent",
        "si": "ප්‍රකාශකයාගේ ජාතික හැඳුනුම්පත් අංකය",
    },
    "deponent_address": {
        "en": "Address of the deponent",
        "si": "ප්‍රකාශකයාගේ ලිපිනය",
    },
    "statement_facts": {
        "en": "Facts being declared",
        "si": "ප්‍රකාශ කරන කරුණු",
    },
    "date": {
        "en": "Date of the document",
        "si": "ලේඛනයේ දිනය",
    },
    "jurisdiction": {
        "en": "Governing jurisdiction (e.g., Colombo, Sri Lanka)",
        "si": "අදාළ අධිකරණ බල ප්‍රදේශය",
    },
    "party_a": {
        "en": "First party name",
        "si": "පළමු පාර්ශවයේ නම",
    },
    "party_b": {
        "en": "Second party name",
        "si": "දෙවන පාර්ශවයේ නම",
    },
    "contract_purpose": {
        "en": "Purpose of the contract",
        "si": "ගිවිසුමේ අරමුණ",
    },
    "obligations_a": {
        "en": "Obligations of the first party",
        "si": "පළමු පාර්ශවයේ වගකීම්",
    },
    "obligations_b": {
        "en": "Obligations of the second party",
        "si": "දෙවන පාර්ශවයේ වගකීම්",
    },
    "payment_terms": {
        "en": "Payment terms and amount",
        "si": "ගෙවීම් කොන්දේසි සහ මුදල",
    },
    "start_date": {
        "en": "Start date of the contract",
        "si": "ගිවිසුම ආරම්භ වන දිනය",
    },
    "end_date": {
        "en": "End date of the contract",
        "si": "ගිවිසුම අවසන් වන දිනය",
    },
    "petitioner_name": {
        "en": "Name of the petitioner",
        "si": "පෙත්සම්කරුගේ නම",
    },
    "petitioner_nic": {
        "en": "NIC number of the petitioner",
        "si": "පෙත්සම්කරුගේ ජාතික හැඳුනුම්පත් අංකය",
    },
    "petitioner_address": {
        "en": "Address of the petitioner",
        "si": "පෙත්සම්කරුගේ ලිපිනය",
    },
    "respondent_name": {
        "en": "Name of the respondent",
        "si": "විත්තිකරුගේ නම",
    },
    "court_name": {
        "en": "Name of the court",
        "si": "උසාවියේ නම",
    },
    "subject_matter": {
        "en": "Subject matter of the petition",
        "si": "පෙත්සමේ විෂය කරුණ",
    },
    "relief_sought": {
        "en": "Relief or outcome being requested",
        "si": "ඉල්ලා සිටින පිළියම",
    },
    "notice_period": {
        "en": "Notice period for termination",
        "si": "නිවේදන කාලය",
    },
    "validity_period": {
        "en": "Validity period of the document",
        "si": "ලේඛනයේ වලංගු කාලය",
    },
}
