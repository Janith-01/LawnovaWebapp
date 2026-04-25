from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.history import get_document, get_user_history, init_db
from src.pipeline import build_response, run_pipeline, run_validation


MIN_PROMPT_LENGTH = 20
MAX_PROMPT_LENGTH = 3000
OUTPUT_DIR = (Path(__file__).resolve().parents[1] / "output").resolve()
CONTENT_TYPES = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pdf": "application/pdf",
}


class PromptRequest(BaseModel):
    prompt: str


app = FastAPI(title="Lawnova Drafting Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


def _json_payload_response(payload: dict, status_code: int = status.HTTP_200_OK) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=payload)


def _error_payload(
    message: str,
    error_code: str,
    *,
    status_code: int,
    missing_fields: list | None = None,
    details=None,
) -> JSONResponse:
    payload = build_response(
        status="error",
        message=message,
        missing_fields=missing_fields or [],
        error_code=error_code,
        error_details=details,
    )
    return _json_payload_response(payload, status_code=status_code)


def _validate_prompt(prompt: str) -> tuple[str | None, JSONResponse | None]:
    normalized = prompt.strip()
    length = len(normalized)

    if not normalized:
        return None, _error_payload(
            "Prompt cannot be empty. Please provide a document description.",
            "empty_prompt",
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            missing_fields=["prompt"],
            details={"minimum_length": MIN_PROMPT_LENGTH},
        )

    if length < MIN_PROMPT_LENGTH:
        return None, _error_payload(
            "Prompt is too short. Please provide at least 20 characters with meaningful drafting details.",
            "prompt_too_short",
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            missing_fields=["prompt"],
            details={"minimum_length": MIN_PROMPT_LENGTH, "actual_length": length},
        )

    if length > MAX_PROMPT_LENGTH:
        return None, _error_payload(
            "Prompt is too long. Please limit the prompt to 3000 characters.",
            "prompt_too_long",
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            missing_fields=["prompt"],
            details={"maximum_length": MAX_PROMPT_LENGTH, "actual_length": length},
        )

    return normalized, None


def _status_code_for_payload(payload: dict) -> int:
    if payload.get("status") == "error":
        return status.HTTP_500_INTERNAL_SERVER_ERROR
    return status.HTTP_200_OK


def require_authenticated_user_id(user_id: str | None = Header(default=None, alias="user-id")) -> str:
    normalized_user_id = (user_id or "").strip()
    if not normalized_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Authentication required. Missing gateway user context.",
                "error_code": "authentication_required",
                "details": {"missing_header": "user-id"},
            },
        )
    return normalized_user_id


def _resolve_safe_download_file(filename: str) -> Path:
    normalized_filename = (filename or "").strip()
    candidate = Path(normalized_filename)

    if (
        not normalized_filename
        or candidate.name != normalized_filename
        or candidate.is_absolute()
        or any(part in {"..", "."} for part in candidate.parts)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Unsafe file path requested.",
                "error_code": "unsafe_download_path",
                "details": {"file": normalized_filename},
            },
        )

    resolved_path = (OUTPUT_DIR / normalized_filename).resolve()
    if resolved_path.parent != OUTPUT_DIR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Unsafe file path requested.",
                "error_code": "unsafe_download_path",
                "details": {"file": normalized_filename},
            },
        )

    return resolved_path


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return _error_payload(
        "Invalid request body. Send a JSON object with a 'prompt' string.",
        "invalid_request_body",
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        missing_fields=["prompt"],
        details=exc.errors(),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        message = detail.get("message") or "The request could not be processed."
        error_code = detail.get("error_code", "http_error")
        details = detail.get("details", detail)
    else:
        message = detail if isinstance(detail, str) else "The request could not be processed."
        error_code = "http_error"
        details = detail
    return _error_payload(
        message,
        error_code,
        status_code=exc.status_code,
        details=details,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return _error_payload(
        "An internal server error occurred. Please try again.",
        "internal_server_error",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        details={"exception": str(exc)},
    )


@app.post("/draft")
def draft(payload: PromptRequest, authenticated_user_id: str = Depends(require_authenticated_user_id)):
    prompt, error_response = _validate_prompt(payload.prompt)
    if error_response:
        return error_response

    result = run_pipeline(prompt, authenticated_user_id)
    result["user_id"] = authenticated_user_id
    return _json_payload_response(result, status_code=_status_code_for_payload(result))


@app.post("/validate")
def validate(payload: PromptRequest, authenticated_user_id: str = Depends(require_authenticated_user_id)):
    prompt, error_response = _validate_prompt(payload.prompt)
    if error_response:
        return error_response

    result = run_validation(prompt)
    result["user_id"] = authenticated_user_id
    return _json_payload_response(result, status_code=_status_code_for_payload(result))


@app.get("/download")
def download_document(
    file: str = Query(..., min_length=1),
    authenticated_user_id: str = Depends(require_authenticated_user_id),
):
    _ = authenticated_user_id
    safe_file_path = _resolve_safe_download_file(file)

    if not safe_file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Requested document was not found.",
                "error_code": "file_not_found",
                "details": {"file": safe_file_path.name},
            },
        )

    media_type = CONTENT_TYPES.get(safe_file_path.suffix.lower(), "application/octet-stream")
    return FileResponse(
        path=safe_file_path,
        media_type=media_type,
        filename=safe_file_path.name,
    )


@app.get("/history")
def history_list(authenticated_user_id: str = Depends(require_authenticated_user_id)):
    records = get_user_history(authenticated_user_id)
    return _json_payload_response({"status": "complete", "history": records})


@app.get("/history/{document_id}")
def history_detail(document_id: str, authenticated_user_id: str = Depends(require_authenticated_user_id)):
    record = get_document(document_id, authenticated_user_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Requested history record was not found.",
                "error_code": "history_not_found",
                "details": {"document_id": document_id},
            },
        )

    return _json_payload_response({"status": "complete", "document": record})
