from __future__ import annotations

from evaluation.common import round_metric, safe_ratio


def precision_recall_f1(tp: int, fp: int, fn: int) -> dict:
    precision = safe_ratio(tp, tp + fp)
    recall = safe_ratio(tp, tp + fn)
    f1 = safe_ratio(2 * precision * recall, precision + recall) if (precision + recall) else 0.0
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": round_metric(precision),
        "recall": round_metric(recall),
        "f1": round_metric(f1),
    }


def accuracy(correct: int, total: int) -> dict:
    return {
        "correct": correct,
        "total": total,
        "accuracy": round_metric(safe_ratio(correct, total)),
    }

