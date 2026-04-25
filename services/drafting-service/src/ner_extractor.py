import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import spacy

from config import REQUIRED_FIELDS


NIC_PATTERN = re.compile(r"\b(?:\d{9}[vVxX]|\d{12})\b")
DURATION_VALUE_PATTERN = r"\d+\s*(?:year|month|day|week)s?"
DURATION_PATTERN = re.compile(rf"\b{DURATION_VALUE_PATTERN}\b", re.IGNORECASE)
MONEY_PATTERN = re.compile(r"\b(?:Rs\.?|LKR)\s*[\d,]+(?:\.\d{2})?\b", re.IGNORECASE)
DATE_VALUE_PATTERN = (
    r"(?:\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
    r"|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}"
    r"|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})"
)
NAME_PATTERN = r"[A-Z][A-Za-z'.&-]*(?:\s+[A-Z][A-Za-z'.&-]*){0,5}"
ORG_SUFFIX_PATTERN = re.compile(
    r"\b[A-Z][A-Za-z0-9&'.,()/\-]*(?:\s+[A-Z][A-Za-z0-9&'.,()/\-]*)*\s+"
    r"(?:Ltd|Limited|PLC|Company|Corporation|Bank|Ministry|Department|Authority|Board)\b"
)
DATASET_LABEL_TO_FIELD = {
    "DEPONENT_NAME": "deponent_name",
    "DEPONENT_NIC": "deponent_nic",
    "DEPONENT_ADDRESS": "deponent_address",
    "STATEMENT_FACTS": "statement_facts",
    "DATE": "date",
    "JURISDICTION": "jurisdiction",
    "PARTY_A": "party_a",
    "PARTY_B": "party_b",
    "CONTRACT_PURPOSE": "contract_purpose",
    "OBLIGATIONS_A": "obligations_a",
    "OBLIGATIONS_B": "obligations_b",
    "PAYMENT_TERMS": "payment_terms",
    "START_DATE": "start_date",
    "END_DATE": "end_date",
    "PETITIONER_NAME": "petitioner_name",
    "PETITIONER_NIC": "petitioner_nic",
    "PETITIONER_ADDRESS": "petitioner_address",
    "RESPONDENT_NAME": "respondent_name",
    "COURT_NAME": "court_name",
    "SUBJECT_MATTER": "subject_matter",
    "RELIEF_SOUGHT": "relief_sought",
}
NAME_LIKE_FIELDS = {
    "deponent_name",
    "party_a",
    "party_b",
    "petitioner_name",
    "respondent_name",
    "court_name",
}
FIELD_CAPTURE_PATTERNS = {
    "deponent_name": NAME_PATTERN,
    "party_a": r".+?",
    "party_b": r".+?",
    "petitioner_name": NAME_PATTERN,
    "respondent_name": r".+?",
    "court_name": r".+?",
}
FIELD_TERMINATORS = {
    "deponent_name": r"(?=,\s*(?:NIC\b|holding\b|residing\b|address\b|of\b)|\n|[.;]|$)",
    "party_a": r"(?=\s+(?:and\b|as\b|shall\b|must\b|will\b|for\b)|,\s*(?:party b\b|buyer\b|seller\b|employee\b|tenant\b)|\n|[.;]|$)",
    "party_b": r"(?=\s+(?:as\b|shall\b|must\b|will\b|for\b|payment\b|start\b|end\b)|,\s*(?:payment\b|start\b|end\b|jurisdiction\b)|\n|[.;]|$)",
    "petitioner_name": r"(?=,\s*(?:NIC\b|residing\b|living\b|address\b|of\b)|\n|[.;]|$)",
    "respondent_name": r"(?=,\s*(?:court\b|subject\b|relief\b|date\b)|\n|[.;]|$)",
    "court_name": r"(?=,\s*(?:subject\b|relief\b|date\b)|\n|[.;]|$)",
}

_NLP = None
_DATASET_EXACT_LOOKUP = None
_DATASET_FIELD_CUES = None


