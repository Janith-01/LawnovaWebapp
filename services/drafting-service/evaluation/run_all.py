from __future__ import annotations

import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from evaluation.common import (
    check_missing_dataset_files,
    ensure_results_dir,
    percentage,
    plain_language_performance,
    round_metric,
    utc_timestamp,
    write_json,
    write_text,
)
from evaluation.evaluate_drafting import evaluate as evaluate_drafting
from evaluation.evaluate_gemini import evaluate as evaluate_gemini
from evaluation.evaluate_ner import evaluate as evaluate_ner
from evaluation.evaluate_validation import evaluate as evaluate_validation


def _comparison_summary(ner_result: dict, gemini_result: dict) -> dict:
    ner_f1 = ner_result["overall"]["f1"]
    gemini_accuracy = gemini_result["overall"]["accuracy"]
    if gemini_accuracy >= ner_f1:
        finding = (
            f"On the current evaluation set, the mocked Sinhala Gemini path achieved higher field-level accuracy "
            f"({percentage(gemini_accuracy)}) than the English NER layer's overall F1 ({percentage(ner_f1)})."
        )
    else:
        finding = (
            f"On the current evaluation set, the English NER layer achieved a stronger overall F1 "
            f"({percentage(ner_f1)}) than the mocked Sinhala Gemini path's field-level accuracy ({percentage(gemini_accuracy)})."
        )
    return {
        "ner_overall_f1": round_metric(ner_f1),
        "gemini_overall_accuracy": round_metric(gemini_accuracy),
        "key_finding": finding,
    }


def _render_markdown(report: dict) -> str:
    ner = report["evaluations"]["ner_extraction"]
    gemini = report["evaluations"]["gemini_extraction"]
    validation = report["evaluations"]["validation"]
    drafting = report["evaluations"]["drafting_quality"]
    comparison = report["comparison"]

    overall_system_score = (
        ner["overall"]["f1"]
        + gemini["overall"]["accuracy"]
        + validation["overall"]["status_accuracy"]["accuracy"]
        + drafting["overall"]["average_section_coverage"]
    ) / 4

    lines = [
        "# Evaluation Report",
        "",
        "## Research Summary",
        (
            "This evaluation reviewed the Lawnova bilingual legal drafting service across four areas: "
            "English NER extraction, mocked Sinhala Gemini extraction, validation accuracy, and full drafting structure coverage."
        ),
        (
            "The analysis used the current verified dataset files under the service dataset folders and exercised the real service logic "
            "while keeping Gemini-dependent evaluation offline and deterministic."
        ),
        comparison["key_finding"],
        plain_language_performance(overall_system_score),
        "Final conclusions should still be treated as provisional until the datasets are reviewed and verified by a legal officer.",
        "",
        "## Dataset Status",
        f"- Generated at: `{report['generated_at']}`",
        f"- Missing dataset files: `{len(report['missing_files'])}`",
        "",
        "## Overall Scores",
        f"- English NER overall precision / recall / F1: `{percentage(ner['overall']['precision'])}` / `{percentage(ner['overall']['recall'])}` / `{percentage(ner['overall']['f1'])}`",
        f"- Mocked Sinhala Gemini field accuracy: `{percentage(gemini['overall']['accuracy'])}`",
        f"- Validation status accuracy: `{percentage(validation['overall']['status_accuracy']['accuracy'])}`",
        f"- Validation incomplete precision / recall: `{percentage(validation['overall']['incomplete_detection']['precision'])}` / `{percentage(validation['overall']['incomplete_detection']['recall'])}`",
        f"- Drafting average section coverage: `{percentage(drafting['overall']['average_section_coverage'])}`",
        "",
        "## Per-Document-Type Breakdown",
        "",
        "### NER Extraction",
    ]

    for doc_type, stats in ner["per_document_type"].items():
        lines.append(
            f"- {doc_type}: precision `{percentage(stats['precision'])}`, recall `{percentage(stats['recall'])}`, F1 `{percentage(stats['f1'])}`"
        )

    lines.extend(
        [
            "",
            "### Gemini Extraction",
        ]
    )
    for doc_type, stats in gemini["per_document_type"].items():
        lines.append(f"- {doc_type}: field accuracy `{percentage(stats['accuracy'])}`")

    lines.extend(
        [
            "",
            "### Validation",
        ]
    )
    for doc_type, stats in validation["per_document_type"].items():
        lines.append(
            f"- {doc_type}: status accuracy `{percentage(stats['status_accuracy']['accuracy'])}`, missing-fields exact accuracy `{percentage(stats['missing_fields_exact_accuracy']['accuracy'])}`"
        )

    lines.extend(
        [
            "",
            "### Drafting Quality",
        ]
    )
    for doc_type, stats in drafting["per_document_type"].items():
        lines.append(f"- {doc_type}: average section coverage `{percentage(stats['average_section_coverage'])}`")

    lines.extend(
        [
            "",
            "## NER vs Gemini Comparison",
            f"- English NER overall F1: `{percentage(comparison['ner_overall_f1'])}`",
            f"- Mocked Sinhala Gemini overall field accuracy: `{percentage(comparison['gemini_overall_accuracy'])}`",
            f"- Key finding: {comparison['key_finding']}",
            "",
            "## Notes",
            "- Gemini extraction was evaluated with mocked offline responses to avoid real API calls during research evaluation.",
            "- Drafting quality was measured as expected structural section coverage, not stylistic preference or legal sufficiency.",
            "- Legal officer verification is required before treating these metrics as final research conclusions.",
        ]
    )

    return "\n".join(lines).strip() + "\n"


