import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

# Explicitly load .env from the service root
env_path = Path(__file__).resolve().parents[2] / ".env"

load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

# Models to try in order of free-tier availability
FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-001",
]

FALLBACK_EXPLANATION_TEXT = (
    "AI legal explanation is temporarily unavailable due to high model demand. "
    "Your prediction result is still valid. Please retry in a moment."
)

RETRYABLE_ERROR_MARKERS = (
    "503",
    "UNAVAILABLE",
    "RESOURCE_EXHAUSTED",
    "429",
    "RATE_LIMIT",
    "DEADLINE_EXCEEDED",
    "TIMEOUT",
    "INTERNAL",
)


def _is_retryable_error_message(error: Exception) -> bool:
    message = str(error).upper()
    return any(marker in message for marker in RETRYABLE_ERROR_MARKERS)


def _is_retryable_exception(error: Exception) -> bool:
    if isinstance(error, (genai_errors.ClientError, genai_errors.ServerError)):
        return _is_retryable_error_message(error)
    return _is_retryable_error_message(error)


class GeminiExplainer:
    def __init__(self, model_id: str = None):
        api_key = os.environ.get("GEMINI_API_KEY1")
        if not api_key:
            logger.warning("GEMINI_API_KEY1 not set.")
            self.client = None
        else:
            try:
                self.client = genai.Client(api_key=api_key)
                self.model_id = model_id or FALLBACK_MODELS[0]
                logger.info(f"Gemini Client initialized with model: {self.model_id}")
            except Exception as e:
                logger.error(f"Initialization failed: {e}")
                self.client = None

    @retry(
        retry=retry_if_exception(_is_retryable_exception),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def _call_model(self, prompt: str) -> str:
        """Inner method - only handles the API call so @retry is scoped correctly."""
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=prompt
        )
        return response.text

    def generate_explanation(
        self,
        facts: str,
        predicted_outcome: str,
        confidence: dict,
        context_docs: list
    ) -> dict:
        if not self.client:
            return {
                "text": "Explanation unavailable (model not configured).",
                "status": "unavailable",
                "message": "Explanation model is not configured on the server.",
                "can_retry": False,
            }

        formatted_context = "\n".join([
            f"[{i+1}] {doc.get('metadata', {}).get('title', 'Ref')}: {doc.get('text', '')[:400]}"
            for i, doc in enumerate(context_docs)
        ])

        confidence_score = max(
            confidence.get("dismissed", 0),
            confidence.get("allowed", 0),
        )
        caution_note = (
            "\n- CAUTION: This prediction is based on weak legal parallels."
            if isinstance(confidence_score, (int, float)) and confidence_score < 0.6
            else ""
        )

        prompt = f"""
        ROLE: Sri Lankan Judicial Assistant (AI).
        PREDICTION: {predicted_outcome} (Confidence: {confidence_score:.2f})

        CASE FACTS:
        {facts[:1500]}

        LEGAL CONTEXT:
        {formatted_context}

        TASK:
        Explain why the outcome is {predicted_outcome}.
        - Cite the Document title provided in Context.{caution_note}
        - Focus on Jurisdictional or Procedural rules first.
        """

        had_retryable_failure = False
        had_non_retryable_failure = False

        # Try each model in the fallback chain
        for model in FALLBACK_MODELS:
            self.model_id = model
            try:
                logger.info(f"Attempting with model: {model}")
                explanation_text = self._call_model(prompt)
                if explanation_text and explanation_text.strip():
                    return {
                        "text": explanation_text,
                        "status": "generated",
                        "message": None,
                        "can_retry": False,
                    }
                raise RuntimeError("Gemini returned an empty explanation response.")
            except (genai_errors.ClientError, genai_errors.ServerError) as e:
                if _is_retryable_exception(e):
                    had_retryable_failure = True
                    logger.warning(f"Retryable Gemini issue for {model}: {e}")
                    continue
                had_non_retryable_failure = True
                logger.error(f"Non-retryable Gemini API error with {model}: {e}")
                break
            except Exception as e:
                if _is_retryable_exception(e):
                    had_retryable_failure = True
                    logger.warning(f"Retryable unexpected Gemini issue for {model}: {e}")
                    continue
                had_non_retryable_failure = True
                logger.error(f"Unexpected non-retryable Gemini error with {model}: {e}")
                break

        if had_retryable_failure:
            return {
                "text": FALLBACK_EXPLANATION_TEXT,
                "status": "fallback",
                "message": "Explanation generation is temporarily rate-limited or unavailable.",
                "can_retry": True,
            }

        if had_non_retryable_failure:
            return {
                "text": "AI legal explanation is currently unavailable.",
                "status": "unavailable",
                "message": "Explanation generation failed due to a non-retryable provider error.",
                "can_retry": False,
            }

        return {
            "text": "AI legal explanation is currently unavailable.",
            "status": "unavailable",
            "message": "Explanation model did not return a valid response.",
            "can_retry": False,
        }
