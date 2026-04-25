from __future__ import annotations

import re
from collections import defaultdict
from unittest.mock import patch

from evaluation.common import normalize_text, round_metric, safe_ratio
from evaluation.dataset_loader import load_drafting_datasets
from src.pipeline import run_pipeline


SECTION_PATTERNS = {
    "Title / Heading": [r"\bAFFIDAVIT\b", r"\bPETITION\b", r"\bAGREEMENT\b", r"\bCONTRACT\b"],
    "Court and Case Reference": [r"\bCOURT\b", r"APPLICATION NO", r"CASE NO", r"IN THE MATTER OF"],
    "Deponent Identification": [r"\bI,\b", r"\bholder of\b.*\bNIC\b|\bNational Identity Card\b", r"\bDeponent\b"],
    "Oath / Affirmation Statement": [r"solemnly", r"\baffirm\b", r"\bdeclare\b"],
    "Numbered Statement of Facts": [r"(?m)^\s*1\.", r"(?m)^\s*2\."],
    "Verification Clause": [r"true and correct", r"best of my knowledge", r"\bverify\b"],
    "Deponent Signature": [r"\bDeponent\b", r"_________________________"],
    "Commissioner for Oaths / Notary Attestation": [r"Commissioner for Oaths", r"Notary Public"],
    "Title and Parties": [r"\bAGREEMENT\b|\bCONTRACT\b", r"\bBETWEEN\b", r"\bAND\b"],
    "Recitals / Background": [r"\bRECITALS\b", r"\bWHEREAS\b", r"\bBACKGROUND\b"],
    "Definitions": [r"\bDEFINITIONS\b", r"means the"],
    "Scope of Work": [r"\bSCOPE OF WORK\b"],
    "Scope of Supply": [r"\bSCOPE OF SUPPLY\b"],
    "Scope of Services": [r"\bSCOPE OF SERVICES\b"],
    "Obligations of Party A": [r"OBLIGATIONS OF PARTY A", r"Party A shall"],
    "Obligations of Party B": [r"OBLIGATIONS OF PARTY B", r"Party B shall"],
    "Payment Terms": [r"\bPAYMENT TERMS\b", r"\bPayment\b"],
    "Price and Payment Terms": [r"\bPRICE AND PAYMENT TERMS\b", r"\bPAYMENT TERMS\b"],
    "Completion and Acceptance": [r"\bCOMPLETION AND ACCEPTANCE\b", r"\bacceptance\b"],
    "Warranty": [r"\bWARRANTY\b"],
    "Termination": [r"\bTERMINATION\b"],
    "Dispute Resolution": [r"\bDISPUTE RESOLUTION\b", r"\bmediation\b", r"\barbitration\b"],
    "Governing Law and Jurisdiction": [r"\bGOVERNING LAW AND JURISDICTION\b", r"laws of the Democratic Socialist Republic of Sri Lanka", r"\bjurisdiction\b"],
    "Signatures and Date": [r"IN WITNESS WHEREOF", r"\bSIGNED\b", r"\bDate:\b"],
    "Appointment and Duration": [r"\bAPPOINTMENT AND DURATION\b"],
    "Duties and Responsibilities": [r"\bDUTIES AND RESPONSIBILITIES\b"],
    "Obligations of Employer": [r"OBLIGATIONS OF THE EMPLOYER", r"\bEmployer\b"],
    "Obligations of Employee": [r"OBLIGATIONS OF THE EMPLOYEE", r"\bEmployee\b"],
    "Remuneration and Benefits": [r"\bREMUNERATION AND BENEFITS\b", r"\bEPF\b", r"\bETF\b", r"\bsalary\b"],
    "Confidentiality": [r"\bCONFIDENTIALITY\b", r"\bconfidentiality\b"],
    "Cancellation Policy": [r"\bCANCELLATION POLICY\b"],
    "Liability": [r"\bLIABILITY\b", r"\bindemnify\b"],
    "Court Heading": [r"(?m)^IN THE .*COURT"],
    "Petition Title and Case Reference": [r"APPLICATION NO", r"IN THE MATTER OF", r"(?m)^PETITION$"],
    "Parties": [r"\bBETWEEN:\b", r"\.\.\.Petitioner", r"\.\.\.Respondent"],
    "Jurisdiction": [r"jurisdiction", r"This Honourable Court", r"Article 140"],
    "Statement of Facts": [r"states as follows", r"(?m)^\s*1\.", r"(?m)^\s*2\."],
    "Grounds of Petition": [r"\bGROUNDS OF PETITION\b"],
    "Relief Sought": [r"\bRELIEF SOUGHT\b", r"\bWHEREFORE\b"],
    "Verification": [r"\bVERIFICATION\b", r"do verify and affirm", r"true and correct"],
    "Petitioner / Attorney Signature": [r"\bPetitioner\b", r"Attorney-at-Law"],
    "Date": [r"\bDate:\b", r"\bday of\b"],
}


