from src.doc_classifier import classify_doc_type
from src.gemini_drafter import draft_document
from src.gemini_extractor import extract_entities_gemini
from src.language_detector import detect_language
from src.ner_extractor import extract_entities_ner
from src.output_generator import save_as_docx, save_as_pdf
from src.role_resolver import resolve_roles
from src.template_loader import load_template
from src.validator import validate_fields


def _unknown_doc_type_payload(language: str) -> dict:
    return {
        "status": "unknown_doc_type",
        "message": (
            "Could not determine document type. Please mention affidavit, contract, "
            "or petition in your description."
        ),
    }


def _extract_entities(user_prompt: str, doc_type: str, language: str) -> dict:
    if language == "en":
        return extract_entities_ner(user_prompt, doc_type)
    return extract_entities_gemini(user_prompt, doc_type)


def run_validation(user_prompt: str) -> dict:
    language = detect_language(user_prompt)
    doc_type = classify_doc_type(user_prompt)

    if doc_type == "UNKNOWN":
        unknown = _unknown_doc_type_payload(language)
        return {
            "status": "incomplete",
            "missing_fields": ["document_type"],
            "message": unknown["message"],
        }

    entities = _extract_entities(user_prompt, doc_type, language)
    entities = resolve_roles(entities, doc_type)
    validation = validate_fields(doc_type, entities, language)
    return {
        "status": validation["status"],
        "missing_fields": validation["missing_fields"],
        "message": validation["message"],
    }


def run_pipeline(user_prompt: str) -> dict:
    language = detect_language(user_prompt)
    doc_type = classify_doc_type(user_prompt)

    if doc_type == "UNKNOWN":
        return _unknown_doc_type_payload(language)

    entities = _extract_entities(user_prompt, doc_type, language)
    entities = resolve_roles(entities, doc_type)
    validation = validate_fields(doc_type, entities, language)

    if validation["status"] == "incomplete":
        return {
            "status": "incomplete",
            "message": validation["message"],
            "missing_fields": validation["missing_fields"],
        }

    clean_entities = {key: value for key, value in entities.items() if not key.startswith("_")}
    template = load_template(doc_type, language)
    drafted = draft_document(doc_type, clean_entities, template, language)
    docx_path = save_as_docx(drafted, doc_type, language)
    pdf_path = save_as_pdf(drafted, doc_type, language)

    return {
        "status": "complete",
        "doc_type": doc_type,
        "language": language,
        "docx_path": docx_path,
        "pdf_path": pdf_path,
        "drafted_content": drafted,
    }
