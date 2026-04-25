# Evaluation Report

## Research Summary
This evaluation reviewed the Lawnova bilingual legal drafting service across four areas: English NER extraction, mocked Sinhala Gemini extraction, validation accuracy, and full drafting structure coverage.
The analysis used the current verified dataset files under the service dataset folders and exercised the real service logic while keeping Gemini-dependent evaluation offline and deterministic.
On the current evaluation set, the mocked Sinhala Gemini path achieved higher field-level accuracy (98.91%) than the English NER layer's overall F1 (96.08%).
The current system performs strongly on the available evaluation set.
Final conclusions should still be treated as provisional until the datasets are reviewed and verified by a legal officer.

## Dataset Status
- Generated at: `2026-04-25T14:18:49.028554+00:00`
- Missing dataset files: `0`

## Overall Scores
- English NER overall precision / recall / F1: `98.76%` / `93.54%` / `96.08%`
- Mocked Sinhala Gemini field accuracy: `98.91%`
- Validation status accuracy: `95.16%`
- Validation incomplete precision / recall: `91.18%` / `100.00%`
- Drafting average section coverage: `70.03%`

## Per-Document-Type Breakdown

### NER Extraction
- AFFIDAVIT: precision `99.44%`, recall `99.44%`, F1 `99.44%`
- CONTRACT: precision `100.00%`, recall `88.12%`, F1 `93.69%`
- PETITION: precision `97.02%`, recall `95.00%`, F1 `96.00%`

### Gemini Extraction
- AFFIDAVIT: field accuracy `95.83%`
- CONTRACT: field accuracy `100.00%`
- PETITION: field accuracy `100.00%`

### Validation
- AFFIDAVIT: status accuracy `95.00%`, missing-fields exact accuracy `80.00%`
- CONTRACT: status accuracy `100.00%`, missing-fields exact accuracy `100.00%`
- PETITION: status accuracy `90.91%`, missing-fields exact accuracy `81.82%`

### Drafting Quality
- AFFIDAVIT: average section coverage `100.00%`
- CONTRACT: average section coverage `60.10%`
- PETITION: average section coverage `50.00%`

## NER vs Gemini Comparison
- English NER overall F1: `96.08%`
- Mocked Sinhala Gemini overall field accuracy: `98.91%`
- Key finding: On the current evaluation set, the mocked Sinhala Gemini path achieved higher field-level accuracy (98.91%) than the English NER layer's overall F1 (96.08%).

## Notes
- Gemini extraction was evaluated with mocked offline responses to avoid real API calls during research evaluation.
- Drafting quality was measured as expected structural section coverage, not stylistic preference or legal sufficiency.
- Legal officer verification is required before treating these metrics as final research conclusions.
