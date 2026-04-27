from __future__ import annotations

from collections import defaultdict

from evaluation.common import round_metric
from evaluation.dataset_loader import load_validation_datasets
from evaluation.metrics import accuracy, precision_recall_f1
from src.validator import validate_fields


def evaluate() -> dict:
    per_doc_type = defaultdict(
        lambda: {
            "status_correct": 0,
            "missing_exact": 0,
            "samples": 0,
            "tp": 0,
            "fp": 0,
            "fn": 0,
        }
    )
    sample_breakdown: list[dict] = []

    for dataset in load_validation_datasets():
        for index, sample in enumerate(dataset["samples"], start=1):
            doc_type = sample["doc_type"]
            prediction = validate_fields(doc_type, sample["extracted_params"], sample.get("language", "en"))
            expected_status = sample["expected_outcome"]
            expected_missing = sorted(sample.get("missing_fields", []))
            predicted_missing = sorted(prediction.get("missing_fields", []))

            stats = per_doc_type[doc_type]
            stats["samples"] += 1

            if prediction.get("status") == expected_status:
                stats["status_correct"] += 1
            if predicted_missing == expected_missing:
                stats["missing_exact"] += 1

            predicted_incomplete = prediction.get("status") == "incomplete"
            expected_incomplete = expected_status == "incomplete"
            if predicted_incomplete and expected_incomplete:
                stats["tp"] += 1
            elif predicted_incomplete and not expected_incomplete:
                stats["fp"] += 1
            elif expected_incomplete and not predicted_incomplete:
                stats["fn"] += 1

            sample_breakdown.append(
                {
                    "doc_type": doc_type,
                    "sample_index": index,
                    "predicted_status": prediction.get("status"),
                    "expected_status": expected_status,
                    "missing_fields_match": predicted_missing == expected_missing,
                }
            )

    per_doc_type_metrics = {}
    overall_status_correct = 0
    overall_missing_exact = 0
    overall_samples = 0
    total_tp = total_fp = total_fn = 0

    for doc_type, stats in sorted(per_doc_type.items()):
        overall_status_correct += stats["status_correct"]
        overall_missing_exact += stats["missing_exact"]
        overall_samples += stats["samples"]
        total_tp += stats["tp"]
        total_fp += stats["fp"]
        total_fn += stats["fn"]
        per_doc_type_metrics[doc_type] = {
            "status_accuracy": accuracy(stats["status_correct"], stats["samples"]),
            "missing_fields_exact_accuracy": accuracy(stats["missing_exact"], stats["samples"]),
            "incomplete_detection": precision_recall_f1(stats["tp"], stats["fp"], stats["fn"]),
        }

    return {
        "evaluation_area": "validation",
        "metric_definition": "Validation accuracy against expected complete/incomplete outcomes and expected missing-fields sets.",
        "overall": {
            "status_accuracy": accuracy(overall_status_correct, overall_samples),
            "missing_fields_exact_accuracy": accuracy(overall_missing_exact, overall_samples),
            "incomplete_detection": precision_recall_f1(total_tp, total_fp, total_fn),
        },
        "per_document_type": per_doc_type_metrics,
        "samples_evaluated": len(sample_breakdown),
        "sample_breakdown": sample_breakdown,
    }

