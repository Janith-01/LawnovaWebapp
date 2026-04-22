import re

from config import FIELD_LABELS, REQUIRED_FIELDS


NIC_PATTERN = re.compile(r"^(?:\d{9}[vVxX]|\d{12})$")
DATE_PATTERN = re.compile(
    r"(?:\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
    r"|\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}"
    r"|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4})",
    re.IGNORECASE,
)
DURATION_PATTERN = re.compile(r"\b\d+\s*(?:day|week|month|year)s?\b", re.IGNORECASE)
PLACEHOLDER_VALUES = {"", "n/a", "na", "none", "null", "unknown", "not provided", "not specified"}
ROLE_ONLY_VALUES = {
    "deponent",
    "affiant",
    "petitioner",
    "respondent",
    "party a",
    "party b",
    "first party",
    "second party",
    "employer",
    "employee",
    "buyer",
    "seller",
}
GENERIC_NAME_VALUES = {
    "need",
    "please",
    "draft",
    "prepare",
    "create",
    "make",
    "want",
    "document",
    "affidavit",
    "contract",
    "petition",
    "agreement",
    "service",
    "legal",
}

FIELD_HINTS = {
    "deponent_name": {
        "en": "Provide the full name of the deponent exactly as it should appear in the affidavit.",
        "si": "දිවුරුම් ප්‍රකාශයේ සඳහන් විය යුතු ආකාරයට ප්‍රකාශකයාගේ සම්පූර්ණ නම ලබා දෙන්න.",
    },
    "deponent_nic": {
        "en": "Provide the deponent's NIC in a valid Sri Lankan format.",
        "si": "ශ්‍රී ලාංකික වලංගු ආකෘතියකින් ප්‍රකාශකයාගේ ජාතික හැඳුනුම්පත් අංකය ලබා දෙන්න.",
    },
    "deponent_address": {
        "en": "Provide the deponent's address with house number, street, and city.",
        "si": "නිවසේ අංකය, වීදිය සහ නගරය සමඟ ප්‍රකාශකයාගේ ලිපිනය ලබා දෙන්න.",
    },
    "statement_facts": {
        "en": "Describe the facts being declared in clear legal language.",
        "si": "ප්‍රකාශ කරනු ලබන කරුණු පැහැදිලි නීතිමය ශෛලියෙන් සඳහන් කරන්න.",
    },
    "date": {
        "en": "Provide the document date, for example 2024-01-15.",
        "si": "උදාහරණයක් ලෙස 2024-01-15 වැනි ලේඛනයේ දිනය ලබා දෙන්න.",
    },
    "jurisdiction": {
        "en": "Provide the governing jurisdiction, such as Colombo, Sri Lanka.",
        "si": "උදාහරණයක් ලෙස Colombo, Sri Lanka වැනි අදාළ අධිකරණ බල ප්‍රදේශය ලබා දෙන්න.",
    },
    "party_a": {
        "en": "Provide the full legal name of the first party, employer, buyer, or equivalent party.",
        "si": "පළමු පාර්ශවය, සේවාදායකයා හෝ අදාළ පාර්ශවයේ සම්පූර්ණ නීතිමය නම ලබා දෙන්න.",
    },
    "party_b": {
        "en": "Provide the full legal name of the second party, employee, seller, or equivalent party.",
        "si": "දෙවන පාර්ශවය, සේවකයා හෝ අදාළ පාර්ශවයේ සම්පූර්ණ නීතිමය නම ලබා දෙන්න.",
    },
    "contract_purpose": {
        "en": "Explain the purpose of the contract or the service/transaction involved.",
        "si": "ගිවිසුමේ අරමුණ හෝ අදාළ සේවාව/ගනුදෙනුව කුමක්දැයි සඳහන් කරන්න.",
    },
    "obligations_a": {
        "en": "State what the first party is required to do under the contract.",
        "si": "ගිවිසුම යටතේ පළමු පාර්ශවය ඉටු කළ යුතු වගකීම් සඳහන් කරන්න.",
    },
    "obligations_b": {
        "en": "State what the second party is required to do under the contract.",
        "si": "ගිවිසුම යටතේ දෙවන පාර්ශවය ඉටු කළ යුතු වගකීම් සඳහන් කරන්න.",
    },
    "payment_terms": {
        "en": "Provide the payment amount and terms, such as Rs. 250,000 payable monthly.",
        "si": "උදාහරණයක් ලෙස Rs. 250,000 monthly වැනි ගෙවීම් මුදල සහ කොන්දේසි ලබා දෙන්න.",
    },
    "start_date": {
        "en": "Provide the start or effective date of the contract.",
        "si": "ගිවිසුම ආරම්භ වන හෝ බලපැවැත්වෙන දිනය ලබා දෙන්න.",
    },
    "end_date": {
        "en": "Provide the end date or the contract term, such as 12 months.",
        "si": "ගිවිසුම අවසන් වන දිනය හෝ 12 months වැනි කාල සීමාව ලබා දෙන්න.",
    },
    "petitioner_name": {
        "en": "Provide the petitioner's full legal name.",
        "si": "පෙත්සම්කරුගේ සම්පූර්ණ නීතිමය නම ලබා දෙන්න.",
    },
    "petitioner_nic": {
        "en": "Provide the petitioner's NIC in a valid Sri Lankan format.",
        "si": "ශ්‍රී ලාංකික වලංගු ආකෘතියකින් පෙත්සම්කරුගේ ජාතික හැඳුනුම්පත් අංකය ලබා දෙන්න.",
    },
    "petitioner_address": {
        "en": "Provide the petitioner's address with enough detail for court papers.",
        "si": "උසාවි ලේඛන සඳහා ප්‍රමාණවත් විස්තර සහිත පෙත්සම්කරුගේ ලිපිනය ලබා දෙන්න.",
    },
    "respondent_name": {
        "en": "Provide the respondent's full name or organization name.",
        "si": "විත්තිකරුගේ සම්පූර්ණ නම හෝ ආයතනයේ නම ලබා දෙන්න.",
    },
    "court_name": {
        "en": "Provide the full name of the relevant court.",
        "si": "අදාළ උසාවියේ සම්පූර්ණ නම ලබා දෙන්න.",
    },
    "subject_matter": {
        "en": "Briefly explain the legal subject matter of the petition.",
        "si": "පෙත්සමේ නීතිමය විෂය කරුණ කෙටියෙන් පැහැදිලි කරන්න.",
    },
    "relief_sought": {
        "en": "State the relief or order you want the court to grant.",
        "si": "උසාවියෙන් ඔබ ඉල්ලා සිටින පිළියම හෝ නියෝගය සඳහන් කරන්න.",
    },
}

