from langdetect import DetectorFactory, LangDetectException, detect_langs


DetectorFactory.seed = 0


def _contains_sinhala(text: str) -> bool:
    return any("\u0d80" <= char <= "\u0dff" for char in text)


def detect_language(text: str) -> str:
    if not text or not text.strip():
        return "en"

    try:
        candidates = detect_langs(text)
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
