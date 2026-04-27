from src.ner_extractor import extract_entities_ner


def test_extract_entities_ner_for_affidavit():
    prompt = (
        "I, Kamal Perera, holding NIC 199034500123, residing at 45 Galle Road, Colombo 03, "
        "wish to make an affidavit declaring that the property at 12 Temple Road, Nugegoda "
        "belongs to me. Date: 2024-01-15. Jurisdiction: Colombo."
    )

    result = extract_entities_ner(prompt, "AFFIDAVIT")

    assert result == {
        "deponent_name": "Kamal Perera",
        "deponent_nic": "199034500123",
        "deponent_address": "45 Galle Road, Colombo 03",
        "statement_facts": "the property at 12 Temple Road, Nugegoda belongs to me",
        "date": "2024-01-15",
        "jurisdiction": "Colombo",
    }


def test_extract_entities_ner_for_contract():
    prompt = (
        "This contract is between ABC Private Limited and Nimal Silva for the provision of "
        "consulting services. Party A shall provide office space and project materials. "
        "Party B shall deliver consulting services and monthly reports. Payment Terms: "
        "Rs. 250,000 payable in two installments. Start Date: 2024-02-01. End Date: 2024-08-01. "
        "Jurisdiction: Colombo, Sri Lanka."
    )

    result = extract_entities_ner(prompt, "CONTRACT")

    assert result == {
        "party_a": "ABC Private Limited",
        "party_b": "Nimal Silva",
        "contract_purpose": "the provision of consulting services",
        "obligations_a": "provide office space and project materials",
        "obligations_b": "deliver consulting services and monthly reports",
        "payment_terms": "Rs. 250,000 payable in two installments",
        "start_date": "2024-02-01",
        "end_date": "2024-08-01",
        "jurisdiction": "Colombo, Sri Lanka",
    }


def test_extract_entities_ner_for_petition():
    prompt = (
        "This petition is filed before the District Court of Kandy. Petitioner: Sunethra "
        "Jayasinghe, NIC 887654321V, Address: 12 Main Street, Kandy. Respondent: Registrar "
        "of Lands. Subject Matter: unlawful refusal to register a deed. Relief Sought: an order "
        "directing the registration of the deed. Date: 2024-03-20."
    )

    result = extract_entities_ner(prompt, "PETITION")

    assert result == {
        "petitioner_name": "Sunethra Jayasinghe",
        "petitioner_nic": "887654321V",
        "petitioner_address": "12 Main Street, Kandy",
        "respondent_name": "Registrar of Lands",
        "court_name": "District Court of Kandy",
        "subject_matter": "unlawful refusal to register a deed",
        "relief_sought": "an order directing the registration of the deed",
        "date": "2024-03-20",
    }