DOC_TYPE_PROMPTS = {
    "AFFIDAVIT": {
        "en": "To prepare this affidavit, I still need the following details:",
        "si": "මෙම දිවුරුම් ප්‍රකාශය සකස් කිරීමට මට තවමත් පහත තොරතුරු අවශ්‍යයි:",
    },
    "CONTRACT": {
        "en": "To prepare this contract, I still need the following details:",
        "si": "මෙම ගිවිසුම සකස් කිරීමට මට තවමත් පහත තොරතුරු අවශ්‍යයි:",
    },
    "PETITION": {
        "en": "To prepare this petition, I still need the following details:",
        "si": "මෙම පෙත්සම සකස් කිරීමට මට තවමත් පහත තොරතුරු අවශ්‍යයි:",
    },
}

DOC_TYPE_VAGUE_MESSAGES = {
    "AFFIDAVIT": {
        "en": (
            "Your affidavit request is too vague for me to extract any useful legal details. "
            "Please provide the deponent's name, NIC, address, the facts being declared, the date, and the jurisdiction.\n"
            "Example:\n"
            "I, [full name], holding NIC [NIC number], residing at [address], wish to make an affidavit declaring that [facts]. "
            "Date: [YYYY-MM-DD]. Jurisdiction: [city, Sri Lanka]."
        ),
        "si": (
            "ඔබගේ දිවුරුම් ප්‍රකාශ ඉල්ලීමෙන් ප්‍රයෝජනවත් නීතිමය තොරතුරු කිසිවක් හඳුනාගත නොහැකි තරම් අඩු විස්තර ඇත. "
            "කරුණාකර ප්‍රකාශකයාගේ නම, NIC, ලිපිනය, ප්‍රකාශ කරන කරුණු, දිනය සහ අධිකරණ බල ප්‍රදේශය ලබා දෙන්න.\n"
            "උදාහරණය:\n"
            "මම [සම්පූර්ණ නම], NIC [අංකය], [ලිපිනය] පදිංචි, [කරුණු] පිළිබඳ දිවුරුම් ප්‍රකාශයක් සකස් කිරීමට කැමතියි. "
            "Date: [YYYY-MM-DD]. Jurisdiction: [city, Sri Lanka]."
        ),
    },
    "CONTRACT": {
        "en": (
            "Your contract request is too vague for me to extract any useful legal details. "
            "Please provide both parties, the contract purpose, each party's obligations, payment terms, the start and end date, and the jurisdiction.\n"
            "Example:\n"
            "This contract is between [party A] and [party B] for [purpose]. [Party A] shall [obligations]. "
            "[Party B] shall [obligations]. Payment Terms: [amount/terms]. Start Date: [YYYY-MM-DD]. "
            "End Date: [YYYY-MM-DD or term]. Jurisdiction: [city, Sri Lanka]."
        ),
        "si": (
            "ඔබගේ ගිවිසුම් ඉල්ලීමෙන් ප්‍රයෝජනවත් නීතිමය තොරතුරු කිසිවක් හඳුනාගත නොහැකි තරම් අඩු විස්තර ඇත. "
            "කරුණාකර පාර්ශව දෙකම, ගිවිසුමේ අරමුණ, එක් එක් පාර්ශවයේ වගකීම්, ගෙවීම් කොන්දේසි, ආරම්භක සහ අවසන් දිනය, සහ අධිකරණ බල ප්‍රදේශය ලබා දෙන්න.\n"
            "උදාහරණය:\n"
            "This contract is between [party A] and [party B] for [purpose]. [Party A] shall [obligations]. "
            "[Party B] shall [obligations]. Payment Terms: [amount/terms]. Start Date: [YYYY-MM-DD]. "
            "End Date: [YYYY-MM-DD or term]. Jurisdiction: [city, Sri Lanka]."
        ),
    },
    "PETITION": {
        "en": (
            "Your petition request is too vague for me to extract any useful legal details. "
            "Please provide the petitioner's details, the respondent, the court name, the subject matter, the relief sought, and the date.\n"
            "Example:\n"
            "Petitioner: [full name], NIC [NIC number], Address: [address]. Respondent: [name or organization]. "
            "Court: [full court name]. Subject Matter: [issue]. Relief Sought: [requested order]. Date: [YYYY-MM-DD]."
        ),
        "si": (
            "ඔබගේ පෙත්සම් ඉල්ලීමෙන් ප්‍රයෝජනවත් නීතිමය තොරතුරු කිසිවක් හඳුනාගත නොහැකි තරම් අඩු විස්තර ඇත. "
            "කරුණාකර පෙත්සම්කරුගේ තොරතුරු, විත්තිකරු, උසාවියේ නම, විෂය කරුණ, ඉල්ලා සිටින පිළියම සහ දිනය ලබා දෙන්න.\n"
            "උදාහරණය:\n"
            "Petitioner: [full name], NIC [NIC number], Address: [address]. Respondent: [name or organization]. "
            "Court: [full court name]. Subject Matter: [issue]. Relief Sought: [requested order]. Date: [YYYY-MM-DD]."
        ),
    },
}


