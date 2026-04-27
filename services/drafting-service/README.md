# Lawnova Drafting Service

## Overview

This service is a standalone bilingual legal drafting service for Lawnova. It supports:

- `AFFIDAVIT`
- `CONTRACT`
- `PETITION`

The service accepts English and Sinhala prompts, extracts the required legal parameters, validates completeness, drafts the document, and exports both DOCX and PDF files.

## Setup

From `services/drafting-service/`:

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

Create a local `.env` file from `.env.example`:

```env
GEMINI_API_KEY=your_real_api_key
```

The `.env` file must remain uncommitted.

## Run

From `services/drafting-service/`:

```bash
uvicorn src.api:app --reload --port 8001
```

## API

### `POST /draft`

Request body:

```json
{
  "prompt": "I, Kamal Perera, ... wish to make an affidavit ..."
}
```

Response:

```json
{
  "status": "complete",
  "doc_type": "AFFIDAVIT",
  "language": "en",
  "docx_path": "services/drafting-service/output/...",
  "pdf_path": "services/drafting-service/output/...",
  "drafted_content": "..."
}
```

### `POST /validate`

Runs only language detection, classification, extraction, role resolution, and validation.

Request body:

```json
{
  "prompt": "Draft a contract between ..."
}
```

Response:

```json
{
  "status": "complete",
  "missing_fields": [],
  "message": "All required details are present."
}
```

## Pipeline

1. Language detection using `langdetect`
2. Document type classification using keywords
3. Entity extraction
   English: spaCy + rule-based extraction
   Sinhala: Gemini-based extraction
4. Role resolution
5. Validation against required fields
6. Return missing-field message if incomplete
7. Load Jinja2 template
8. Draft document using Gemini with local fallback rendering
9. Save output as DOCX and PDF

## Folder Structure

```text
services/drafting-service/
├── assets/
│   └── fonts/
├── datasets/
│   ├── draft_pairs/
│   ├── ner_english/
│   ├── sinhala_extraction/
│   └── validation/
├── output/
├── src/
│   ├── api.py
│   ├── doc_classifier.py
│   ├── gemini_drafter.py
│   ├── gemini_extractor.py
│   ├── language_detector.py
│   ├── ner_extractor.py
│   ├── output_generator.py
│   ├── pipeline.py
│   ├── role_resolver.py
│   ├── template_loader.py
│   └── validator.py
├── templates/
├── .env.example
├── config.py
├── README.md
└── requirements.txt
```

## Notes

- Dataset content is intentionally not created here. The dataset folders are present and ready for the real JSON files later.
- PDF generation prefers `Noto Sans Sinhala` from `assets/fonts/` and falls back gracefully if the font is unavailable.
