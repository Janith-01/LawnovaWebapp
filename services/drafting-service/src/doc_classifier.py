KEYWORDS = {
    "AFFIDAVIT": {
        "en": ["affidavit", "declare", "sworn", "deponent", "solemnly", "declaration"],
        "si": ["දිවුරුම", "ප්‍රකාශය", "සාක්ෂිකරු"],
    },
    "CONTRACT": {
        "en": ["contract", "agreement", "party", "obligations", "payment", "service", "terms"],
        "si": ["ගිවිසුම", "සේවා", "ගෙවීම", "පාර්ශව"],
    },
    "PETITION": {
        "en": ["petition", "petitioner", "respondent", "court", "relief", "filing", "fundamental rights"],
        "si": ["පෙත්සම", "අයදුම්පත", "උසාවිය", "පෙත්සම්කරු"],
    },
}


def classify_doc_type(text: str) -> str:
    if not text or not text.strip():
        return "UNKNOWN"

    normalized = text.lower()
    scores = {}

    for doc_type, families in KEYWORDS.items():
        score = 0
        for keywords in families.values():
            for keyword in keywords:
                if keyword.lower() in normalized:
                    score += 1
        scores[doc_type] = score

    best_doc_type = max(scores, key=scores.get)
    if scores[best_doc_type] == 0:
        return "UNKNOWN"

    return best_doc_type