def _language_code(language: str) -> str:
    return "si" if str(language).strip().lower().startswith("sin") else "en"


def _dummy_output_path(doc_type: str, language: str, extension: str) -> str:
    return f"evaluation/output/{doc_type.lower()}_{language}_mock.{extension}"


def _section_present(section_label: str, text: str) -> bool:
    patterns = SECTION_PATTERNS.get(section_label)
    if patterns:
        return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)

    fallback_terms = [
        token for token in re.split(r"[^A-Za-z]+", section_label.casefold()) if len(token) > 3 and token not in {"and", "with", "date"}
    ]
    return all(term in text.casefold() for term in fallback_terms)


def evaluate() -> dict:
    per_doc_type = defaultdict(lambda: {"coverage_sum": 0.0, "samples": 0})
    sample_breakdown: list[dict] = []

    for dataset in load_drafting_datasets():
        for index, sample in enumerate(dataset["samples"], start=1):
            doc_type = sample["doc_type"]
            language = _language_code(sample.get("language", "English"))
            input_params = sample["input_params"]
            expected_sections = sample["expected_structure"]

            with (
                patch("src.pipeline._safe_detect_language", return_value=language),
                patch("src.pipeline._safe_classify_doc_type", return_value=doc_type),
                patch("src.pipeline._extract_entities", return_value=input_params),
                patch("src.pipeline._safe_resolve_roles", return_value=input_params),
                patch("src.pipeline.save_as_docx", side_effect=lambda drafted, dt, lang: _dummy_output_path(dt, lang, "docx")),
                patch("src.pipeline.save_as_pdf", side_effect=lambda drafted, dt, lang: _dummy_output_path(dt, lang, "pdf")),
                patch("src.gemini_drafter._get_gemini_client", return_value=None),
            ):
                result = run_pipeline("evaluation input placeholder")

            drafted_content = result.get("drafted_content", "") if result.get("status") == "complete" else ""
            matched_sections = [label for label in expected_sections if _section_present(label, drafted_content)]
            missing_sections = [label for label in expected_sections if label not in matched_sections]
            coverage = safe_ratio(len(matched_sections), len(expected_sections))

            per_doc_type[doc_type]["coverage_sum"] += coverage
            per_doc_type[doc_type]["samples"] += 1
            sample_breakdown.append(
                {
                    "doc_type": doc_type,
                    "sample_index": index,
                    "pipeline_status": result.get("status"),
                    "coverage_score": round_metric(coverage),
                    "matched_sections": matched_sections,
                    "missing_sections": missing_sections,
                }
            )

    per_document_type = {
        doc_type: {
            "average_section_coverage": round_metric(stats["coverage_sum"] / stats["samples"] if stats["samples"] else 0.0),
            "samples": stats["samples"],
        }
        for doc_type, stats in sorted(per_doc_type.items())
    }
    total_coverage = sum(stats["coverage_sum"] for stats in per_doc_type.values())
    total_samples = sum(stats["samples"] for stats in per_doc_type.values())

    return {
        "evaluation_area": "drafting_quality",
        "metric_definition": "Section coverage based on whether expected structural sections appear in drafted output produced by the pipeline with patched extraction and offline drafting.",
        "overall": {
            "average_section_coverage": round_metric(total_coverage / total_samples if total_samples else 0.0),
            "samples": total_samples,
        },
        "per_document_type": per_document_type,
        "samples_evaluated": len(sample_breakdown),
        "sample_breakdown": sample_breakdown,
    }