def _normalize_text(value):
    if value is None:
        return None
    return re.sub(r"\s+", " ", str(value)).strip()


def _has_letters(value: str) -> bool:
    return bool(re.search(r"[A-Za-z\u0D80-\u0DFF]", value))


def _looks_like_date(value: str) -> bool:
    return bool(DATE_PATTERN.search(value))


def _looks_like_duration(value: str) -> bool:
    return bool(DURATION_PATTERN.search(value))


def _is_valid_nic(value: str) -> bool:
    return bool(NIC_PATTERN.fullmatch(value))


def _is_usable_value(field: str, value, doc_type: str) -> bool:
    normalized = _normalize_text(value)
    if not normalized:
        return False
    if normalized.lower() in PLACEHOLDER_VALUES:
        return False

    if field in {"deponent_nic", "petitioner_nic"}:
        return _is_valid_nic(normalized)

    if field in {"date", "start_date"}:
        return _looks_like_date(normalized)

    if field == "end_date":
        return _looks_like_date(normalized) or _looks_like_duration(normalized)

    if field in {"deponent_name", "party_a", "party_b", "petitioner_name", "respondent_name"}:
        if normalized.lower() in ROLE_ONLY_VALUES:
            return False
        if normalized.lower() in GENERIC_NAME_VALUES:
            return False
        if field in {"deponent_name", "petitioner_name"} and " " not in normalized and len(normalized) < 8:
            return False
        return _has_letters(normalized) and len(normalized) >= 3

    if field in {"deponent_address", "petitioner_address"}:
        return _has_letters(normalized) and len(normalized) >= 8

    if field == "jurisdiction":
        return _has_letters(normalized) and len(normalized) >= 3

    if field == "court_name":
        return _has_letters(normalized) and len(normalized) >= 5

    if field == "payment_terms":
        return len(normalized) >= 4 and bool(re.search(r"\d", normalized))

    if field in {"statement_facts", "contract_purpose", "obligations_a", "obligations_b", "subject_matter", "relief_sought"}:
        return _has_letters(normalized) and len(normalized) >= 6

    return True


