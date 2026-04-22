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


def _clean_document_text(text: str) -> str:
    cleaned = re.sub(r"[ \t]+\n", "\n", text)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
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


def _has_value(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _process_conditionals(template: str, params: dict) -> str:
    def replacer(match):
        field_name = match.group(1)
        clause = match.group(2).strip()
        return clause if _has_value(params.get(field_name)) else ""

    return IF_PATTERN.sub(replacer, template)


def _normalize_instruction(instruction: str) -> str:
    return re.sub(r"\s+", " ", instruction).strip().lower()


def _contains_any(text: str, terms: list[str]) -> bool:
    return any(term in text for term in terms)


def _expand_affidavit_clause(language: str, instruction: str, params: dict) -> str:
    facts = params.get("statement_facts") or "the matters stated herein"

    if language == "si":
        if _contains_any(instruction, ["පෞද්ගලික", "දැනුම", "විශ්වාසය", "knowledge"]):
            return (
                "මෙහි සඳහන් කර ඇති කරුණු, වෙනත් ආකාරයකින් විශේෂයෙන් සඳහන් නොකළ පමණින්, "
                "මාගේ පෞද්ගලික දැනුම, විශ්වාසය සහ ලැබී ඇති සත්‍ය තොරතුරු මත පදනම්ව ප්‍රකාශ "
                "කරන ලද කරුණු වන අතර, ඒවා නිවැරදි බව මම විශ්වාස කරමි."
            )
        if _contains_any(instruction, ["අසත්‍ය", "ප්‍රතිවිපාක", "සත්‍ය", "truth", "consequence"]):
            return (
                f"එබැවින්, {facts} සම්බන්ධයෙන් මෙහි සඳහන් කර ඇති ප්‍රකාශ සත්‍ය හා නිවැරදි බව මම "
                "විධිමත්ව තහවුරු කරමි; අසත්‍ය ප්‍රකාශයක් කිරීමෙන් ශ්‍රී ලංකා නීතිය යටතේ නීතිමය "
                "ප්‍රතිවිපාක ඇතිවිය හැකි බව ද මට අවබෝධය ඇත."
            )
        return (
            "මෙම දිවුරුම් ප්‍රකාශය ගරුත්වයෙන් සහ අවංකභාවයෙන් ප්‍රකාශ කරනු ලබන අතර, "
            "මෙහි අන්තර්ගත කරුණු සත්‍ය බව මම තහවුරු කරමි."
        )

    if _contains_any(instruction, ["knowledge", "belief", "personal"]):
        return (
            "The statements contained herein, save where otherwise expressly stated, are made from "
            "my own personal knowledge, information, and bona fide belief, and I verily believe the "
            "same to be true and correct."
        )
    if _contains_any(instruction, ["truth", "consequence", "false", "oath"]):
        return (
            f"I therefore affirm that the matters set out in relation to {facts} are true and correct "
            "to the best of my knowledge, information, and belief, and that I am aware that any wilful "
            "false statement in an affidavit may attract legal consequences under the law of Sri Lanka."
        )
    return (
        "I make this affidavit conscientiously, voluntarily, and in good faith for all lawful purposes "
        "for which the same may be required."
    )


def _expand_contract_clause(language: str, instruction: str, params: dict) -> str:
    purpose = params.get("contract_purpose") or "the subject matter of this Agreement"

    if language == "si":
        if _contains_any(instruction, ["සද්භාවයෙන්", "නිසි අවධානය", "performance", "lawfully"]):
            return (
                f"පාර්ශවයන් දෙපාර්ශවයම {purpose} සම්බන්ධයෙන් මෙම ගිවිසුම යටතේ තම තමන්ගේ "
                "වගකීම් නීත්‍යානුකූලව, සද්භාවයෙන්, නිසි වෘත්තීය සැලකිල්ලෙන් සහ ප්‍රමාදයකින් තොරව "
                "ඉටු කිරීමට එකඟ වෙති."
            )
        if _contains_any(instruction, ["උල්ලංඝනය", "දැනුම්දීම", "ආරවුල්", "breach", "dispute"]):
            return (
                "යම් පාර්ශවයක් මෙම ගිවිසුමේ කොන්දේසියක් සැලකිය යුතු ලෙස උල්ලංඝනය කළහොත්, "
                "අනෙක් පාර්ශවය ලිඛිත දැනුම්දීමක් ලබා දී සාධාරණ කාලයකින් එම දෝෂය නිරාකරණය "
                "කරන ලෙස ඉල්ලා සිටිය හැකි අතර, එය නිරාකරණය නොකළහොත් ශ්‍රී ලංකා නීතිය යටතේ "
                "අදාළ අධිකරණ හමුවේ සුදුසු පිළියම් ඉල්ලා සිටිය හැක."
            )
        return (
            "මෙම ගිවිසුමට අදාළ සියලු කටයුතු ලිඛිත එකඟතාවයකින් සහ නීතියට අනුකූලව පවත්වාගෙන "
            "යා යුතුය."
        )

    if _contains_any(instruction, ["performance", "good faith", "lawfully", "diligence"]):
        return (
            f"Each Party shall, in relation to {purpose}, perform its respective obligations lawfully, "
            "in good faith, with due diligence, and with such skill, care, and attention as may "
            "reasonably be expected in the circumstances."
        )
    if _contains_any(instruction, ["breach", "notice", "cure", "dispute"]):
        return (
            "In the event of a material breach of this Agreement, the Party alleging such breach shall "
            "give written notice to the defaulting Party specifying the default and requiring the same "
            "to be remedied within a reasonable period; failing such remedy, the aggrieved Party shall "
            "be entitled to seek appropriate relief before the courts of Sri Lanka."
        )
    return (
        "The Parties acknowledge that this Agreement shall be carried into effect in accordance with "
        "its terms and the applicable law of Sri Lanka."
    )


def _expand_petition_clause(language: str, instruction: str, params: dict) -> str:
    subject_matter = params.get("subject_matter") or "the subject matter set out herein"
    relief_sought = params.get("relief_sought") or "the relief prayed for"

    if language == "si":
        if _contains_any(instruction, ["පසුබිම්", "නීතිමය පදනම", "background", "cause"]):
            return (
                f"{subject_matter} සම්බන්ධයෙන් ඇති වූ තත්ත්වයන් හේතුවෙන් පෙත්සම්කරුට නීතිමය හා "
                "සාධාරණ ආරක්ෂාව අවශ්‍ය වී ඇති අතර, එම කරුණු මෙම ගරු අධිකරණයේ අවධානයට "
                "විධිමත්ව ඉදිරිපත් කරනු ලැබේ."
            )
        if _contains_any(instruction, ["සුදුසුකම", "අසාධාරණය", "jurisdiction", "grounds", "prejudice"]):
            return (
                "ඉහත කරුණු අනුව, පෙත්සම්කරුට මෙම ගරු අධිකරණයේ අධිකරණ බලය ඉල්ලා සිටීමට "
                "නීතිමය සුදුසුකම ඇති අතර, පෙත්සම්කරුට සිදු වී ඇති හෝ සිදුවන අසාධාරණය "
                "වැළැක්වීම සඳහා අධිකරණ මැදිහත්වීම අත්‍යවශ්‍ය වේ."
            )
        if _contains_any(instruction, ["යාච්ඤා", "පිළියම්", "prayer", "equitable"]):
            return (
                f"එබැවින්, {relief_sought} ඇතුළුව නඩුවේ තත්ත්වය අනුව ගරු අධිකරණය විසින් "
                "සාධාරණ සහ සුදුසු යැයි සලකනු ලබන අනෙකුත් නියෝග ද ලබා දෙන ලෙස "
                "පෙත්සම්කරු ගෞරවයෙන් ඉල්ලා සිටියි."
            )
        return (
            "මෙම පෙත්සම සාධාරණය ඉටු කිරීම සඳහා ගරු අධිකරණය වෙත විධිමත්ව ඉදිරිපත් කරනු ලැබේ."
        )

    if _contains_any(instruction, ["background", "cause", "factual"]):
        return (
            f"The cause giving rise to this Petition arises from the facts connected with {subject_matter}, "
            "which facts have occasioned a legal grievance requiring the attention and intervention of "
            "this Honorable Court."
        )
    if _contains_any(instruction, ["grounds", "prejudice", "jurisdiction"]):
        return (
            "The Petitioner states that the circumstances disclosed herein entitle the Petitioner to "
            "invoke the jurisdiction of this Honorable Court and that, unless relief is granted, the "
            "Petitioner stands to suffer continuing prejudice, hardship, or denial of lawful entitlement."
        )
    if _contains_any(instruction, ["prayer", "relief", "equitable", "orders"]):
        return (
            f"The Petitioner therefore respectfully prays that this Honorable Court be pleased to grant "
            f"{relief_sought}, together with such further, other, or consequential relief as to Court "
            "shall seem meet, just, and equitable in the circumstances."
        )
    return (
        "The Petitioner respectfully seeks the intervention of this Honorable Court in the interests of "
        "justice and equity."
    )


def _expand_clause(doc_type: str, language: str, instruction: str, params: dict) -> str:
    normalized_instruction = _normalize_instruction(instruction)

    if doc_type == "AFFIDAVIT":
        return _expand_affidavit_clause(language, normalized_instruction, params)
    if doc_type == "CONTRACT":
        return _expand_contract_clause(language, normalized_instruction, params)
    return _expand_petition_clause(language, normalized_instruction, params)


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
    return _clean_document_text(rendered)


def draft_document(doc_type: str, params: dict, template: str, language: str) -> str:
    cleaned_params = {
        key: value for key, value in params.items() if not key.startswith("_")
    }
    language_instruction = (
        "Draft in formal English legal language used in Sri Lankan legal documents."
        if language == "en"
        else "ශ්‍රී ලාංකික නීතිමය ලේඛනවල භාවිත වන විධිමත් සිංහලෙන් කෙටුම්පත් කරන්න."
    )

    prompt = f"""
You are a Sri Lankan legal drafting assistant.
Prepare a complete {doc_type} using the exact structure supplied in the template.

Language instruction:
{language_instruction}

Non-negotiable rules:
- Preserve all fixed statutory references, governing-law clauses, court-jurisdiction boilerplate, headings, numbering, attestation text, and signature blocks exactly as written in the template.
- Do not alter the name of any Sri Lankan enactment or court reference already appearing in the template.
- Do not invent facts, parties, addresses, NIC numbers, dates, monetary values, or legal provisions that are not contained in the extracted parameters or fixed template boilerplate.
- If an [IF field: clause] marker refers to a missing or empty field, omit that clause entirely and do not leave the marker in the output.
- Replace each [EXPAND: instruction] marker with a clause that matches the surrounding section, the document type, and formal Sri Lankan legal drafting style.
- Keep the final draft internally consistent, formal, and ready for review.

Skeleton template:
\"\"\"
{template}
\"\"\"

Extracted parameters JSON:
{json.dumps(cleaned_params, ensure_ascii=False, indent=2)}

Instructions:
- Fill all {{{{placeholders}}}} with the correct parameter values.
- Expand all [EXPAND] markers into complete, document-appropriate legal clauses.
- Process all [IF] conditional sections correctly.
- Maintain formal Sri Lankan legal drafting style throughout.
- Return the complete drafted document as plain text only.
- Do not include markdown, explanations, or preambles.
""".strip()

    if not GEMINI_API_KEY:
        return _render_locally(doc_type, params, template, language)

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        drafted = _clean_document_text(_strip_code_fences(_extract_response_text(response)))
        if not drafted:
            return _render_locally(doc_type, params, template, language)
        return drafted
    except Exception:
        return _render_locally(doc_type, params, template, language)
