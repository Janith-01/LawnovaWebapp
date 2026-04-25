import json
import re
from typing import Any, Dict, Optional

try:
    from google import genai
except Exception:
    genai = None

from config import FIELD_LABELS, GEMINI_API_KEY, GEMINI_MODEL, REQUIRED_FIELDS


NIC_PATTERN = re.compile(r"^(?:\d{9}[vVxX]|\d{12})$")
NIC_VALUE_PATTERN = re.compile(r"\b(?:\d{9}[vVxX]|\d{12})\b")
DATE_VALUE_PATTERN = re.compile(
    r"(?:\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
    r"|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}"
    r"|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})",
    re.IGNORECASE,
)


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
    }


def _request_json_payload(client, prompt: str, required_fields: list) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
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

    last_error = None
    for config in attempts:
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=config,
            )
            raw_text = _extract_response_text(response)
            payload = _extract_first_json_object(raw_text)
            if payload:
                return payload, raw_text
            last_error = raw_text
        except Exception as exc:
            last_error = f"(Gemini error: {exc})"

    return None, last_error


def _split_sentences(text: str) -> list[str]:
    return [segment.strip() for segment in re.split(r"[.\n]+", text) if segment.strip()]


def _find_nic_sentence_index(sentences: list[str]) -> int:
    for index, sentence in enumerate(sentences):
        if NIC_VALUE_PATTERN.search(sentence) or "NIC" in sentence.upper():
            return index
    return -1


def _find_date_sentence_index(sentences: list[str]) -> int:
    for index, sentence in enumerate(sentences):
        if DATE_VALUE_PATTERN.search(sentence):
            return index
    return -1


def _extract_name_sinhala(text: str) -> Optional[str]:
    sentences = _split_sentences(text)
    nic_index = _find_nic_sentence_index(sentences)
    candidate = None
    if nic_index > 0:
        candidate = sentences[nic_index - 1]
    elif sentences:
        candidate = sentences[0]
    if not candidate:
        return None

    tokens = candidate.split()
    if len(tokens) >= 2:
        return _clean_value(" ".join(tokens[-2:]))
    return _clean_value(candidate)


def _extract_nic_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"(?:\bNIC\b(?:\s+[^0-9\s]+)?)\s*[:\-]?\s*(\d{12}|\d{9}[vVxX])",
        r"(?:\bNIC\b.*?)(\d{12}|\d{9}[vVxX])",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    match = NIC_VALUE_PATTERN.search(text)
    return _clean_value(match.group(0)) if match else None


def _extract_address_sinhala(text: str) -> Optional[str]:
    sentences = _split_sentences(text)
    nic_index = _find_nic_sentence_index(sentences)
    date_index = _find_date_sentence_index(sentences)
    start = nic_index + 1 if nic_index != -1 else 0
    end = date_index if date_index != -1 else len(sentences)

    for sentence in sentences[start:end]:
        if DATE_VALUE_PATTERN.search(sentence):
            continue
        if re.search(r"\d", sentence) and "," in sentence:
            digit_match = re.search(r"\d", sentence)
            if digit_match:
                return _clean_value(sentence[digit_match.start() :].rstrip(" ."))
    return None


def _extract_date_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"(?:Date)\s*[:\-]?\s*((?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}))",
        r"([0-9]{4}-[0-9]{2}-[0-9]{2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    match = DATE_VALUE_PATTERN.search(text)
    return _clean_value(match.group(0)) if match else None


def _extract_jurisdiction_sinhala(text: str) -> Optional[str]:
    sentences = _split_sentences(text)
    date_index = _find_date_sentence_index(sentences)
    if date_index != -1 and date_index + 1 < len(sentences):
        trailing = sentences[date_index + 1].split()
        if trailing:
            return _clean_value(trailing[-1].rstrip(" ."))
    if sentences:
        trailing = sentences[-1].split()
        if trailing:
            return _clean_value(trailing[-1].rstrip(" ."))
    return None


def _extract_statement_facts_sinhala(text: str) -> Optional[str]:
    sentences = _split_sentences(text)
    nic_index = _find_nic_sentence_index(sentences)
    date_index = _find_date_sentence_index(sentences)
    start = nic_index + 2 if nic_index != -1 else 0
    end = date_index if date_index != -1 else len(sentences)
    fact_sentences = []

    for sentence in sentences[start:end]:
        if NIC_VALUE_PATTERN.search(sentence) or DATE_VALUE_PATTERN.search(sentence):
            continue
        if re.search(r"\d", sentence) or len(sentence.split()) >= 4:
            fact_sentences.append(sentence)

    if fact_sentences:
        return _clean_value(". ".join(fact_sentences) + ".")
    return None


def _fallback_affidavit_extraction(text: str) -> Dict[str, Optional[str]]:
    return {
        "deponent_name": _extract_name_sinhala(text),
        "deponent_nic": _extract_nic_sinhala(text),
        "deponent_address": _extract_address_sinhala(text),
        "statement_facts": _extract_statement_facts_sinhala(text),
        "date": _extract_date_sinhala(text),
        "jurisdiction": _extract_jurisdiction_sinhala(text),
    }


def _fallback_extraction(text: str, doc_type: str, required_fields: list) -> Dict[str, Optional[str]]:
    fallback = _empty_result(doc_type)
    if doc_type == "AFFIDAVIT":
        fallback.update(_fallback_affidavit_extraction(text))
    return {
        field: _clean_value(fallback.get(field))
        for field in required_fields
    }


def _merge_payloads(primary: Dict[str, Optional[str]], fallback: Dict[str, Optional[str]], required_fields: list) -> Dict[str, Optional[str]]:
    merged = {}
    for field in required_fields:
        merged[field] = primary.get(field) if primary.get(field) is not None else fallback.get(field)
    return merged


def extract_entities_gemini(text: str, doc_type: str) -> dict:
    fallback = _empty_result(doc_type)
    required_fields = REQUIRED_FIELDS.get(doc_type)
    client = _get_gemini_client()

    if not required_fields:
        return fallback
    if not client:
        return _fallback_extraction(text, doc_type, required_fields)

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
- For AFFIDAVIT Sinhala prompts, extract the full deponent name, the exact NIC, the full address, the full factual statement, the exact date, and the exact jurisdiction.
- If the prompt uses Sinhala labels for name, NIC, date, or jurisdiction, treat them as direct field labels.
- Do not include markdown.
- Do not include code fences.
- Do not include explanations, comments, or extra keys.
""".strip()

    try:
        print("[Gemini Extractor] Prompt sent to Gemini:")
        print(json.dumps(prompt, ensure_ascii=True, indent=2))
        payload, raw_response_text = _request_json_payload(client, prompt, required_fields)
        print("[Gemini Extractor] Raw response received from Gemini:")
        print(json.dumps(raw_response_text or "(no valid JSON payload)", ensure_ascii=True, indent=2))
        normalized = _normalize_payload(payload or {}, required_fields)
        merged = _merge_payloads(normalized, _fallback_extraction(text, doc_type, required_fields), required_fields)
        print("[Gemini Extractor] Parsed result before validator:")
        print(json.dumps(merged, ensure_ascii=True, indent=2))
        return merged
    except Exception:
        merged = _fallback_extraction(text, doc_type, required_fields)
        print("[Gemini Extractor] Raw response received from Gemini:")
        print(json.dumps("(exception or no response)", ensure_ascii=True, indent=2))
        print("[Gemini Extractor] Parsed result before validator:")
        print(json.dumps(merged, ensure_ascii=True, indent=2))
        return merged
