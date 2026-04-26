from pathlib import Path

import pytest

import src.gemini_drafter as gemini_drafter
import src.pipeline as pipeline


@pytest.fixture
def stub_pipeline_outputs(monkeypatch, tmp_path):
    monkeypatch.setattr(gemini_drafter, "_generate_gemini_draft", lambda prompt: "")

    def fake_save(content: str, doc_type: str, language: str, suffix: str) -> str:
        output_path = tmp_path / f"{doc_type}_{language}_test.{suffix}"
        output_path.write_text(content, encoding="utf-8")
        return str(output_path)

    monkeypatch.setattr(
        pipeline,
        "save_as_docx",
        lambda content, doc_type, language: fake_save(content, doc_type, language, "docx"),
    )
    monkeypatch.setattr(
        pipeline,
        "save_as_pdf",
        lambda content, doc_type, language: fake_save(content, doc_type, language, "pdf"),
    )

    return tmp_path


def test_run_pipeline_completes_for_english_affidavit(stub_pipeline_outputs):
    prompt = (
        "I, Kamal Perera, holding NIC 199034500123, residing at 45 Galle Road, Colombo 03, "
        "wish to make an affidavit declaring that the property at 12 Temple Road, Nugegoda "
        "belongs to me. Date: 2024-01-15. Jurisdiction: Colombo."
    )

    result = pipeline.run_pipeline(prompt)

    assert result["status"] == "complete"
    assert result["doc_type"] == "AFFIDAVIT"
    assert result["language"] == "en"
    assert Path(result["docx_path"]).exists()
    assert Path(result["pdf_path"]).exists()
    assert "AFFIDAVIT" in result["drafted_content"]
    assert result["ai_provenance"]["entity_extraction"]["provider"] == "local_ner"
    assert result["ai_provenance"]["draft_generation"]["provider"] == "local_template"


def test_run_pipeline_completes_for_english_contract(stub_pipeline_outputs):
    prompt = (
        "This contract is between ABC Private Limited and Nimal Silva for the provision of "
        "consulting services. Party A shall provide office space and project materials. "
        "Party B shall deliver consulting services and monthly reports. Payment Terms: "
        "Rs. 250,000 payable in two installments. Start Date: 2024-02-01. End Date: 2024-08-01. "
        "Jurisdiction: Colombo, Sri Lanka."
    )

    result = pipeline.run_pipeline(prompt)

    assert result["status"] == "complete"
    assert result["doc_type"] == "CONTRACT"
    assert "AGREEMENT" in result["drafted_content"]


def test_run_pipeline_completes_for_english_petition(stub_pipeline_outputs):
    prompt = (
        "This petition is filed before the District Court of Kandy. Petitioner: Sunethra "
        "Jayasinghe, NIC 887654321V, Address: 12 Main Street, Kandy. Respondent: Registrar "
        "of Lands. Subject Matter: unlawful refusal to register a deed. Relief Sought: an order "
        "directing the registration of the deed. Date: 2024-03-20."
    )

    result = pipeline.run_pipeline(prompt)

    assert result["status"] == "complete"
    assert result["doc_type"] == "PETITION"
    assert "PETITION" in result["drafted_content"]


def test_run_pipeline_returns_incomplete_for_partial_contract(stub_pipeline_outputs):
    prompt = "This contract is between ABC Private Limited and Nimal Silva."

    result = pipeline.run_pipeline(prompt)

    assert result["status"] == "incomplete"
    assert "contract_purpose" in result["missing_fields"]
    assert result["docx_path"] is None
    assert result["pdf_path"] is None


def test_run_pipeline_returns_unknown_doc_type_for_unclassified_prompt(stub_pipeline_outputs):
    prompt = "I need legal help with a matter in Colombo and would like advice on next steps."

    result = pipeline.run_pipeline(prompt)

    assert result["status"] == "unknown_doc_type"
    assert result["missing_fields"] == ["document_type"]
    assert "Could not determine document type" in result["message"]
