import json
import re
from typing import Any, Dict, Optional

try:
    from google import genai
except Exception:
    genai = None

from config import FIELD_LABELS, GEMINI_API_KEY, GEMINI_MODEL, REQUIRED_FIELDS


NIC_PATTERN = re.compile(r"^(?:\d{9}[vVxX]|\d{12})$")


def _empty_result(doc_type: str) -> dict:
    return {field: None for field in REQUIRED_FIELDS.get(doc_type, [])}


def _get_gemini_client():
    if not GEMINI_API_KEY or genai is None:
        return None

    try:
        return genai.Client(api_key=GEMINI_API_KEY)
    except Exception:
        return None


def _strip_code_fences(raw_text: str) -> str:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _extract_response_text(response) -> str:
    try:
        text = getattr(response, "text", None)
        if text:
            return text
    except Exception:
        pass

    fragments = []
    for candidate in getattr(response, "candidates", []) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", []) or []:
            part_text = getattr(part, "text", None)
            if part_text:
                fragments.append(part_text)
    return "\n".join(fragments)


def _extract_first_json_object(raw_text: str) -> Optional[Dict[str, Any]]:
    cleaned = _strip_code_fences(raw_text)
    try:
        payload = json.loads(cleaned)
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, list) and payload and isinstance(payload[0], dict):
            return payload[0]
    except Exception:
        pass

    start = cleaned.find("{")
    while start != -1:
        depth = 0
        for index in range(start, len(cleaned)):
            if cleaned[index] == "{":
                depth += 1
            elif cleaned[index] == "}":
                depth -= 1
                if depth == 0:
                    candidate = cleaned[start : index + 1]
                    try:
                        payload = json.loads(candidate)
                        if isinstance(payload, dict):
                            return payload
                    except Exception:
                        break
        start = cleaned.find("{", start + 1)

    return None


def _clean_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, list):
        joined = "; ".join(str(item) for item in value if item not in (None, ""))
        value = joined
    elif isinstance(value, dict):
        value = json.dumps(value, ensure_ascii=False)

    cleaned = re.sub(r"\s+", " ", str(value)).strip()
    cleaned = cleaned.strip(" \"'`")
    cleaned = re.sub(r"\s+[.;:]+$", "", cleaned)
    if cleaned.lower() in {"", "null", "none", "n/a", "not provided", "unknown"}:
        return None
    return cleaned or None


def _normalize_payload(payload: Dict[str, Any], required_fields: list) -> Dict[str, Optional[str]]:
    lowered = {str(key).strip().lower(): value for key, value in payload.items()}
    normalized = {}

    for field in required_fields:
        value = _clean_value(lowered.get(field.lower()))
        if field in {"deponent_nic", "petitioner_nic"} and value and not NIC_PATTERN.fullmatch(value):
            value = None
        normalized[field] = value

    return normalized


def _field_instructions(doc_type: str) -> str:
    lines = []
    for field in REQUIRED_FIELDS.get(doc_type, []):
        english = FIELD_LABELS.get(field, {}).get("en", field)
        sinhala = FIELD_LABELS.get(field, {}).get("si", field)
        lines.append(f'- "{field}": {english} / {sinhala}')
    return "\n".join(lines)


def _response_schema(required_fields: list) -> dict:
    return {
        "type": "object",
        "properties": {
            field: {
                "anyOf": [
                    {"type": "string"},
                    {"type": "null"},
                ]
            }
            for field in required_fields
        },
        "required": required_fields,
        "additionalProperties": False,
    }


def _request_json_payload(client, prompt: str, required_fields: list) -> Optional[Dict[str, Any]]:
    attempts = [
        {
            "temperature": 0,
            "response_mime_type": "application/json",
            "response_schema": _response_schema(required_fields),
        },
        {
            "temperature": 0,
            "response_mime_type": "application/json",
        },
    ]

    for config in attempts:
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=config,
            )
            payload = _extract_first_json_object(_extract_response_text(response))
            if payload:
                return payload
        except Exception:
            continue

    return None


def extract_entities_gemini(text: str, doc_type: str) -> dict:
    fallback = _empty_result(doc_type)
    required_fields = REQUIRED_FIELDS.get(doc_type)
    client = _get_gemini_client()

    if not required_fields or not client:
        return fallback

    prompt = f"""
You are a Sri Lankan legal parameter extractor.
The user prompt may be written in Sinhala, in English legal terms, or in mixed Sinhala-English code-switched form.
English words, names, organization names, court names, place names, NIC numbers, dates, and legal terms inside the prompt are valid content.
Do not translate them. Do not treat English tokens as errors. Preserve names, addresses, NIC numbers, dates, and organization names exactly as written in the prompt.

Document type: {doc_type}

Extract the following required fields:
{_field_instructions(doc_type)}

Role mapping rules:
- AFFIDAVIT: identify the deponent correctly.
- CONTRACT: map employer/buyer/lessor/service provider/first party to party_a and employee/seller/lessee/client/second party to party_b when those roles are present.
- PETITION: map petitioner and respondent carefully, even if one side is an organization.

User prompt:
\"\"\"
{text}
\"\"\"

Return ONLY one valid JSON object with exactly these keys:
{json.dumps(required_fields, ensure_ascii=False)}

Rules for the JSON output:
- Use the exact field names above.
- If a field is missing, use null.
- Do not include markdown.
- Do not include code fences.
- Do not include explanations, comments, or extra keys.
""".strip()

    try:
        payload = _request_json_payload(client, prompt, required_fields)
        if not payload:
            return fallback
        return _normalize_payload(payload, required_fields)
    except Exception:
        return fallback
