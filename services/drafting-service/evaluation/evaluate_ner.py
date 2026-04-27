from __future__ import annotations

from collections import defaultdict

from config import REQUIRED_FIELDS
from evaluation.common import doc_type_for_path, round_metric, values_match
from evaluation.dataset_loader import load_ner_datasets
from evaluation.metrics import precision_recall_f1
from src.ner_extractor import extract_entities_ner


LABEL_TO_FIELD = {
    "DEPONENT_NAME": "deponent_name",
    "DEPONENT_NIC": "deponent_nic",
    "DEPONENT_ADDRESS": "deponent_address",
    "STATEMENT_FACTS": "statement_facts",
    "DATE": "date",
    "JURISDICTION": "jurisdiction",
    "PARTY_A": "party_a",
    "PARTY_B": "party_b",
    "CONTRACT_PURPOSE": "contract_purpose",
    "OBLIGATIONS_A": "obligations_a",
    "OBLIGATIONS_B": "obligations_b",
    "PAYMENT_TERMS": "payment_terms",
    "START_DATE": "start_date",
    "END_DATE": "end_date",
    "PETITIONER_NAME": "petitioner_name",
    "PETITIONER_NIC": "petitioner_nic",
    "PETITIONER_ADDRESS": "petitioner_address",
    "RESPONDENT_NAME": "respondent_name",
    "COURT_NAME": "court_name",
    "SUBJECT_MATTER": "subject_matter",
    "RELIEF_SOUGHT": "relief_sought",
}


def _empty_counts():
    return {"tp": 0, "fp": 0, "fn": 0}


def _ground_truth_from_spans(text: str, spans: list, doc_type: str) -> dict:
    truth = {field: None for field in REQUIRED_FIELDS[doc_type]}
    for start, end, label in spans:
        field = LABEL_TO_FIELD.get(str(label).upper())
        if field in truth and truth[field] is None:
            truth[field] = text[start:end]
    return truth


def evaluate() -> dict:
    field_counts = defaultdict(_empty_counts)
    doc_type_counts = defaultdict(_empty_counts)
    sample_breakdown: list[dict] = []

    for dataset in load_ner_datasets():
        doc_type = dataset["doc_type"]
        for index, sample in enumerate(dataset["samples"], start=1):
            text = sample["text"]
            truth = _ground_truth_from_spans(text, sample.get("entities", []), doc_type)
            predicted = extract_entities_ner(text, doc_type)
            sample_correct = 0
            sample_total = 0

            for field in REQUIRED_FIELDS[doc_type]:
                expected = truth.get(field)
                actual = predicted.get(field)
                expected_present = expected is not None
                actual_present = actual is not None

                if expected_present and actual_present and values_match(actual, expected):
                    field_counts[field]["tp"] += 1
                    doc_type_counts[doc_type]["tp"] += 1
                    sample_correct += 1
                elif expected_present and actual_present:
                    field_counts[field]["fp"] += 1
                    field_counts[field]["fn"] += 1
                    doc_type_counts[doc_type]["fp"] += 1
                    doc_type_counts[doc_type]["fn"] += 1
                elif actual_present and not expected_present:
                    field_counts[field]["fp"] += 1
                    doc_type_counts[doc_type]["fp"] += 1
                elif expected_present and not actual_present:
                    field_counts[field]["fn"] += 1
                    doc_type_counts[doc_type]["fn"] += 1

                sample_total += 1

            sample_breakdown.append(
                {
                    "doc_type": doc_type,
                    "sample_index": index,
                    "field_match_rate": round_metric(sample_correct / sample_total if sample_total else 0.0),
                }
            )

    per_field = {
        field: precision_recall_f1(counts["tp"], counts["fp"], counts["fn"])
        for field, counts in sorted(field_counts.items())
    }
    per_doc_type = {
        doc_type: precision_recall_f1(counts["tp"], counts["fp"], counts["fn"])
        for doc_type, counts in sorted(doc_type_counts.items())
    }

    total_tp = sum(counts["tp"] for counts in field_counts.values())
    total_fp = sum(counts["fp"] for counts in field_counts.values())
    total_fn = sum(counts["fn"] for counts in field_counts.values())

    return {
        "evaluation_area": "ner_extraction",
        "metric_definition": "Field-level exact match against English NER annotations converted from span labels.",
        "overall": precision_recall_f1(total_tp, total_fp, total_fn),
        "per_field": per_field,
        "per_document_type": per_doc_type,
        "samples_evaluated": len(sample_breakdown),
        "sample_breakdown": sample_breakdown,
    }