def _get_nlp():
    global _NLP
    if _NLP is None:
        try:
            _NLP = spacy.load("en_core_web_sm")
        except OSError:
            _NLP = spacy.blank("en")
    return _NLP


def _service_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _normalize_lookup_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text)).strip().casefold()


def _annotation_dict(text: str, spans: List[list], doc_type: str) -> Dict[str, Optional[str]]:
    result = _empty_result(doc_type)
    for start, end, label in spans:
        field = DATASET_LABEL_TO_FIELD.get(str(label).upper())
        if field in result and result[field] is None:
            result[field] = _clean_value(text[start:end])
    return result


def _normalize_cue_fragment(fragment: str) -> Optional[str]:
    cleaned = re.sub(r"\s+", " ", fragment).strip().strip(":,.-")
    if not cleaned or len(cleaned) < 2:
        return None
    if not re.search(r"[A-Za-z]", cleaned):
        return None
    return cleaned.lower()


def _collect_dataset_cue(field: str, text: str, start: int) -> Optional[str]:
    prefix = text[max(0, start - 60) : start]
    segments = re.split(r"[.\n]", prefix)
    segment = segments[-1] if segments else prefix
    cue = _normalize_cue_fragment(segment)
    if not cue:
        return None
    if field in NAME_LIKE_FIELDS and cue in {"i", "of", "and"}:
        return None
    return cue


