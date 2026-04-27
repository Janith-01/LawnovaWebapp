from src.language_detector import detect_language


def test_detect_language_returns_english_for_english_prompt():
    prompt = (
        "I, Kamal Perera, residing in Colombo, wish to make an affidavit declaring "
        "that the statement below is true and correct."
    )
    assert detect_language(prompt) == "en"


def test_detect_language_returns_sinhala_for_sinhala_prompt():
    prompt = (
        "මම කමල් පෙරේරා වෙමි. මගේ ජාතික හැඳුනුම්පත් අංකය 199034500123 වේ. "
        "මම කොළඹ පදිංචි පුද්ගලයෙකු වන අතර මේ දිවුරුම් ප්‍රකාශය නීතිමය කටයුතු සඳහා සකස් කරමි."
    )
    assert detect_language(prompt) == "si"


def test_detect_language_defaults_to_english_for_empty_input():
    assert detect_language("   ") == "en"
