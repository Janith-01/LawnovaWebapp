from src.validator import validate_fields


def test_validate_fields_returns_complete_for_complete_affidavit():
    params = {
        "deponent_name": "Kamal Perera",
        "deponent_nic": "199034500123",
        "deponent_address": "45 Galle Road, Colombo 03",
        "statement_facts": "The property at 12 Temple Road, Nugegoda belongs to me.",
        "date": "2024-01-15",
        "jurisdiction": "Colombo, Sri Lanka",
    }

    result = validate_fields("AFFIDAVIT", params, "en")

    assert result["status"] == "complete"
    assert result["missing_fields"] == []
    assert "All required details are present." in result["message"]


def test_validate_fields_returns_incomplete_and_lists_missing_fields():
    params = {
        "party_a": "ABC Private Limited",
        "party_b": None,
        "contract_purpose": "consulting services",
        "obligations_a": "Provide office space and materials.",
        "obligations_b": "",
        "payment_terms": None,
        "start_date": "2024-02-01",
        "end_date": "2024-08-01",
        "jurisdiction": "Colombo, Sri Lanka",
    }

    result = validate_fields("CONTRACT", params, "en")

    assert result["status"] == "incomplete"
    assert result["missing_fields"] == ["party_b", "obligations_b", "payment_terms"]
    assert "Second party name" in result["message"]
    assert "Payment terms and amount" in result["message"]


def test_validate_fields_returns_too_vague_message_when_zero_fields_are_usable():
    params = {
        "petitioner_name": None,
        "petitioner_nic": None,
        "petitioner_address": None,
        "respondent_name": None,
        "court_name": None,
        "subject_matter": None,
        "relief_sought": None,
        "date": None,
    }

    result = validate_fields("PETITION", params, "en")

    assert result["status"] == "incomplete"
    assert result["missing_fields"] == []
    assert "too vague" in result["message"].lower()
    assert "Example:" in result["message"]
