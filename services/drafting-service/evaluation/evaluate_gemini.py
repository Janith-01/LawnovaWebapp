from __future__ import annotations

import json
from collections import defaultdict
from unittest.mock import patch

from config import REQUIRED_FIELDS
from evaluation.common import round_metric, values_match
from evaluation.dataset_loader import load_gemini_datasets
from evaluation.metrics import accuracy
from src.gemini_extractor import extract_entities_gemini


class _MockGeminiResponse:
    def __init__(self, payload_text: str):
        self.text = payload_text


class _MockGeminiModels:
    def __init__(self, payload_text: str):
        self.payload_text = payload_text

    def generate_content(self, model, contents, config):
        return _MockGeminiResponse(self.payload_text)


class _MockGeminiClient:
    def __init__(self, payload_text: str):
        self.models = _MockGeminiModels(payload_text)


def _mock_payload_text(ground_truth: dict, sample_index: int) -> str:
    body = json.dumps(ground_truth, ensure_ascii=False, indent=2)
    if sample_index % 2 == 0:
        return f"```json\n{body}\n```"
    return body


def evaluate() -> dict:
    per_field = defaultdict(lambda: {"correct": 0, "total": 0})
    per_doc_type = defaultdict(lambda: {"correct": 0, "total": 0})
    sample_breakdown: list[dict] = []

    for dataset in load_gemini_datasets():
        doc_type = dataset["doc_type"]
        for index, sample in enumerate(dataset["samples"], start=1):
            prompt = sample["prompt"]
            truth = sample["ground_truth"]
            mock_text = _mock_payload_text(truth, index)

            with patch("src.gemini_extractor._get_gemini_client", return_value=_MockGeminiClient(mock_text)):
                predicted = extract_entities_gemini(prompt, doc_type)

            sample_correct = 0
            sample_total = 0
            for field in REQUIRED_FIELDS[doc_type]:
                matches = values_match(predicted.get(field), truth.get(field))
                per_field[field]["total"] += 1
                per_doc_type[doc_type]["total"] += 1
                sample_total += 1
                if matches:
                    per_field[field]["correct"] += 1
                    per_doc_type[doc_type]["correct"] += 1
                    sample_correct += 1

            sample_breakdown.append(
                {
                    "doc_type": doc_type,
                    "sample_index": index,
                    "field_accuracy": round_metric(sample_correct / sample_total if sample_total else 0.0),
                }
            )

    field_metrics = {
        field: accuracy(stats["correct"], stats["total"])
        for field, stats in sorted(per_field.items())
    }
    doc_type_metrics = {
        doc_type: accuracy(stats["correct"], stats["total"])
        for doc_type, stats in sorted(per_doc_type.items())
    }

    total_correct = sum(stats["correct"] for stats in per_field.values())
    total_fields = sum(stats["total"] for stats in per_field.values())

    return {
        "evaluation_area": "gemini_extraction",
        "metric_definition": "Mocked Sinhala Gemini path evaluated as field-level exact-match accuracy using deterministic offline responses.",
        "overall": accuracy(total_correct, total_fields),
        "per_field": field_metrics,
        "per_document_type": doc_type_metrics,
        "samples_evaluated": len(sample_breakdown),
        "sample_breakdown": sample_breakdown,
        "note": "This evaluation mocks Gemini responses and therefore measures extraction-path parsing and normalization behavior, not live model quality.",
    }

