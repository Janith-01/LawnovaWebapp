from types import SimpleNamespace

from src.gemini_extractor import extract_entities_gemini


class FakeModels:
    def __init__(self, responses):
        self._responses = list(responses)

    def generate_content(self, **kwargs):
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return SimpleNamespace(text=response)


class FakeClient:
    def __init__(self, responses):
        self.models = FakeModels(responses)


def test_extract_entities_gemini_returns_normalized_fields_from_mocked_json(monkeypatch):
    response_text = """
    ```json
    {
      "petitioner_name": "Nadeesha Silva",
      "petitioner_nic": "199034500123",
      "petitioner_address": "45 Galle Road, Colombo 03",
      "respondent_name": "Land Registry Department",
      "court_name": "District Court of Colombo",
      "subject_matter": "deed registration delay",
      "relief_sought": "an order directing registration",
      "date": "2024-03-20"
    }
    ```
    """
    monkeypatch.setattr(
        "src.gemini_extractor._get_gemini_client",
        lambda: FakeClient([response_text]),
    )

    result = extract_entities_gemini(
        "පෙත්සම්කරු Nadeesha Silva, Respondent Land Registry Department, Court District Court of Colombo.",
        "PETITION",
    )

    assert result == {
        "petitioner_name": "Nadeesha Silva",
        "petitioner_nic": "199034500123",
        "petitioner_address": "45 Galle Road, Colombo 03",
        "respondent_name": "Land Registry Department",
        "court_name": "District Court of Colombo",
        "subject_matter": "deed registration delay",
        "relief_sought": "an order directing registration",
        "date": "2024-03-20",
    }


def test_extract_entities_gemini_returns_empty_fields_when_mocked_response_is_invalid(monkeypatch):
    monkeypatch.setattr(
        "src.gemini_extractor._get_gemini_client",
        lambda: FakeClient(["```json\nnot valid json\n```", "not valid json"]),
    )

    result = extract_entities_gemini("මෙය දිවුරුම් ප්‍රකාශයක්.", "AFFIDAVIT")

    assert result == {
        "deponent_name": None,
        "deponent_nic": None,
        "deponent_address": None,
        "statement_facts": None,
        "date": None,
        "jurisdiction": None,
    }


def test_extract_entities_gemini_returns_empty_fields_when_mocked_client_raises(monkeypatch):
    monkeypatch.setattr(
        "src.gemini_extractor._get_gemini_client",
        lambda: FakeClient([RuntimeError("Gemini unavailable"), RuntimeError("Gemini unavailable")]),
    )

    result = extract_entities_gemini("මෙය ගිවිසුමකි.", "CONTRACT")

    assert result == {
        "party_a": None,
        "party_b": None,
        "contract_purpose": None,
        "obligations_a": None,
        "obligations_b": None,
        "payment_terms": None,
        "start_date": None,
        "end_date": None,
        "jurisdiction": None,
    }
