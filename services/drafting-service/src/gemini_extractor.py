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


_LAST_CONFIDENCE_SOURCES: Dict[str, Optional[str]] = {}


def _set_last_confidence_sources(sources: Dict[str, Optional[str]]) -> None:
    global _LAST_CONFIDENCE_SOURCES
    _LAST_CONFIDENCE_SOURCES = dict(sources)


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


def _extract_contract_parties(text: str) -> tuple[Optional[str], Optional[str]]:
    patterns = [
        r"\bbetween\s+(.+?)\s+\band\b\s+(.+?)(?=\s+(?:for|agreement|contract|Payment|Start|End|Jurisdiction)\b|[.,;\n]|$)",
        r"(.+?)\s+සහ\s+(.+?)\s+අතර(?:\s+ගිවිසුම)?(?=\s|[.,;\n]|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1)), _clean_value(match.group(2))

    sentences = _split_sentences(text)
    candidates = []
    for sentence in sentences:
        match = re.search(
            r"(.+?)\s+(?:must|shall|will|agrees? to|දෙනවා|කරනවා)(?=\s|[.,;\n]|$)",
            sentence,
            flags=re.IGNORECASE,
        )
        if match:
            candidate = _clean_value(match.group(1))
            if candidate and candidate not in candidates:
                candidates.append(candidate)
    party_a = candidates[0] if candidates else None
    party_b = candidates[1] if len(candidates) > 1 else None
    return party_a, party_b


def _extract_contract_purpose_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"අතර\s+(.+?)\s+ඕනෑ",
        r"අතර\s+(.+?)\s+ඕන",
        r"(?:agreement|contract)\s+(?:for|is for)\s+(.+?)(?=\.\s|,\s*(?:Payment|Start|End|Jurisdiction)\b|$)",
        r"agreement(?:\s+\S+)?\s+(.+?)(?=\.\s|,\s*(?:Payment|Start|End|Jurisdiction)\b|$)",
        r"ගිවිසුම(?:\s+සඳහා|\s+වෙන්නේ)?\s+(.+?)(?=\.\s|,\s*(?:Payment|Start|End|Jurisdiction)\b|$)",
        r"(.+?ගිවිසුමක්)(?=\.\s|,\s*(?:Payment|Start|End|Jurisdiction)\b|$)",
        r"(.+?ගිවිසුම)(?=\.\s|,\s*(?:Payment|Start|End|Jurisdiction)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    sentence = next((s for s in _split_sentences(text) if "agreement" in s.lower() or "contract" in s.lower()), None)
    if sentence:
        purpose_match = re.search(r"\bfor\s+(.+)$", sentence, flags=re.IGNORECASE)
        if purpose_match:
            return _clean_value(purpose_match.group(1))
    return None


def _extract_party_obligation_sinhala(text: str, party: Optional[str]) -> Optional[str]:
    if not party:
        return None
    escaped_party = re.escape(party)
    patterns = [
        rf"{escaped_party}\s+(?:must|shall|will|agrees? to)\s+(.+?)(?=\.\s|,\s*(?:Payment|Start|End|Jurisdiction)\b|$)",
        rf"{escaped_party}\s+(.+?(?:දෙනවා|කරනවා).+?)(?=\.\s|,\s*(?:Payment|Start|End|Jurisdiction)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    return None


def _extract_payment_terms_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"Payment\s+රු[\.\s]*([\d,]+[^\.\n]*)",
        r"රු[\.\s]*([\d,]+\s*[^\.\n]{0,50})",
        r"Payment[:\s]+([^\.\n]+)",
        r"Payment(?: Terms)?\s*[:\-]?\s*(.+?)(?=\.\s|,\s*(?:Start|End|Jurisdiction)\b|$)",
        r"ගෙවීම\s*[:\-]?\s*(.+?)(?=\.\s|,\s*(?:Start|End|Jurisdiction)\b|$)",
        r"(රු\.\s*[\d,]+(?:\.\d{2})?[^.]*)(?=\.\s|$)",
        r"(රු\.?\s*[\d,]+(?:\.\d{2})?.*?)(?=\.\s|,\s*(?:Start|End|Jurisdiction)\b|$)",
        r"(Rs\.?\s*[\d,]+(?:\.\d{2})?.*?)(?=\.\s|,\s*(?:Start|End|Jurisdiction)\b|$)",
        r"(Payment\s+රු\.?\s*[\d,]+(?:\.\d{2})?.*?)(?=\.\s|,\s*(?:Start|End|Jurisdiction)\b|$)",
        r"(රු\.?\s*[\d,]+(?:\.\d{2})?\s*[^.]*?වාරික[^.]*?)(?=\.\s|,\s*(?:Start|End|Jurisdiction)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    return None


def _extract_labeled_date_value(text: str, labels: list[str]) -> Optional[str]:
    label_pattern = "|".join(re.escape(label) for label in labels)
    match = re.search(
        rf"(?:{label_pattern})\s*[:\-]?\s*({DATE_VALUE_PATTERN.pattern})",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return _clean_value(match.group(1))
    return None


def _extract_contract_dates_sinhala(text: str) -> tuple[Optional[str], Optional[str]]:
    start_date = _extract_labeled_date_value(text, ["ආරම්භය", "Start", "From", "Start Date"])
    end_date = _extract_labeled_date_value(text, ["අවසානය", "End", "To", "End Date"])
    return start_date, end_date


def _extract_contract_jurisdiction_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"Jurisdiction\s*[:\-]?\s*(.+?)(?=\.\s|$)",
        r"අධිකරණ\s*[:\-]?\s*(.+?)(?=\.\s|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    return _extract_jurisdiction_sinhala(text)


def _fallback_contract_extraction(text: str) -> Dict[str, Optional[str]]:
    party_a, party_b = _extract_contract_parties(text)
    start_date, end_date = _extract_contract_dates_sinhala(text)
    return {
        "party_a": party_a,
        "party_b": party_b,
        "contract_purpose": _extract_contract_purpose_sinhala(text),
        "obligations_a": _extract_party_obligation_sinhala(text, party_a),
        "obligations_b": _extract_party_obligation_sinhala(text, party_b),
        "payment_terms": _extract_payment_terms_sinhala(text),
        "start_date": start_date,
        "end_date": end_date,
        "jurisdiction": _extract_contract_jurisdiction_sinhala(text),
    }


def _extract_petitioner_name_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"Petitioner\s*[:\-]?\s*([^\n.]+?)(?=,\s*(?:NIC|Address|Date)\b|\.\s|$)",
        r"නම\s*[:\-]?\s*([^\n.]+?)(?=,\s*(?:NIC|Address|Date)\b|\.\s|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    return _extract_name_sinhala(text)


def _extract_petitioner_address_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"Address\s*[:\-]?\s*([^\n.]+?)(?=\.\s|,\s*(?:Respondent|Court|Date|Relief)\b|$)",
        r"ලිපිනය\s*[:\-]?\s*([^\n.]+?)(?=\.\s|,\s*(?:විත්තිකරු|Respondent|Court|Date|Relief)\b|$)",
        r"residing at\s+([^\n.]+?)(?=\.\s|,\s*(?:Respondent|Court|Date|Relief)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    return _extract_address_sinhala(text)


def _extract_respondent_name_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"Respondent\s*[:\-]?\s*([^\n.]+?)(?=\.\s|,\s*(?:Court|Date|Relief|Subject)\b|$)",
        r"විත්තිකරු\s*[:\-]?\s*([^\n.]+?)(?=\.\s|,\s*(?:Court|Date|Relief|Subject)\b|$)",
        r"එරෙහිව\s+([^\n.]+?)(?=\.\s|,\s*(?:Court|Date|Relief|Subject)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    return None


def _extract_court_name_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"Court\s*[:\-]?\s*([^\n.]+?)(?=\.\s|,\s*(?:Date|Relief|Subject)\b|$)",
        r"උසාවිය\s*[:\-]?\s*([^\n.]+?)(?=\.\s|,\s*(?:Date|Relief|Subject)\b|$)",
        r"අධිකරණය\s*[:\-]?\s*([^\n.]+?)(?=\.\s|,\s*(?:Date|Relief|Subject)\b|$)",
        r"([^\n.]*?(?:ශ්‍රේෂ්ඨාධිකරණය|අභියාචනාධිකරණය|දිසා අධිකරණය|මහාධිකරණය|මහේස්ත්‍රාත් අධිකරණය))(?=\s*(?:ඉදිරියේ|වෙත|හමුවේ|\.|,|$))",
        r"([^\n.]+?)\s+ඉදිරියේ(?=\s|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    return None


def _extract_subject_matter_sinhala(text: str) -> Optional[str]:
    sentences = _split_sentences(text)
    keywords = ("නීතිවිරෝධී", "unlawfully", "රඳවා", "detained", "magistrate")
    for sentence in sentences:
        if any(keyword.lower() in sentence.lower() for keyword in keywords):
            return _clean_value(sentence.rstrip(" .") + ".")
    return None


def _extract_relief_sought_sinhala(text: str) -> Optional[str]:
    patterns = [
        r"ඉල්ලා සිටිමි\s+(.+?)(?=\.\s|,\s*(?:Date|දිනය)\b|$)",
        r"\bseek\s+(.+?)(?=\.\s|,\s*(?:Date|දිනය)\b|$)",
        r"\brelief\s*[:\-]?\s*(.+?)(?=\.\s|,\s*(?:Date|දිනය)\b|$)",
        r"([^.]*?)\s+ඉල්ලා සිටිමි(?=\.\s|,\s*(?:Date|දිනය)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    return None


def _fallback_petition_extraction(text: str) -> Dict[str, Optional[str]]:
    return {
        "petitioner_name": _extract_petitioner_name_sinhala(text),
        "petitioner_nic": _extract_nic_sinhala(text),
        "petitioner_address": _extract_petitioner_address_sinhala(text),
        "respondent_name": _extract_respondent_name_sinhala(text),
        "court_name": _extract_court_name_sinhala(text),
        "subject_matter": _extract_subject_matter_sinhala(text),
        "relief_sought": _extract_relief_sought_sinhala(text),
        "date": _extract_date_sinhala(text),
    }


def _fallback_extraction(text: str, doc_type: str, required_fields: list) -> Dict[str, Optional[str]]:
    fallback = _empty_result(doc_type)
    if doc_type == "AFFIDAVIT":
        fallback.update(_fallback_affidavit_extraction(text))
    elif doc_type == "CONTRACT":
        fallback.update(_fallback_contract_extraction(text))
    elif doc_type == "PETITION":
        fallback.update(_fallback_petition_extraction(text))
    return {
        field: _clean_value(fallback.get(field))
        for field in required_fields
    }


def _merge_payloads(primary: Dict[str, Optional[str]], fallback: Dict[str, Optional[str]], required_fields: list) -> Dict[str, Optional[str]]:
    merged = {}
    for field in required_fields:
        merged[field] = primary.get(field) if primary.get(field) is not None else fallback.get(field)
    return merged


def get_confidence_scores(extracted_fields: Dict[str, Optional[str]], doc_type: str) -> Dict[str, Optional[str]]:
    confidence_scores = {}
    last_sources = _LAST_CONFIDENCE_SOURCES or {}

    for field in REQUIRED_FIELDS.get(doc_type, []):
        value = _clean_value(extracted_fields.get(field))
        confidence_scores[field] = last_sources.get(field) if value else None

    return confidence_scores


def extract_entities_gemini(text: str, doc_type: str) -> dict:
    fallback = _empty_result(doc_type)
    required_fields = REQUIRED_FIELDS.get(doc_type)
    client = _get_gemini_client()

    if not required_fields:
        return fallback
    if not client:
        merged = _fallback_extraction(text, doc_type, required_fields)
        _set_last_confidence_sources({
            field: ("MEDIUM" if merged.get(field) is not None else None)
            for field in required_fields
        })
        return merged

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
        fallback_payload = _fallback_extraction(text, doc_type, required_fields)
        merged = _merge_payloads(normalized, fallback_payload, required_fields)
        _set_last_confidence_sources(
            {
                field: (
                    "HIGH"
                    if normalized.get(field) is not None
                    else "MEDIUM"
                    if fallback_payload.get(field) is not None
                    else None
                )
                for field in required_fields
            }
        )
        print("[Gemini Extractor] Parsed result before validator:")
        print(json.dumps(merged, ensure_ascii=True, indent=2))
        return merged
    except Exception:
        merged = _fallback_extraction(text, doc_type, required_fields)
        _set_last_confidence_sources({
            field: ("MEDIUM" if merged.get(field) is not None else None)
            for field in required_fields
        })
        print("[Gemini Extractor] Raw response received from Gemini:")
        print(json.dumps("(exception or no response)", ensure_ascii=True, indent=2))
        print("[Gemini Extractor] Parsed result before validator:")
        print(json.dumps(merged, ensure_ascii=True, indent=2))
        return merged
