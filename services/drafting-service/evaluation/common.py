from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
SERVICE_ROOT = BASE_DIR.parent
DATASETS_DIR = SERVICE_ROOT / "datasets"
RESULTS_DIR = BASE_DIR / "results"

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))


REQUIRED_DATASET_FILES = {
    "ner_extraction": [
        DATASETS_DIR / "ner_english" / "affidavit_ner.json",
        DATASETS_DIR / "ner_english" / "contract_ner.json",
        DATASETS_DIR / "ner_english" / "petition_ner.json",
    ],
    "gemini_extraction": [
        DATASETS_DIR / "sinhala_extraction" / "affidavit_si.json",
        DATASETS_DIR / "sinhala_extraction" / "contract_si.json",
        DATASETS_DIR / "sinhala_extraction" / "petition_si.json",
    ],
    "validation": [
        DATASETS_DIR / "validation" / "affidavit_validation.json",
        DATASETS_DIR / "validation" / "contract_validation.json",
        DATASETS_DIR / "validation" / "petition_validation.json",
    ],
    "drafting_quality": [
        DATASETS_DIR / "draft_pairs" / "affidavit_drafts.json",
        DATASETS_DIR / "draft_pairs" / "contract_drafts.json",
        DATASETS_DIR / "draft_pairs" / "petition_drafts.json",
    ],
}


DOC_TYPE_BY_STEM = {
    "affidavit_ner": "AFFIDAVIT",
    "contract_ner": "CONTRACT",
    "petition_ner": "PETITION",
    "affidavit_si": "AFFIDAVIT",
    "contract_si": "CONTRACT",
    "petition_si": "PETITION",
    "affidavit_validation": "AFFIDAVIT",
    "contract_validation": "CONTRACT",
    "petition_validation": "PETITION",
    "affidavit_drafts": "AFFIDAVIT",
    "contract_drafts": "CONTRACT",
    "petition_drafts": "PETITION",
}


def ensure_results_dir() -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    return RESULTS_DIR


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json_file(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def write_text(path: Path, content: str) -> None:
    with path.open("w", encoding="utf-8") as handle:
        handle.write(content)


def check_missing_dataset_files() -> list[str]:
    missing: list[str] = []
    for paths in REQUIRED_DATASET_FILES.values():
        for path in paths:
            if not path.exists():
                missing.append(str(path.relative_to(SERVICE_ROOT)))
    return missing


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def normalize_compare_value(value: Any) -> str | None:
    normalized = normalize_text(value)
    if normalized is None:
        return None
    return normalized.casefold()


def values_match(left: Any, right: Any) -> bool:
    return normalize_compare_value(left) == normalize_compare_value(right)


def safe_ratio(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def round_metric(value: float) -> float:
    return round(value, 4)


def percentage(value: float) -> str:
    return f"{value * 100:.2f}%"


def doc_type_for_path(path: Path) -> str:
    return DOC_TYPE_BY_STEM[path.stem]


def score_band(value: float) -> str:
    if value >= 0.9:
        return "strong"
    if value >= 0.75:
        return "good"
    if value >= 0.6:
        return "moderate"
    return "weak"


def plain_language_performance(value: float) -> str:
    band = score_band(value)
    if band == "strong":
        return "The current system performs strongly on the available evaluation set."
    if band == "good":
        return "The current system performs well overall, with some room for refinement."
    if band == "moderate":
        return "The current system shows usable but mixed performance and still needs targeted improvement."
    return "The current system still needs substantial improvement before strong conclusions can be drawn."

