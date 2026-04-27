from pathlib import Path

from config import REQUIRED_FIELDS
from src.doc_classifier import classify_doc_type
from src.gemini_drafter import draft_document, get_last_provenance as get_draft_provenance
from src.gemini_extractor import (
    extract_entities_gemini,
    get_confidence_scores as get_gemini_confidence_scores,
    get_last_provenance as get_gemini_extraction_provenance,
)
from src.history import save_document
from src.language_detector import detect_language
from src.ner_extractor import extract_entities_ner, get_confidence_scores as get_ner_confidence_scores
from src.output_generator import save_as_docx, save_as_pdf
from src.provenance import local_provenance
from src.role_resolver import resolve_roles
from src.template_loader import load_template
from src.validator import validate_fields


def build_response(
    status: str,
    message: str,
    *,
    doc_type: str | None = None,
    language: str | None = None,
    missing_fields: list | None = None,
    docx_path: str | None = None,
    pdf_path: str | None = None,
    drafted_content: str | None = None,
    extracted_fields: dict | None = None,
    confidence_scores: dict | None = None,
    ai_provenance: dict | None = None,
    error_code: str | None = None,
    error_details=None,
) -> dict:
    return {
        "status": status,
        "message": message,
        "doc_type": doc_type,
        "language": language,
        "missing_fields": missing_fields or [],
        "docx_path": docx_path,
        "pdf_path": pdf_path,
        "drafted_content": drafted_content,
        "extracted_fields": extracted_fields or {},
        "confidence_scores": confidence_scores or {},
        "ai_provenance": ai_provenance or {},
        "error": (
            {
                "code": error_code,
                "details": error_details,
            }
            if error_code
            else None
        ),
    }


def _unknown_doc_type_message() -> str:
    return (
        "Could not determine document type. Please mention affidavit, contract, "
        "or petition in your description."
    )


def _unknown_doc_type_payload(language: str) -> dict:
    return build_response(
        status="unknown_doc_type",
        message=_unknown_doc_type_message(),
        language=language,
        missing_fields=["document_type"],
    )


def _pipeline_error_response(
    message: str,
    *,
    doc_type: str | None = None,
    language: str | None = None,
    error_code: str = "pipeline_error",
    error_details=None,
) -> dict:
    return build_response(
        status="error",
        message=message,
        doc_type=doc_type,
        language=language,
        error_code=error_code,
        error_details=error_details,
    )


def _extract_entities(user_prompt: str, doc_type: str, language: str) -> dict:
    try:
        if language == "en":
            entities = extract_entities_ner(user_prompt, doc_type)
        else:
            entities = extract_entities_gemini(user_prompt, doc_type)
        return entities if isinstance(entities, dict) else {}
    except Exception:
        return {}


def _get_confidence_scores(entities: dict, doc_type: str, language: str) -> dict:
    try:
        if language == "en":
            scores = get_ner_confidence_scores(entities, doc_type)
        else:
            scores = get_gemini_confidence_scores(entities, doc_type)
        return scores if isinstance(scores, dict) else {}
    except Exception:
        return {field: None for field in REQUIRED_FIELDS.get(doc_type, [])}


def _local_ner_provenance(user_prompt: str, entities: dict, doc_type: str) -> dict:
    field_sources = {
        field: ("local_ner" if entities.get(field) is not None else None)
        for field in REQUIRED_FIELDS.get(doc_type, [])
    }

    return local_provenance(
        stage="entity_extraction",
        provider="local_ner",
        source="spacy_ner_extractor",
        reason="english_prompt_uses_local_ner",
        prompt=user_prompt,
        output=str(entities),
        field_sources=field_sources,
        gemini_attempted=False,
        fallback_used=False,
    )


def _get_extraction_provenance(user_prompt: str, entities: dict, doc_type: str, language: str) -> dict:
    try:
        if language == "en":
            return _local_ner_provenance(user_prompt, entities, doc_type)
        provenance = get_gemini_extraction_provenance()
        if provenance:
            return provenance
    except Exception:
        pass
    return {}


def _safe_detect_language(user_prompt: str) -> str:
    try:
        language = detect_language(user_prompt)
        return language if language in {"en", "si"} else "en"
    except Exception:
        return "en"


def _safe_classify_doc_type(user_prompt: str) -> str:
    try:
        doc_type = classify_doc_type(user_prompt)
        return doc_type if doc_type in {"AFFIDAVIT", "CONTRACT", "PETITION"} else "UNKNOWN"
    except Exception:
        return "UNKNOWN"


def _safe_resolve_roles(entities: dict, doc_type: str) -> dict:
    try:
        resolved = resolve_roles(entities, doc_type)
        return resolved if isinstance(resolved, dict) else entities
    except Exception:
        return entities


