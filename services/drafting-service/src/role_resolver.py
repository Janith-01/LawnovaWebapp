def _unique_candidates(candidates: list) -> list:
    seen = set()
    ordered = []
    for candidate in candidates:
        value = candidate.get("text")
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(candidate)
    return ordered


def resolve_roles(entities: dict, doc_type: str) -> dict:
    updated = dict(entities)
    candidates = _unique_candidates(updated.pop("_role_candidates", []))

    if doc_type == "AFFIDAVIT":
        if not updated.get("deponent_name"):
            for candidate in candidates:
                if candidate.get("label") == "PERSON":
                    updated["deponent_name"] = candidate["text"]
                    break

    elif doc_type == "CONTRACT":
        ordered = [candidate["text"] for candidate in candidates if candidate.get("label") in {"PERSON", "ORG"}]
        if not updated.get("party_a") and ordered:
            updated["party_a"] = ordered[0]
        if not updated.get("party_b") and len(ordered) > 1:
            updated["party_b"] = ordered[1]

    elif doc_type == "PETITION":
        if not updated.get("petitioner_name"):
            for candidate in candidates:
                if candidate.get("label") == "PERSON":
                    updated["petitioner_name"] = candidate["text"]
                    break

        if not updated.get("respondent_name"):
            petitioner_name = (updated.get("petitioner_name") or "").lower()
            for candidate in candidates:
                candidate_name = candidate["text"]
                if candidate_name.lower() == petitioner_name:
                    continue
                if candidate.get("label") in {"PERSON", "ORG"}:
                    updated["respondent_name"] = candidate_name
                    break

    return updated
