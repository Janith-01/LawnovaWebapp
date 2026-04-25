from __future__ import annotations

from pathlib import Path

from evaluation.common import REQUIRED_DATASET_FILES, doc_type_for_path, load_json_file


def _load_dataset_group(group_name: str) -> list[dict]:
    records: list[dict] = []
    for path in REQUIRED_DATASET_FILES[group_name]:
        payload = load_json_file(path)
        records.append(
            {
                "path": path,
                "doc_type": doc_type_for_path(path),
                "samples": payload if isinstance(payload, list) else [],
            }
        )
    return records


def load_ner_datasets() -> list[dict]:
    return _load_dataset_group("ner_extraction")


def load_gemini_datasets() -> list[dict]:
    return _load_dataset_group("gemini_extraction")


def load_validation_datasets() -> list[dict]:
    return _load_dataset_group("validation")


def load_drafting_datasets() -> list[dict]:
    return _load_dataset_group("drafting_quality")

