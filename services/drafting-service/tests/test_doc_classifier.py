import pytest

from src.doc_classifier import classify_doc_type


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        (
            "I wish to make an affidavit and solemnly declare the following facts.",
            "AFFIDAVIT",
        ),
        (
            "This contract sets out the payment terms and obligations of each party.",
            "CONTRACT",
        ),
        (
            "This petition is filed before court and seeks relief against the respondent.",
            "PETITION",
        ),
        (
            "මෙය දිවුරුමක් වන අතර මෙම ප්‍රකාශය සත්‍ය බව සාක්ෂිකරු ඉදිරියේ ප්‍රකාශ කරමි.",
            "AFFIDAVIT",
        ),
        (
            "මෙය සේවා ගිවිසුමක් වන අතර පාර්ශව දෙක අතර ගෙවීම සහ සේවා කොන්දේසි අඩංගු වේ.",
            "CONTRACT",
        ),
        (
            "මෙය උසාවිය වෙත ඉදිරිපත් කරන පෙත්සමක් වන අතර පෙත්සම්කරු පිළියමක් ඉල්ලා සිටී.",
            "PETITION",
        ),
    ],
)
def test_classify_doc_type_matches_expected_document(text, expected):
    assert classify_doc_type(text) == expected


def test_classify_doc_type_returns_unknown_when_no_keywords_match():
    text = "I need legal assistance with a matter and want some general guidance."
    assert classify_doc_type(text) == "UNKNOWN"