def main() -> int:
    results_dir = ensure_results_dir()
    json_path = results_dir / "evaluation_report.json"
    markdown_path = results_dir / "evaluation_report.md"

    print("Lawnova Drafting Service Evaluation")
    print("Checking dataset files...")

    missing_files = check_missing_dataset_files()
    if missing_files:
        report = {
            "generated_at": utc_timestamp(),
            "missing_files": missing_files,
            "evaluations": {},
            "comparison": {},
        }
        write_json(json_path, report)
        write_text(
            markdown_path,
            "# Evaluation Report\n\n## Research Summary\nDataset files are missing, so the evaluation could not be completed.\n",
        )
        print("Missing dataset files detected:")
        for item in missing_files:
            print(f" - {item}")
        print(f"Wrote partial report to {json_path.relative_to(SERVICE_ROOT)}")
        print(f"Wrote partial report to {markdown_path.relative_to(SERVICE_ROOT)}")
        print("Evaluation finished gracefully with missing datasets.")
        return 0

    print("All required dataset files found.")
    print("Running English NER extraction evaluation...")
    ner_result = evaluate_ner()
    print(
        f" - English NER overall F1: {percentage(ner_result['overall']['f1'])} "
        f"(precision {percentage(ner_result['overall']['precision'])}, recall {percentage(ner_result['overall']['recall'])})"
    )

    print("Running mocked Sinhala Gemini extraction evaluation...")
    gemini_result = evaluate_gemini()
    print(f" - Mocked Sinhala Gemini overall field accuracy: {percentage(gemini_result['overall']['accuracy'])}")

    print("Running validation-layer evaluation...")
    validation_result = evaluate_validation()
    print(
        f" - Validation status accuracy: {percentage(validation_result['overall']['status_accuracy']['accuracy'])}; "
        f"incomplete precision {percentage(validation_result['overall']['incomplete_detection']['precision'])}; "
        f"incomplete recall {percentage(validation_result['overall']['incomplete_detection']['recall'])}"
    )

    print("Running drafting-quality evaluation...")
    drafting_result = evaluate_drafting()
    print(
        f" - Drafting average section coverage: "
        f"{percentage(drafting_result['overall']['average_section_coverage'])}"
    )

    comparison = _comparison_summary(ner_result, gemini_result)
    report = {
        "generated_at": utc_timestamp(),
        "missing_files": [],
        "evaluations": {
            "ner_extraction": ner_result,
            "gemini_extraction": gemini_result,
            "validation": validation_result,
            "drafting_quality": drafting_result,
        },
        "comparison": comparison,
    }

    markdown = _render_markdown(report)
    write_json(json_path, report)
    write_text(markdown_path, markdown)

    print(f"Wrote JSON report to {json_path.relative_to(SERVICE_ROOT)}")
    print(f"Wrote Markdown report to {markdown_path.relative_to(SERVICE_ROOT)}")
    print("Evaluation complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