def _build_missing_message(doc_type: str, missing_fields: list, language: str) -> str:
    intro = DOC_TYPE_PROMPTS.get(doc_type, {}).get(language)
    if not intro:
        intro = (
            "The following details are still required:"
            if language == "en"
            else "තවමත් පහත තොරතුරු අවශ්‍යයි:"
        )

    lines = []
    for field in missing_fields:
        label = FIELD_LABELS.get(field, {}).get(language, field)
        hint = FIELD_HINTS.get(field, {}).get(language, "")
        if hint:
            lines.append(f"- {label}: {hint}")
        else:
            lines.append(f"- {label}")

    outro = (
        "Please reply with the missing details in one message and try again."
        if language == "en"
        else "කරුණාකර අඩුපාඩු තොරතුරු එකම පණිවිඩයකින් ලබා දී නැවත උත්සාහ කරන්න."
    )

    return "\n".join([intro, *lines, outro])


def _build_too_vague_message(doc_type: str, language: str) -> str:
    return DOC_TYPE_VAGUE_MESSAGES.get(doc_type, {}).get(
        language,
        DOC_TYPE_VAGUE_MESSAGES.get(doc_type, {}).get("en", ""),
    )


def validate_fields(doc_type: str, extracted_params: dict, language: str) -> dict:
    required_fields = REQUIRED_FIELDS.get(doc_type, [])
    usable_fields = [
        field for field in required_fields
        if _is_usable_value(field, extracted_params.get(field), doc_type)
    ]
    missing_fields = [
        field for field in required_fields
        if field not in usable_fields
    ]

    if not usable_fields:
        return {
            "status": "incomplete",
            "missing_fields": [],
            "message": _build_too_vague_message(doc_type, language),
        }

    if not missing_fields:
        message = (
            "All required details are present."
            if language == "en"
            else "අවශ්‍ය සියලු තොරතුරු සම්පූර්ණයි."
        )
        return {
            "status": "complete",
            "missing_fields": [],
            "message": message,
        }

    return {
        "status": "incomplete",
        "missing_fields": missing_fields,
        "message": _build_missing_message(doc_type, missing_fields, language),
    }
