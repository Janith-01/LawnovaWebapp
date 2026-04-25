# Evaluation Report

## Research Summary
This evaluation reviewed the Lawnova bilingual legal drafting service across four areas: English NER extraction, mocked Sinhala Gemini extraction, validation accuracy, and full drafting structure coverage.
The analysis used the current verified dataset files under the service dataset folders and exercised the real service logic while keeping Gemini-dependent evaluation offline and deterministic.
On the current evaluation set, the mocked Sinhala Gemini path achieved higher field-level accuracy (98.91%) than the English NER layer's overall F1 (7.40%).
The current system shows usable but mixed performance and still needs targeted improvement.
Final conclusions should still be treated as provisional until the datasets are reviewed and verified by a legal officer.

## Dataset Status
- Generated at: `2026-04-25T14:09:11.339741+00:00`
- Missing dataset files: `0`

## Overall Scores
- English NER overall precision / recall / F1: `8.66%` / `6.46%` / `7.40%`
- Mocked Sinhala Gemini field accuracy: `98.91%`
- Validation status accuracy: `95.16%`
- Validation incomplete precision / recall: `91.18%` / `100.00%`
- Drafting average section coverage: `70.03%`

## Per-Document-Type Breakdown

### NER Extraction
- AFFIDAVIT: precision `12.82%`, recall `11.11%`, F1 `11.90%`
- CONTRACT: precision `6.81%`, recall `4.98%`, F1 `5.75%`
- PETITION: precision `6.83%`, recall `4.58%`, F1 `5.49%`

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
- English NER overall F1: `7.40%`
- Mocked Sinhala Gemini overall field accuracy: `98.91%`
- Key finding: On the current evaluation set, the mocked Sinhala Gemini path achieved higher field-level accuracy (98.91%) than the English NER layer's overall F1 (7.40%).

## Notes
- Gemini extraction was evaluated with mocked offline responses to avoid real API calls during research evaluation.
- Drafting quality was measured as expected structural section coverage, not stylistic preference or legal sufficiency.
- Legal officer verification is required before treating these metrics as final research conclusions.