def run_validation(user_prompt: str) -> dict:
    language = _safe_detect_language(user_prompt)
    doc_type = _safe_classify_doc_type(user_prompt)

    if doc_type == "UNKNOWN":
        return _unknown_doc_type_payload(language)

    entities = _extract_entities(user_prompt, doc_type, language)
    entities = _safe_resolve_roles(entities, doc_type)
    confidence_scores = _get_confidence_scores(entities, doc_type, language)
    ai_provenance = {
        "entity_extraction": _get_extraction_provenance(user_prompt, entities, doc_type, language)
    }

    try:
        validation = validate_fields(doc_type, entities, language)
    except Exception as exc:
        return _pipeline_error_response(
            "Unable to validate the provided drafting details at this time.",
            doc_type=doc_type,
            language=language,
            error_code="validation_failed",
            error_details={"exception": str(exc)},
        )

    message = validation.get("message")
    if validation.get("status") == "complete" and not message:
        message = (
            "All required details are present."
            if language == "en"
            else "අවශ්‍ය සියලු තොරතුරු සපයා ඇත."
        )

    return build_response(
        status=validation.get("status", "incomplete"),
        message=message or "Validation could not be completed.",
        doc_type=doc_type,
        language=language,
        missing_fields=validation.get("missing_fields", []),
        extracted_fields=entities,
        confidence_scores=confidence_scores,
        ai_provenance=ai_provenance,
    )


def run_pipeline(user_prompt: str, user_id: str | None = None) -> dict:
    language = _safe_detect_language(user_prompt)
    doc_type = _safe_classify_doc_type(user_prompt)

    if doc_type == "UNKNOWN":
        return _unknown_doc_type_payload(language)

    entities = _extract_entities(user_prompt, doc_type, language)
    entities = _safe_resolve_roles(entities, doc_type)
    confidence_scores = _get_confidence_scores(entities, doc_type, language)
    ai_provenance = {
        "entity_extraction": _get_extraction_provenance(user_prompt, entities, doc_type, language)
    }

    try:
        validation = validate_fields(doc_type, entities, language)
    except Exception as exc:
        return _pipeline_error_response(
            "Unable to validate the provided drafting details at this time.",
            doc_type=doc_type,
            language=language,
            error_code="validation_failed",
            error_details={"exception": str(exc)},
        )

    if validation.get("status") == "incomplete":
        return build_response(
            status="incomplete",
            message=validation.get("message") or "Additional details are required.",
            doc_type=doc_type,
            language=language,
            missing_fields=validation.get("missing_fields", []),
            extracted_fields=entities,
            confidence_scores=confidence_scores,
            ai_provenance=ai_provenance,
        )

    clean_entities = {
        key: value for key, value in entities.items() if not str(key).startswith("_")
    }

    try:
        template = load_template(doc_type, language)
    except Exception as exc:
        return _pipeline_error_response(
            "Unable to load the document template at this time.",
            doc_type=doc_type,
            language=language,
            error_code="template_load_failed",
            error_details={"exception": str(exc)},
        )

    try:
        drafted = draft_document(doc_type, clean_entities, template, language)
        ai_provenance["draft_generation"] = get_draft_provenance()
    except Exception as exc:
        return _pipeline_error_response(
            "Unable to draft the document at this time.",
            doc_type=doc_type,
            language=language,
            error_code="draft_generation_failed",
            error_details={"exception": str(exc)},
        )

    if not drafted or not drafted.strip():
        return _pipeline_error_response(
            "Document drafting did not produce any content.",
            doc_type=doc_type,
            language=language,
            error_code="empty_draft",
        )

    try:
        docx_path = save_as_docx(drafted, doc_type, language)
        pdf_path = save_as_pdf(drafted, doc_type, language)
    except Exception as exc:
        return _pipeline_error_response(
            "Unable to generate the output files at this time.",
            doc_type=doc_type,
            language=language,
            error_code="output_generation_failed",
            error_details={"exception": str(exc)},
        )

    document_id = None
    if user_id:
        try:
            document_id = save_document(
                user_id=user_id,
                doc_type=doc_type,
                language=language,
                prompt=user_prompt,
                drafted_content=drafted,
                docx_filename=Path(docx_path).name if docx_path else None,
                pdf_filename=Path(pdf_path).name if pdf_path else None,
                ai_provenance=ai_provenance,
            )
        except Exception as exc:
            return _pipeline_error_response(
                "Unable to save document history at this time.",
                doc_type=doc_type,
                language=language,
                error_code="history_save_failed",
                error_details={"exception": str(exc)},
            )

    response = build_response(
        status="complete",
        message="Draft generated successfully.",
        doc_type=doc_type,
        language=language,
        docx_path=docx_path,
        pdf_path=pdf_path,
        drafted_content=drafted,
        extracted_fields=entities,
        confidence_scores=confidence_scores,
        ai_provenance=ai_provenance,
    )
    if document_id:
        response["document_id"] = document_id
    return response