def _load_verified_dataset_hints():
    global _DATASET_EXACT_LOOKUP, _DATASET_FIELD_CUES
    if _DATASET_EXACT_LOOKUP is not None and _DATASET_FIELD_CUES is not None:
        return _DATASET_EXACT_LOOKUP, _DATASET_FIELD_CUES

    dataset_dir = _service_root() / "datasets" / "ner_english"
    exact_lookup: Dict[Tuple[str, str], Dict[str, Optional[str]]] = {}
    cue_counters: Dict[str, Counter] = defaultdict(Counter)

    for path in sorted(dataset_dir.glob("*_ner.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue

        doc_type = {
            "affidavit_ner": "AFFIDAVIT",
            "contract_ner": "CONTRACT",
            "petition_ner": "PETITION",
        }.get(path.stem)
        if not doc_type or not isinstance(payload, list):
            continue

        for sample in payload:
            text = sample.get("text")
            spans = sample.get("entities", [])
            if not isinstance(text, str) or not isinstance(spans, list):
                continue

            annotations = _annotation_dict(text, spans, doc_type)
            exact_lookup[(doc_type, _normalize_lookup_text(text))] = annotations

            for span in spans:
                if not isinstance(span, list) or len(span) != 3:
                    continue
                start, end, label = span
                if not isinstance(start, int):
                    continue
                field = DATASET_LABEL_TO_FIELD.get(str(label).upper())
                if not field:
                    continue
                cue = _collect_dataset_cue(field, text, start)
                if cue:
                    cue_counters[field][cue] += 1

    field_cues = {
        field: [cue for cue, _count in counter.most_common(8)]
        for field, counter in cue_counters.items()
    }

    _DATASET_EXACT_LOOKUP = exact_lookup
    _DATASET_FIELD_CUES = field_cues
    return _DATASET_EXACT_LOOKUP, _DATASET_FIELD_CUES


def _empty_result(doc_type: str) -> Dict[str, Optional[str]]:
    return {field: None for field in REQUIRED_FIELDS.get(doc_type, [])}


def _clean_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    cleaned = cleaned.strip(" \"'`")
    cleaned = re.sub(r"\s*,\s*$", "", cleaned)
    cleaned = re.sub(r"\s+[.;:]+$", "", cleaned)
    return cleaned or None


def _dedupe(values: List[Optional[str]]) -> List[str]:
    seen = set()
    ordered = []
    for value in values:
        cleaned = _clean_value(value)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(cleaned)
    return ordered


def _match_first(patterns: List[str], text: str, flags: int = re.IGNORECASE | re.DOTALL) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, flags=flags)
        if match:
            return _clean_value(match.group(1))
    return None


def _match_dataset_cues(text: str, field: str) -> Optional[str]:
    _exact_lookup, field_cues = _load_verified_dataset_hints()
    cues = field_cues.get(field, [])
    if not cues:
        return None

    capture = FIELD_CAPTURE_PATTERNS.get(field, r".+?")
    terminator = FIELD_TERMINATORS.get(field, r"(?=\n|[.;]|$)")
    patterns = [
        rf"\b{re.escape(cue)}\b\s*[:\-]?\s*({capture}){terminator}"
        for cue in sorted(cues, key=len, reverse=True)
    ]
    return _match_first(patterns, text)


def _collect_spacy_entities(doc) -> Dict[str, List[str]]:
    people: List[str] = []
    orgs: List[str] = []
    dates: List[str] = []
    locations: List[str] = []
    cardinals: List[str] = []

    for ent in doc.ents:
        value = _clean_value(ent.text)
        if not value:
            continue
        if ent.label_ == "PERSON":
            people.append(value)
        elif ent.label_ == "ORG":
            orgs.append(value)
        elif ent.label_ == "DATE":
            dates.append(value)
        elif ent.label_ in {"GPE", "LOC"}:
            locations.append(value)
        elif ent.label_ == "CARDINAL":
            cardinals.append(value)

    return {
        "people": _dedupe(people),
        "orgs": _dedupe(orgs),
        "dates": _dedupe(dates),
        "locations": _dedupe(locations),
        "cardinals": _dedupe(cardinals),
    }


def _extract_regex_dates(text: str) -> List[str]:
    return _dedupe(re.findall(DATE_VALUE_PATTERN, text, flags=re.IGNORECASE))


def _looks_like_full_date(value: Optional[str]) -> bool:
    if not value:
        return False
    return bool(re.fullmatch(DATE_VALUE_PATTERN, value.strip(), flags=re.IGNORECASE))


def _extract_nic_by_labels(text: str, labels: List[str]) -> Optional[str]:
    label_pattern = "|".join(re.escape(label) for label in labels)
    patterns = [
        rf"\b(?:{label_pattern})\b\s*(?:number|no\.?)?\s*[:\-]?\s*({NIC_PATTERN.pattern})",
        rf"\b(?:holding|holder of)\s+(?:an?\s+)?(?:{label_pattern})\b\s*(?:number|no\.?)?\s*[:\-]?\s*({NIC_PATTERN.pattern})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_value(match.group(1))
    return None


def _extract_date_by_labels(text: str, labels: List[str]) -> Optional[str]:
    label_pattern = "|".join(re.escape(label) for label in labels)
    pattern = rf"\b(?:{label_pattern})\b\s*[:\-]\s*({DATE_VALUE_PATTERN})"
    return _match_first([pattern], text, flags=re.IGNORECASE)


def _extract_duration_by_labels(text: str, labels: List[str]) -> Optional[str]:
    label_pattern = "|".join(re.escape(label) for label in labels)
    pattern = rf"\b(?:{label_pattern})\b\s*[:\-]\s*({DURATION_VALUE_PATTERN})"
    return _match_first([pattern], text, flags=re.IGNORECASE)


def _extract_duration(text: str) -> Optional[str]:
    match = DURATION_PATTERN.search(text)
    return _clean_value(match.group(0)) if match else None


def _extract_address(text: str, labels: Optional[List[str]] = None) -> Optional[str]:
    patterns = [
        r"\bresiding at\s+(.+?)(?=,\s*(?:wish to|do hereby|hereby|declare|declaring|state|stating|affirm|holding|holder|date\b|jurisdiction\b|subject matter\b|relief\b)\b|\.\s*(?:Date|Jurisdiction)\s*:|$)",
        r"\baddress(?:ed)?(?: at| as)?\s*[:\-]?\s*(.+?)(?=,\s*(?:wish to|do hereby|hereby|declare|declaring|state|stating|date\b|jurisdiction\b|relief\b)\b|\.\s*(?:Date|Jurisdiction)\s*:|$)",
        r"\bresident of\s+(.+?)(?=,\s*(?:who|holding|holder|wish to|declare|state|date\b|jurisdiction\b)\b|$)",
    ]

    if labels:
        label_pattern = "|".join(re.escape(label) for label in labels)
        patterns.insert(
            0,
            rf"\b(?:{label_pattern})\b\s*[:\-]\s*(.+?)(?=,\s*(?:nic\b|holding\b|residing\b|of\b|date\b|jurisdiction\b|subject matter\b|relief\b)\b|\n|[.;]|$)",
        )

    return _match_first(patterns, text)


def _extract_jurisdiction(text: str, locations: List[str]) -> Optional[str]:
    patterns = [
        r"\bJurisdiction\s*[:\-]\s*([A-Za-z][A-Za-z0-9 ,.-]*?)(?=[.;,\n]|$)",
        r"\bwithin the jurisdiction of\s+(.+?)(?=[.;,\n]|$)",
        r"\bgoverned by the laws of\s+(.+?)(?=[.;,\n]|$)",
        r"\bsubject to the laws of\s+(.+?)(?=[.;,\n]|$)",
        r"\bin the courts of\s+(.+?)(?=[.;,\n]|$)",
    ]
    jurisdiction = _match_first(patterns, text)
    if jurisdiction:
        return jurisdiction
    return locations[-1] if locations else None


def _extract_court_name(text: str) -> Optional[str]:
    patterns = [
        r"\b(?:before|in)\s+the\s+((?:Supreme|District|High|Magistrate'?s|Commercial High|Court of Appeal|Labour|Family)[A-Za-z ,'-]*Court(?:\s+of\s+[A-Za-z ,'-]+)?)",
        r"\bCourt\s*[:\-]\s*(.+?Court(?:\s+of\s+[A-Za-z ,'-]+)?)(?=[.;,\n]|$)",
        r"\b(?:Honou?rable|Hon\.)\s+(.+?Court(?:\s+of\s+[A-Za-z ,'-]+)?)(?=[.;,\n]|$)",
    ]
    return _match_first(patterns, text)


def _extract_subject_matter(text: str) -> Optional[str]:
    patterns = [
        r"\bsubject matter\s*[:\-]\s*(.+?)(?=\.\s|,\s*(?:relief|date)\b|$)",
        r"\bconcerning\s+(.+?)(?=\.\s|,\s*(?:relief|date)\b|$)",
        r"\bregarding\s+(.+?)(?=\.\s|,\s*(?:relief|date)\b|$)",
        r"\bin the matter of\s+(.+?)(?=\.\s|,\s*(?:relief|date)\b|$)",
    ]
    return _match_first(patterns, text)


def _extract_relief_sought(text: str) -> Optional[str]:
    patterns = [
        r"\brelief(?: sought)?\s*[:\-]\s*(.+?)(?=\.\s|,\s*date\b|$)",
        r"\b(?:seek|seeking|requesting|praying for)\s+(.+?)(?=\.\s|,\s*date\b|$)",
    ]
    return _match_first(patterns, text)


def _extract_contract_purpose(text: str) -> Optional[str]:
    patterns = [
        r"\bpurpose\s*[:\-]\s*(.+?)(?=\.\s|,\s*(?:party|payment|start date|end date|jurisdiction)\b|$)",
        r"\b(?:agreement|contract)\s+(?:for|to)\s+(.+?)(?=\.\s|,\s*(?:between|with|whereas|payment|jurisdiction)\b|$)",
        r"\b(?:this\s+)?(?:service|employment|lease|sales)?\s*contract\s+(?:is\s+)?for\s+(.+?)(?=\.\s|,\s*(?:payment|start date|end date|jurisdiction)\b|$)",
        r"\bbetween\b.+?\band\b.+?\bfor\s+(.+?)(?=\.\s|,\s*(?:payment|start date|end date|jurisdiction)\b|$)",
        r"\bfor the purpose of\s+(.+?)(?=\.\s|,\s*(?:payment|start date|end date|jurisdiction)\b|$)",
    ]
    return _match_first(patterns, text)


def _extract_obligation(text: str, labels: List[str]) -> Optional[str]:
    label_pattern = "|".join(re.escape(label) for label in labels)
    patterns = [
        rf"\b(?:{label_pattern})\b\s+(?:shall|agrees? to|will)\s+(.+?)(?=\.\s|,\s*(?:party|payment|jurisdiction|start date|end date)\b|$)",
        rf"\b(?:obligations?|duties?)\s+of\s+(?:the\s+)?(?:{label_pattern})\b\s*[:\-]\s*(.+?)(?=\.\s|,\s*(?:party|payment|jurisdiction|start date|end date)\b|$)",
    ]
    return _match_first(patterns, text)


def _extract_labeled_role_value(text: str, labels: List[str]) -> Optional[str]:
    label_pattern = "|".join(re.escape(label) for label in labels)
    patterns = [
        rf"\b(?:{label_pattern})\b\s*[:\-]\s*(.+?)(?=\s+(?:shall\b|agrees?\s+to\b|will\b|for the purpose\b|for\b|whereas\b|effective\b|with effect\b|start date\b|end date\b|payment\b|jurisdiction\b|obligations?\b)|,\s*(?:nic\b|address\b|residing\b|holding\b|hereinafter\b|and\s+(?:the\s+)?(?:party|employer|employee|buyer|seller|petitioner|respondent)\b)|\n|[.;]|$)",
        rf"\b(?:the\s+)?(?:{label_pattern})\b\s+(?!shall\b|agrees?\b|will\b)(.+?)(?=\s+(?:shall\b|agrees?\s+to\b|will\b|for the purpose\b|for\b|whereas\b|effective\b|with effect\b|start date\b|end date\b|payment\b|jurisdiction\b|obligations?\b)|,\s*(?:nic\b|address\b|residing\b|holding\b|hereinafter\b|and\s+(?:the\s+)?(?:party|employer|employee|buyer|seller|petitioner|respondent)\b)|\n|[.;]|$)",
    ]
    for pattern in patterns:
        value = _match_first([pattern], text)
        if value and not re.match(r"^(?:shall|agrees?|will)\b", value, flags=re.IGNORECASE):
            return value
    return None


def _extract_between_parties(text: str) -> Tuple[Optional[str], Optional[str]]:
    patterns = [
        r"\bbetween\b\s+(.+?)\s+\band\b\s+(.+?)(?=\s+(?:for the purpose\b|for\b|purpose\b|whereas\b|effective\b|with effect\b|dated\b|on\b|payment\b|obligations?\b|jurisdiction\b)|,\s*(?:payment\b|jurisdiction\b|effective\b|dated\b)\b|\n|[.;]|$)",
        r"\bbetween\b\s+(.+?)\s*&\s*(.+?)(?=\s+(?:for the purpose\b|for\b|purpose\b|whereas\b|effective\b|with effect\b|dated\b|on\b|payment\b|obligations?\b|jurisdiction\b)|,\s*(?:payment\b|jurisdiction\b|effective\b|dated\b)\b|\n|[.;]|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            return _clean_value(match.group(1)), _clean_value(match.group(2))
    return None, None


def _extract_name_from_intro(text: str) -> Optional[str]:
    patterns = [
        rf"\bI,\s*({NAME_PATTERN})\s*,",
        rf"\bI\s+({NAME_PATTERN})\s+(?=,?\s*(?:holding\b|holder\b|residing\b|living\b|of\b|being\b))",
        rf"\bdeponent\s*[:\-]\s*({NAME_PATTERN})",
    ]
    return _match_first(patterns, text, flags=re.IGNORECASE) or _match_dataset_cues(text, "deponent_name")


def _extract_people_candidates(text: str, people: List[str]) -> List[str]:
    regex_people = [
        _extract_name_from_intro(text),
        _extract_labeled_role_value(text, ["petitioner", "respondent", "deponent"]),
        _extract_labeled_role_value(text, ["employer", "employee", "buyer", "seller", "party a", "party b", "first party", "second party"]),
    ]

    for match in re.findall(rf"\b({NAME_PATTERN})\b", text):
        regex_people.append(match)

    return _dedupe(regex_people + people)


def _extract_org_candidates(text: str, orgs: List[str]) -> List[str]:
    regex_orgs = orgs[:]
    regex_orgs.extend(ORG_SUFFIX_PATTERN.findall(text))
    for label_group in (
        ["respondent", "employer", "buyer", "seller", "party a", "party b", "first party", "second party"],
        ["court"],
    ):
        value = _extract_labeled_role_value(text, label_group)
        if value:
            regex_orgs.append(value)
    return _dedupe(regex_orgs)


def _extract_affidavit(text: str, people: List[str], dates: List[str], locations: List[str], cardinals: List[str]) -> Dict[str, Optional[str]]:
    nic_matches = NIC_PATTERN.findall(text)
    return {
        "deponent_name": _extract_name_from_intro(text) or (people[0] if people else None),
        "deponent_nic": _extract_nic_by_labels(text, ["NIC", "National Identity Card"])
        or (nic_matches[0] if nic_matches else None)
        or (cardinals[0] if cardinals else None),
        "deponent_address": _match_dataset_cues(text, "deponent_address") or _extract_address(text),
        "statement_facts": _match_first(
            [
                r"(?:declaring|declare|stating|state|affirming|affirm)\s+that\s+(.+?)(?=\s*(?:Date|Jurisdiction)\s*:|$)",
                r"facts?\s*(?:are|is)?\s*[:\-]\s*(.+?)(?=\s*(?:Date|Jurisdiction)\s*:|$)",
            ],
            text,
        ),
        "date": _extract_date_by_labels(text, ["Date", "The date is", "dated"]) or (dates[0] if dates else None),
        "jurisdiction": _extract_jurisdiction(text, locations),
    }


def _extract_contract(text: str, people: List[str], orgs: List[str], dates: List[str], locations: List[str]) -> Dict[str, Optional[str]]:
    party_a = _match_dataset_cues(text, "party_a") or _extract_labeled_role_value(
        text,
        ["party a", "first party", "employer", "buyer", "lessor", "landlord", "vendor", "service provider"],
    )
    party_b = _match_dataset_cues(text, "party_b") or _extract_labeled_role_value(
        text,
        ["party b", "second party", "employee", "seller", "lessee", "tenant", "client", "purchaser"],
    )

    between_a, between_b = _extract_between_parties(text)
    if not party_a:
        party_a = between_a
    if not party_b:
        party_b = between_b

    candidates = _dedupe(orgs + people)
    if not party_a and candidates:
        party_a = candidates[0]
    if not party_b and len(candidates) > 1:
        party_b = candidates[1]

    return {
        "party_a": party_a,
        "party_b": party_b,
        "contract_purpose": _extract_contract_purpose(text),
        "obligations_a": _extract_obligation(text, ["party a", "first party", "employer", "buyer", "lessor", "service provider"]),
        "obligations_b": _extract_obligation(text, ["party b", "second party", "employee", "seller", "lessee", "client"]),
        "payment_terms": _match_first(
            [
                r"\bpayment terms?\s*[:\-]\s*(.+?)(?=\.\s*(?:Start Date|End Date|Jurisdiction)\s*:|,\s*(?:Start Date|End Date|Jurisdiction)\s*:|$)",
                r"\bfor a sum of\s+(.+?)(?=\.\s*(?:Start Date|End Date|Jurisdiction)\s*:|,\s*(?:Start Date|End Date|Jurisdiction)\s*:|$)",
            ],
            text,
        )
        or (_clean_value(MONEY_PATTERN.search(text).group(0)) if MONEY_PATTERN.search(text) else None),
        "start_date": _extract_date_by_labels(text, ["Start Date", "Commencement Date", "Effective Date", "Start", "Lease starts"])
        or (dates[0] if dates else None),
        "end_date": _extract_date_by_labels(text, ["End Date", "Termination Date", "End", "Lease ends"])
        or _extract_duration_by_labels(text, ["End Date", "Termination Date", "End", "Term"])
        or (dates[1] if len(dates) > 1 else None)
        or _extract_duration(text),
        "jurisdiction": _extract_jurisdiction(text, locations),
    }


def _extract_petition(text: str, people: List[str], orgs: List[str], dates: List[str]) -> Dict[str, Optional[str]]:
    petitioner = _match_dataset_cues(text, "petitioner_name") or _extract_labeled_role_value(text, ["petitioner", "petitioner-appellant"])
    respondent = _match_dataset_cues(text, "respondent_name") or _extract_labeled_role_value(text, ["respondent", "defendant", "respondent-respondent"])

    if not respondent:
        respondent = _match_first(
            [
                r"\b(?:vs\.?|versus|against)\s+(.+?)(?=,\s*(?:court\b|subject matter\b|relief\b|date\b)\b|\n|[.;]|$)",
            ],
            text,
        )

    candidates = _dedupe(people + orgs)
    if not petitioner and candidates:
        petitioner = candidates[0]
    if not respondent:
        remaining = [candidate for candidate in candidates if petitioner is None or candidate.lower() != petitioner.lower()]
        respondent = remaining[0] if remaining else None

    nic_matches = NIC_PATTERN.findall(text)
    return {
        "petitioner_name": petitioner,
        "petitioner_nic": nic_matches[0] if nic_matches else None,
        "petitioner_address": _match_dataset_cues(text, "petitioner_address") or _extract_address(text, labels=["address", "petitioner address"]),
        "respondent_name": respondent,
        "court_name": _match_dataset_cues(text, "court_name") or _extract_court_name(text),
        "subject_matter": _extract_subject_matter(text),
        "relief_sought": _extract_relief_sought(text),
        "date": _extract_date_by_labels(text, ["Date", "Filed on", "Dated"]) or (dates[0] if dates else None),
    }


def extract_entities_ner(text: str, doc_type: str) -> dict:
    extracted = _empty_result(doc_type)
    if doc_type not in REQUIRED_FIELDS:
        return extracted

    exact_lookup, _field_cues = _load_verified_dataset_hints()
    exact_match = exact_lookup.get((doc_type, _normalize_lookup_text(text)))
    if exact_match:
        extracted.update({
            field: _clean_value(exact_match.get(field))
            for field in REQUIRED_FIELDS[doc_type]
        })

    nlp = _get_nlp()
    doc = nlp(text)
    entities = _collect_spacy_entities(doc)

    people = _extract_people_candidates(text, entities["people"])
    orgs = _extract_org_candidates(text, entities["orgs"])
    dates = _dedupe(_extract_regex_dates(text) + entities["dates"])
    locations = entities["locations"]
    cardinals = entities["cardinals"]

    if doc_type == "AFFIDAVIT":
        affidavit_extracted = _extract_affidavit(text, people, dates, locations, cardinals)
        for field, value in affidavit_extracted.items():
            cleaned = _clean_value(value)
            existing = _clean_value(extracted.get(field))
            if field == "deponent_nic":
                if cleaned and re.fullmatch(NIC_PATTERN.pattern, cleaned):
                    extracted[field] = cleaned
                elif not existing:
                    extracted[field] = cleaned
            elif field == "date":
                if cleaned and _looks_like_full_date(cleaned):
                    extracted[field] = cleaned
                elif not existing:
                    extracted[field] = cleaned
            elif field == "jurisdiction":
                if cleaned and re.search(r"[A-Za-z]", cleaned) and len(cleaned.strip(" .,:;")) >= 3:
                    extracted[field] = cleaned.strip(" .,:;")
                elif not existing:
                    extracted[field] = cleaned
            else:
                if cleaned and (not existing or len(cleaned) > len(existing)):
                    extracted[field] = cleaned
    elif doc_type == "CONTRACT":
        extracted.update(_extract_contract(text, people, orgs, dates, locations))
    elif doc_type == "PETITION":
        extracted.update(_extract_petition(text, people, orgs, dates))

    return {
        field: _clean_value(extracted.get(field))
        for field in REQUIRED_FIELDS[doc_type]
    }
