from fastapi.testclient import TestClient

import src.api as api
from src.pipeline import build_response


client = TestClient(api.app)


def test_validate_endpoint_rejects_empty_prompt():
    response = client.post("/validate", json={"prompt": "   "})

    assert response.status_code == 422
    payload = response.json()
    assert payload["status"] == "error"
    assert payload["missing_fields"] == ["prompt"]
    assert payload["error"]["code"] == "empty_prompt"


def test_draft_endpoint_rejects_short_prompt():
    response = client.post("/draft", json={"prompt": "Need affidavit now"})

    assert response.status_code == 422
    payload = response.json()
    assert payload["status"] == "error"
    assert payload["error"]["code"] == "prompt_too_short"


def test_draft_endpoint_rejects_long_prompt():
    response = client.post("/draft", json={"prompt": "a" * 3001})

    assert response.status_code == 422
    payload = response.json()
    assert payload["status"] == "error"
    assert payload["error"]["code"] == "prompt_too_long"


def test_validate_endpoint_returns_success_payload(monkeypatch):
    monkeypatch.setattr(
        api,
        "run_validation",
        lambda prompt: build_response(
            status="complete",
            message="All required details are present.",
            doc_type="AFFIDAVIT",
            language="en",
        ),
    )

    response = client.post("/validate", json={"prompt": "I need help drafting a full affidavit about ownership in Colombo."})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "complete"
    assert payload["doc_type"] == "AFFIDAVIT"


def test_validate_endpoint_returns_incomplete_payload(monkeypatch):
    monkeypatch.setattr(
        api,
        "run_validation",
        lambda prompt: build_response(
            status="incomplete",
            message="More details are required.",
            doc_type="CONTRACT",
            language="en",
            missing_fields=["payment_terms"],
        ),
    )

    response = client.post("/validate", json={"prompt": "Please prepare a contract for services between two parties in Colombo."})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "incomplete"
    assert payload["missing_fields"] == ["payment_terms"]


def test_validate_endpoint_returns_unknown_doc_type_payload(monkeypatch):
    monkeypatch.setattr(
        api,
        "run_validation",
        lambda prompt: build_response(
            status="unknown_doc_type",
            message="Could not determine document type.",
            language="en",
            missing_fields=["document_type"],
        ),
    )

    response = client.post("/validate", json={"prompt": "I need legal help with a matter in Colombo and need guidance urgently."})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unknown_doc_type"
    assert payload["missing_fields"] == ["document_type"]


def test_draft_endpoint_returns_success_payload(monkeypatch):
    monkeypatch.setattr(
        api,
        "run_pipeline",
        lambda prompt: build_response(
            status="complete",
            message="Draft generated successfully.",
            doc_type="PETITION",
            language="en",
            docx_path="C:/tmp/PETITION_en_test.docx",
            pdf_path="C:/tmp/PETITION_en_test.pdf",
            drafted_content="PETITION",
        ),
    )

    response = client.post("/draft", json={"prompt": "This petition is filed before the District Court of Kandy and seeks relief."})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "complete"
    assert payload["docx_path"].endswith(".docx")
    assert payload["pdf_path"].endswith(".pdf")


def test_draft_endpoint_returns_incomplete_payload(monkeypatch):
    monkeypatch.setattr(
        api,
        "run_pipeline",
        lambda prompt: build_response(
            status="incomplete",
            message="More details are required.",
            doc_type="AFFIDAVIT",
            language="en",
            missing_fields=["jurisdiction"],
        ),
    )

    response = client.post("/draft", json={"prompt": "I need an affidavit for a property ownership issue in Colombo."})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "incomplete"
    assert payload["missing_fields"] == ["jurisdiction"]
