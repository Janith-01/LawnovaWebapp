import hashlib
from datetime import datetime, timezone
from typing import Any


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_text(value: str | None) -> str | None:
    if value is None:
        return None
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def safe_serialize(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): safe_serialize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [safe_serialize(item) for item in value]

    for method_name in ("model_dump", "to_dict", "to_json_dict"):
        method = getattr(value, method_name, None)
        if not callable(method):
            continue
        try:
            if method_name == "model_dump":
                return safe_serialize(method(mode="json"))
            return safe_serialize(method())
        except TypeError:
            try:
                return safe_serialize(method())
            except Exception:
                continue
        except Exception:
            continue

    if hasattr(value, "__dict__"):
        try:
            return safe_serialize(vars(value))
        except Exception:
            pass

    return str(value)


def response_attr(response: Any, *names: str) -> Any:
    if response is None:
        return None
    for name in names:
        if isinstance(response, dict) and name in response:
            return response.get(name)
        try:
            value = getattr(response, name)
            if value is not None:
                return value
        except Exception:
            continue
    return None


def gemini_response_provenance(
    *,
    stage: str,
    requested_model: str,
    response: Any,
    prompt: str | None = None,
    output: str | None = None,
    field_sources: dict | None = None,
    fallback_used: bool = False,
) -> dict:
    response_id = response_attr(response, "response_id", "responseId")
    model_version = response_attr(response, "model_version", "modelVersion")
    usage_metadata = response_attr(response, "usage_metadata", "usageMetadata")

    return {
        "stage": stage,
        "provider": "gemini",
        "source": "gemini_api",
        "requested_model": requested_model,
        "model_version": safe_serialize(model_version),
        "response_id": safe_serialize(response_id),
        "create_time": safe_serialize(response_attr(response, "create_time", "createTime")),
        "usage_metadata": safe_serialize(usage_metadata),
        "metadata_available": bool(response_id or model_version or usage_metadata),
        "gemini_attempted": True,
        "fallback_used": fallback_used,
        "field_sources": field_sources or {},
        "prompt_hash": sha256_text(prompt),
        "output_hash": sha256_text(output),
        "recorded_at": utc_timestamp(),
    }


def local_provenance(
    *,
    stage: str,
    provider: str,
    source: str,
    reason: str | None = None,
    requested_model: str | None = None,
    prompt: str | None = None,
    output: str | None = None,
    field_sources: dict | None = None,
    gemini_attempted: bool = False,
    fallback_used: bool = True,
) -> dict:
    return {
        "stage": stage,
        "provider": provider,
        "source": source,
        "requested_model": requested_model,
        "reason": reason,
        "gemini_attempted": gemini_attempted,
        "fallback_used": fallback_used,
        "field_sources": field_sources or {},
        "prompt_hash": sha256_text(prompt),
        "output_hash": sha256_text(output),
        "recorded_at": utc_timestamp(),
    }
