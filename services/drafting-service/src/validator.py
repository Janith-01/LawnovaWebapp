from config import FIELD_LABELS, REQUIRED_FIELDS


def validate_fields(doc_type: str, extracted_params: dict, language: str) -> dict:
    required_fields = REQUIRED_FIELDS.get(doc_type, [])
    missing_fields = []

    for field in required_fields:
        value = extracted_params.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing_fields.append(field)

    if not missing_fields:
        message = (
            "All required details are present."
            if language == "en"
            else "අවශ්‍ය සියලු තොරතුරු සම්පූර්ණයි."
        )
        return {
            "status": "complete",
            "missing_fields": [],
            "message": message,
        }

    labels = [
        FIELD_LABELS.get(field, {}).get(language, field)
        for field in missing_fields
    ]

    if language == "si":
        message = "පහත තොරතුරු අඩුපාඩු ඇත:\n"
        message += "\n".join(f"- {label}" for label in labels)
        message += "\nකරුණාකර ඉහත තොරතුරු සපයා නැවත උත්සාහ කරන්න."
    else:
        message = "The following details are missing:\n"
        message += "\n".join(f"- {label}" for label in labels)
        message += "\nPlease provide the above details and try again."

    return {
        "status": "incomplete",
        "missing_fields": missing_fields,
        "message": message,
    }
