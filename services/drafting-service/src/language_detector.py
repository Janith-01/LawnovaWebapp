from langdetect import DetectorFactory, LangDetectException, detect_langs


DetectorFactory.seed = 0


def _contains_sinhala(text: str) -> bool:
    return any("\u0d80" <= char <= "\u0dff" for char in text)


def _sinhala_ratio(text: str) -> float:
    letters = [char for char in text if char.isalpha()]
    if not letters:
        return 0.0

    sinhala_letters = [char for char in letters if "\u0d80" <= char <= "\u0dff"]
    return len(sinhala_letters) / len(letters)


def detect_language(text: str) -> str:
    if not text or not text.strip():
        return "en"

    normalized = text.strip()
    if _contains_sinhala(normalized) and _sinhala_ratio(normalized) >= 0.2:
        return "si"

    try:
        candidates = detect_langs(normalized)
        if not candidates:
            return "en"

        top = candidates[0]
        if top.lang == "si" and top.prob >= 0.55:
            return "si"
        if top.lang == "en" and top.prob >= 0.55:
            return "en"
    except (LangDetectException, ValueError):
        return "en"
    except Exception:
        return "en"

    return "en"
