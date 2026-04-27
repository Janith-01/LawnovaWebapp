import re


CONTRACT_LEFT_ROLE_WORDS = [
    "party a",
    "first party",
    "employer",
    "buyer",
    "lessor",
    "landlord",
    "vendor",
    "service provider",
]
CONTRACT_RIGHT_ROLE_WORDS = [
    "party b",
    "second party",
    "employee",
    "seller",
    "lessee",
    "tenant",
    "client",
    "purchaser",
]
PETITION_LEFT_ROLE_WORDS = ["petitioner", "petitioner-appellant"]
PETITION_RIGHT_ROLE_WORDS = ["respondent", "respondent-respondent", "defendant"]
AFFIDAVIT_ROLE_WORDS = ["deponent", "affiant", "declarant"]


def _normalize_value(value):
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", str(value)).strip()
    cleaned = cleaned.strip(" \"'`")
    cleaned = re.sub(r"\s+[.;:]+$", "", cleaned)
    return cleaned or None


def _role_score(value: str, role_words: list) -> int:
    if not value:
        return 0
    lowered = value.lower()
    return sum(1 for word in role_words if word in lowered)


def _strip_role_words(value: str, role_words: list) -> str:
    if not value:
        return value

    keyword_pattern = "|".join(sorted((re.escape(word) for word in role_words), key=len, reverse=True))
    cleaned = value
    cleaned = re.sub(rf"^\s*(?:the|said)\s+(?=(?:{keyword_pattern})\b)", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(rf"^\s*(?:{keyword_pattern})\b\s*[:\-]?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        rf"\s*\(?(?:hereinafter\s+referred\s+to\s+as\s+the\s+)?(?:{keyword_pattern})\)?\s*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(rf"\s*-\s*(?:{keyword_pattern})\s*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(rf"\s*,\s*(?:{keyword_pattern})\s*$", "", cleaned, flags=re.IGNORECASE)
    return _normalize_value(cleaned)


def resolve_roles(entities: dict, doc_type: str) -> dict:
    updated = {key: _normalize_value(value) for key, value in dict(entities).items()}

    if doc_type == "AFFIDAVIT":
        updated["deponent_name"] = _strip_role_words(updated.get("deponent_name"), AFFIDAVIT_ROLE_WORDS)
        return updated

    if doc_type == "CONTRACT":
        party_a = updated.get("party_a")
        party_b = updated.get("party_b")

        if not party_a and party_b and _role_score(party_b, CONTRACT_LEFT_ROLE_WORDS) > _role_score(party_b, CONTRACT_RIGHT_ROLE_WORDS):
            party_a, party_b = party_b, None
        elif not party_b and party_a and _role_score(party_a, CONTRACT_RIGHT_ROLE_WORDS) > _role_score(party_a, CONTRACT_LEFT_ROLE_WORDS):
            party_a, party_b = None, party_a

        if party_a and party_b:
            a_left = _role_score(party_a, CONTRACT_LEFT_ROLE_WORDS)
            a_right = _role_score(party_a, CONTRACT_RIGHT_ROLE_WORDS)
            b_left = _role_score(party_b, CONTRACT_LEFT_ROLE_WORDS)
            b_right = _role_score(party_b, CONTRACT_RIGHT_ROLE_WORDS)
            if a_right > a_left and b_left > b_right:
                party_a, party_b = party_b, party_a

        all_contract_words = CONTRACT_LEFT_ROLE_WORDS + CONTRACT_RIGHT_ROLE_WORDS
        updated["party_a"] = _strip_role_words(party_a, all_contract_words)
        updated["party_b"] = _strip_role_words(party_b, all_contract_words)

        if updated.get("party_a") and updated.get("party_b") and updated["party_a"].lower() == updated["party_b"].lower():
            updated["party_b"] = None

        return updated

    if doc_type == "PETITION":
        petitioner = updated.get("petitioner_name")
        respondent = updated.get("respondent_name")

        if not petitioner and respondent and _role_score(respondent, PETITION_LEFT_ROLE_WORDS) > _role_score(respondent, PETITION_RIGHT_ROLE_WORDS):
            petitioner, respondent = respondent, None
        elif not respondent and petitioner and _role_score(petitioner, PETITION_RIGHT_ROLE_WORDS) > _role_score(petitioner, PETITION_LEFT_ROLE_WORDS):
            petitioner, respondent = None, petitioner

        if petitioner and respondent:
            petitioner_left = _role_score(petitioner, PETITION_LEFT_ROLE_WORDS)
            petitioner_right = _role_score(petitioner, PETITION_RIGHT_ROLE_WORDS)
            respondent_left = _role_score(respondent, PETITION_LEFT_ROLE_WORDS)
            respondent_right = _role_score(respondent, PETITION_RIGHT_ROLE_WORDS)
            if petitioner_right > petitioner_left and respondent_left > respondent_right:
                petitioner, respondent = respondent, petitioner

        all_petition_words = PETITION_LEFT_ROLE_WORDS + PETITION_RIGHT_ROLE_WORDS
        updated["petitioner_name"] = _strip_role_words(petitioner, all_petition_words)
        updated["respondent_name"] = _strip_role_words(respondent, all_petition_words)

        if (
            updated.get("petitioner_name")
            and updated.get("respondent_name")
            and updated["petitioner_name"].lower() == updated["respondent_name"].lower()
        ):
            updated["respondent_name"] = None

        return updated

    return updated
