import re
from typing import Dict, List

import spacy

from config import REQUIRED_FIELDS


NIC_PATTERN = re.compile(r"\b(?:\d{9}[vVxX]|\d{12})\b")
DURATION_PATTERN = re.compile(r"\b\d+\s*(?:year|month|day)s?\b", re.IGNORECASE)
MONEY_PATTERN = re.compile(r"\bRs\.?\s*[\d,]+(?:\.\d{2})?\b", re.IGNORECASE)

_NLP = None


def _get_nlp():
    global _NLP
    if _NLP is None:
        try:
            _NLP = spacy.load("en_core_web_sm")
        except OSError:
            _NLP = spacy.blank("en")
    return _NLP


def _empty_result(doc_type: str) -> Dict[str, str]:
    return {field: None for field in REQUIRED_FIELDS.get(doc_type, [])}


def _clean_value(value: str) -> str:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned.rstrip(" ,;")


def _find_first(patterns: List[str], text: str) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            return _clean_value(match.group(1))
    return None


def _collect_role_candidates(doc, text: str) -> List[Dict[str, str]]:
    candidates = []
    seen = set()
    for ent in doc.ents:
        if ent.label_ not in {"PERSON", "ORG"}:
            continue
        candidate_text = _clean_value(ent.text)
        if not candidate_text or candidate_text.lower() in seen:
            continue
        start = max(0, ent.start_char - 40)
        end = min(len(text), ent.end_char + 40)
        candidates.append(
            {
                "text": candidate_text,
                "label": ent.label_,
                "context": text[start:end].lower(),
            }
        )
        seen.add(candidate_text.lower())
    return candidates


def _extract_date_value(text: str, label: str) -> str:
    pattern = rf"\b{label}\s*[:\-]\s*([A-Za-z0-9,/\- ]+)"
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if match:
        return _clean_value(match.group(1))
    return None


def _extract_address(text: str) -> str:
    return _find_first(
        [
            r"residing at\s+(.+?)(?=,\s*(?:wish to|do hereby|hereby|declare|declaring|state|stating)\b)",
            r"address(?:ed)? as\s+(.+?)(?=,\s*(?:wish to|do hereby|hereby|declare|declaring|state|stating)\b)",
            r"of\s+(.+?)(?=,\s*(?:hereinafter|wish to|who is|who are)\b)",
        ],
        text,
    )


def _extract_statement_facts(text: str) -> str:
    return _find_first(
        [
            r"(?:declaring|declare|stating|state)\s+that\s+(.+?)(?=\.\s*(?:Date|Jurisdiction)\s*:|$)",
            r"facts?\s*(?:are|is)?\s*[:\-]\s*(.+?)(?=\.\s*(?:Date|Jurisdiction)\s*:|$)",
        ],
        text,
    )


def _extract_contract_purpose(text: str) -> str:
    return _find_first(
        [
            r"(?:agreement|contract)\s+(?:for|to)\s+(.+?)(?=\.\s|,\s*(?:between|with|whereby)|$)",
            r"purpose\s*[:\-]\s*(.+?)(?=\.\s|,\s*(?:party|payment|start date|end date)|$)",
        ],
        text,
    )


def _extract_obligation(text: str, role_name: str) -> str:
    return _find_first(
        [
            rf"{role_name}\s+(?:shall|agrees? to|will)\s+(.+?)(?=\.\s|,\s*(?:party|payment|jurisdiction)|$)",
        ],
        text,
    )


def _extract_jurisdiction(text: str) -> str:
    match = re.search(r"\bJurisdiction\s*[:\-]\s*([A-Za-z ,]+)", text, flags=re.IGNORECASE)
    if match:
        return _clean_value(match.group(1))
    return None


def _extract_court_name(text: str) -> str:
    return _find_first(
        [
            r"(?:before|in)\s+the\s+(.+?court.+?)(?=,|\.)",
            r"court\s*[:\-]\s*(.+?)(?=,|\.)",
        ],
        text,
    )


def _extract_subject_matter(text: str) -> str:
    return _find_first(
        [
            r"subject matter\s*[:\-]\s*(.+?)(?=\.\s|,\s*(?:relief|date)|$)",
            r"(?:regarding|about)\s+(.+?)(?=\.\s|,\s*(?:relief|date)|$)",
        ],
        text,
    )


