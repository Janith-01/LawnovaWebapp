import json
import re

import google.generativeai as genai
from jinja2 import Template

from config import GEMINI_API_KEY, GEMINI_MODEL


IF_PATTERN = re.compile(r"\[IF\s+([a-zA-Z0-9_]+)\s*:\s*(.*?)\]", re.DOTALL)
EXPAND_PATTERN = re.compile(r"\[EXPAND:\s*(.*?)\]")


def _strip_code_fences(raw_text: str) -> str:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:text|markdown)?\s*", "", cleaned, flags=re.IGNORECASE)
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


def _process_conditionals(template: str, params: dict) -> str:
    def replacer(match):
        field_name = match.group(1)
        clause = match.group(2).strip()
        return clause if params.get(field_name) else ""

    return IF_PATTERN.sub(replacer, template)


def _expand_clause(doc_type: str, language: str, instruction: str, params: dict) -> str:
    if doc_type == "AFFIDAVIT":
        if language == "si":
            return (
                "මෙහි සදහන් කරුණු සියල්ලම මගේ දැනුම, විශ්වාසය සහ තොරතුරු අනුව සත්‍ය බව "
                "මම විධිමත්ව ප්‍රකාශ කරමි. අසත්‍ය ප්‍රකාශයක් කිරීම ශ්‍රී ලංකා නීතිය යටතේ "
                "වගකීම් ඇතිකරනු ඇති බව මම දනිමි."
            )
        return (
            "I make this affidavit conscientiously believing the contents herein to be true and "
            "correct, and I am aware that any false declaration may attract legal consequences "
            "under the laws of Sri Lanka."
        )

    if doc_type == "CONTRACT":
        if language == "si":
            return (
                "පාර්ශවයන් දෙපාර්ශවයම මෙම ගිවිසුමේ කොන්දේසි යහපත් විශ්වාසයෙන් ඉටු කිරීමට එකඟ වන අතර, "
                "ගිවිසුම උල්ලංඝනය වුවහොත් ශ්‍රී ලංකා නීතිය යටතේ සුදුසු නීතිමය පියවර ගැනීමට අයිතිය ඇත."
            )
        return (
            "The Parties agree to perform their respective obligations in good faith and acknowledge "
            "that any breach may give rise to legal remedies available under the laws of Sri Lanka."
        )

    if language == "si":
        return (
            "මෙම ගරු අධිකරණය ඉදිරියේ මෙම පෙත්සම ගරුත්වයෙන් ඉදිරිපත් කරනු ලබන අතර, "
            "සාධාරණය ඉටු කිරීම සඳහා ඉල්ලා ඇති පිළියම් ලබාදෙන ලෙස ගරු අධිකරණයෙන් ගෞරවයෙන් ඉල්ලා සිටිමු."
        )
    return (
        "The Petitioner respectfully states that this Honorable Court has jurisdiction to consider "
        "this matter and to grant the relief prayed for herein in the interests of justice."
    )


def _render_locally(doc_type: str, params: dict, template: str, language: str) -> str:
    safe_params = {
        key: ("" if value is None else value)
        for key, value in params.items()
        if not key.startswith("_")
    }
    prepared = _process_conditionals(template, safe_params)
    prepared = EXPAND_PATTERN.sub(
        lambda match: _expand_clause(doc_type, language, match.group(1), safe_params),
        prepared,
    )
    rendered = Template(prepared).render(**safe_params)
    rendered = re.sub(r"\n{3,}", "\n\n", rendered)
    return rendered.strip()


def draft_document(doc_type: str, params: dict, template: str, language: str) -> str:
    prompt = f"""
You are a Sri Lankan legal drafting assistant.
Document type: {doc_type}
Language instruction: {"Draft in formal English legal language" if language == "en" else "ශ්‍රී ලාංකික නීතිමය ලේඛන විධිමත් සිංහලෙන් සකස් කරන්න"}

Skeleton template:
\"\"\"
{template}
\"\"\"

Extracted parameters JSON:
{json.dumps({key: value for key, value in params.items() if not key.startswith("_")}, ensure_ascii=False, indent=2)}

Instructions:
- Fill all {{{{placeholders}}}} with the correct parameter values.
- Expand all [EXPAND] markers into full formal legal clauses.
- Process all [IF] conditional sections appropriately.
- Maintain a formal legal tone throughout.
- Return the complete drafted document as plain text only.
- Do not include markdown, explanations, or preambles.
""".strip()

    if not GEMINI_API_KEY:
        return _render_locally(doc_type, params, template, language)

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        drafted = _strip_code_fences(_extract_response_text(response))
        if not drafted:
            return _render_locally(doc_type, params, template, language)
        return drafted
    except Exception:
        return _render_locally(doc_type, params, template, language)
