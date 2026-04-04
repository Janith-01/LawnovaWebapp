import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

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
        retry=retry_if_exception_type((genai_errors.ClientError,)),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def _call_model(self, prompt: str) -> str:
        """Inner method — only handles the API call so @retry is scoped correctly."""
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
    ) -> str:
        if not self.client:
            return "Explanation unavailable (Model not configured)."

        formatted_context = "\n".join([
            f"[{i+1}] {doc.get('metadata', {}).get('title', 'Ref')}: {doc.get('text', '')[:400]}"
            for i, doc in enumerate(context_docs)
        ])

        confidence_score = confidence.get("score", 1.0)
        caution_note = (
            "\n- CAUTION: This prediction is based on weak legal parallels."
            if isinstance(confidence_score, (int, float)) and confidence_score < 0.6
            else ""
        )

        prompt = f"""
        ROLE: Sri Lankan Judicial Assistant (AI).
        PREDICTION: {predicted_outcome} (Confidence: {confidence_score})

        CASE FACTS:
        {facts[:1500]}

        LEGAL CONTEXT:
        {formatted_context}

        TASK:
        Explain why the outcome is {predicted_outcome}.
        - Cite the Document title provided in Context.{caution_note}
        - Focus on Jurisdictional or Procedural rules first.
        """

        # Try each model in the fallback chain
        for model in FALLBACK_MODELS:
            self.model_id = model
            try:
                logger.info(f"Attempting with model: {model}")
                return self._call_model(prompt)
            except (genai_errors.ClientError, genai_errors.ServerError) as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    logger.warning(f"Quota exhausted for {model}, trying next model...")
                    continue
                logger.error(f"Gemini API error with {model}: {e}")
                return f"Error generating explanation: {str(e)}"
            except Exception as e:
                logger.error(f"Unexpected Gemini error with {model}: {e}")
                return f"Error generating explanation: {str(e)}"

        return "Explanation unavailable: All models have exceeded their quota. Please check your billing at https://ai.dev/rate-limit."