def _extract_relief_sought(text: str) -> str:
    return _find_first(
        [
            r"relief(?: sought)?\s*[:\-]\s*(.+?)(?=\.\s|,\s*date|$)",
            r"(?:seek|seeking|requesting)\s+(.+?)(?=\.\s|,\s*date|$)",
        ],
        text,
    )


def extract_entities_ner(text: str, doc_type: str) -> dict:
    extracted = _empty_result(doc_type)
    if doc_type not in REQUIRED_FIELDS:
        return extracted

    nlp = _get_nlp()
    doc = nlp(text)

    people = []
    orgs = []
    dates = []
    locations = []
    cardinals = []

    for ent in doc.ents:
        value = _clean_value(ent.text)
        if not value:
            continue
        if ent.label_ == "PERSON" and value not in people:
            people.append(value)
        elif ent.label_ == "ORG" and value not in orgs:
            orgs.append(value)
        elif ent.label_ == "DATE" and value not in dates:
            dates.append(value)
        elif ent.label_ in {"GPE", "LOC"} and value not in locations:
            locations.append(value)
        elif ent.label_ == "CARDINAL" and value not in cardinals:
            cardinals.append(value)

    role_candidates = _collect_role_candidates(doc, text)
    nic_matches = NIC_PATTERN.findall(text)
    money_matches = MONEY_PATTERN.findall(text)
    duration_matches = DURATION_PATTERN.findall(text)

    if doc_type == "AFFIDAVIT":
        extracted["deponent_name"] = people[0] if people else None
        extracted["deponent_nic"] = nic_matches[0] if nic_matches else (cardinals[0] if cardinals else None)
        extracted["deponent_address"] = _extract_address(text)
        extracted["statement_facts"] = _extract_statement_facts(text)
        extracted["date"] = _extract_date_value(text, "Date") or (dates[0] if dates else None)
        extracted["jurisdiction"] = _extract_jurisdiction(text) or (locations[-1] if locations else None)

    elif doc_type == "CONTRACT":
        party_candidates = [candidate["text"] for candidate in role_candidates]
        if party_candidates:
            extracted["party_a"] = party_candidates[0]
        if len(party_candidates) > 1:
            extracted["party_b"] = party_candidates[1]
        extracted["contract_purpose"] = _extract_contract_purpose(text)
        extracted["obligations_a"] = _extract_obligation(text, "party a") or _extract_obligation(text, "first party")
        extracted["obligations_b"] = _extract_obligation(text, "party b") or _extract_obligation(text, "second party")
        extracted["payment_terms"] = money_matches[0] if money_matches else None
        extracted["start_date"] = _extract_date_value(text, "Start Date") or (dates[0] if dates else None)
        extracted["end_date"] = _extract_date_value(text, "End Date") or (dates[1] if len(dates) > 1 else None)
        extracted["jurisdiction"] = _extract_jurisdiction(text) or (locations[-1] if locations else None)
        if duration_matches and not extracted["end_date"]:
            extracted["end_date"] = duration_matches[0]

    elif doc_type == "PETITION":
        petitioner = None
        respondent = None
        for candidate in role_candidates:
            context = candidate["context"]
            if not petitioner and "petitioner" in context and candidate["label"] == "PERSON":
                petitioner = candidate["text"]
            elif not respondent and ("respondent" in context or candidate["label"] == "ORG"):
                respondent = candidate["text"]

        extracted["petitioner_name"] = petitioner or (people[0] if people else None)
        extracted["petitioner_nic"] = nic_matches[0] if nic_matches else (cardinals[0] if cardinals else None)
        extracted["petitioner_address"] = _extract_address(text)
        extracted["respondent_name"] = respondent or (orgs[0] if orgs else (people[1] if len(people) > 1 else None))
        extracted["court_name"] = _extract_court_name(text)
        extracted["subject_matter"] = _extract_subject_matter(text)
        extracted["relief_sought"] = _extract_relief_sought(text)
        extracted["date"] = _extract_date_value(text, "Date") or (dates[0] if dates else None)

    return extracted
