from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.pipeline import build_response, run_pipeline, run_validation


MIN_PROMPT_LENGTH = 20
MAX_PROMPT_LENGTH = 3000


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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            missing_fields=["prompt"],
            details={"minimum_length": MIN_PROMPT_LENGTH},
        )

    if length < MIN_PROMPT_LENGTH:
        return None, _error_payload(
            "Prompt is too short. Please provide at least 20 characters with meaningful drafting details.",
            "prompt_too_short",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            missing_fields=["prompt"],
            details={"minimum_length": MIN_PROMPT_LENGTH, "actual_length": length},
        )

    if length > MAX_PROMPT_LENGTH:
        return None, _error_payload(
            "Prompt is too long. Please limit the prompt to 3000 characters.",
            "prompt_too_long",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            missing_fields=["prompt"],
            details={"maximum_length": MAX_PROMPT_LENGTH, "actual_length": length},
        )

    return normalized, None


def _status_code_for_payload(payload: dict) -> int:
    if payload.get("status") == "error":
        return status.HTTP_500_INTERNAL_SERVER_ERROR
    return status.HTTP_200_OK


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return _error_payload(
        "Invalid request body. Send a JSON object with a 'prompt' string.",
        "invalid_request_body",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        missing_fields=["prompt"],
        details=exc.errors(),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    message = exc.detail if isinstance(exc.detail, str) else "The request could not be processed."
    return _error_payload(
        message,
        "http_error",
        status_code=exc.status_code,
        details=exc.detail,
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
def draft(payload: PromptRequest):
    prompt, error_response = _validate_prompt(payload.prompt)
    if error_response:
        return error_response

    result = run_pipeline(prompt)
    return _json_payload_response(result, status_code=_status_code_for_payload(result))


@app.post("/validate")
def validate(payload: PromptRequest):
    prompt, error_response = _validate_prompt(payload.prompt)
    if error_response:
        return error_response

    result = run_validation(prompt)
    return _json_payload_response(result, status_code=_status_code_for_payload(result))
