import json
import re

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL, REQUIRED_FIELDS


def _empty_result(doc_type: str) -> dict:
    return {field: None for field in REQUIRED_FIELDS.get(doc_type, [])}


def _strip_code_fences(raw_text: str) -> str:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _extract_response_text(response) -> str:
    text = getattr(response, "text", None)
    if text:
        return text

    fragments = []
    for candidate in getattr(response, "candidates", []) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", []) or []:
            part_text = getattr(part, "text", None)
            if part_text:
                fragments.append(part_text)
    return "\n".join(fragments)


def extract_entities_gemini(text: str, doc_type: str) -> dict:
    fallback = _empty_result(doc_type)
    required_fields = REQUIRED_FIELDS.get(doc_type)
    if not required_fields or not GEMINI_API_KEY:
        return fallback

    prompt = f"""
You are a Sri Lankan legal parameter extractor.
The user prompt below is in Sinhala and describes a legal document request.

Document type: {doc_type}
Required fields: {json.dumps(required_fields, ensure_ascii=False)}

User prompt:
\"\"\"
{text}
\"\"\"

Return ONLY a valid JSON object with exactly the required fields.
If a field is missing, set its value to null.
Do not include markdown, code fences, explanations, or any extra text.
""".strip()

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        raw_text = _extract_response_text(response)
        cleaned = _strip_code_fences(raw_text)
        payload = json.loads(cleaned)
        return {field: payload.get(field) for field in required_fields}
    except Exception:
        return fallback
