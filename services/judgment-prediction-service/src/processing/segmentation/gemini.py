"""
Gemini-based Judgment Segmentation module.

Uses Google Gemini API to extract structural sections and features
from raw judgment text.
"""

import json
import time
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

SEGMENTATION_PROMPT = """You are a Sri Lankan legal document analyzer. Given the raw text of a court judgment, 
extract the following structured information as a JSON object:

{
  "sections": {
    "header": "The case header including case number, court, parties, and judges",
    "facts": "The factual background of the case",
    "issues": "The legal issues considered by the court",
    "analysis": "The court's legal analysis and reasoning",
    "conclusion": "The court's conclusion and final orders",
    "disposition": "The final order/disposition of the case"
  },
  "features": {
    "outcome": "One of: ALLOWED, DISMISSED, PARTIALLY_ALLOWED, SETTLED, OTHER",
    "citations": ["List of case citations referenced in the judgment"],
    "keywords": ["List of key legal terms and topics discussed"]
  }
}

IMPORTANT RULES:
1. Return ONLY valid JSON. No markdown formatting, no code blocks, no explanations.
2. If a section is not found, use an empty string "".
3. For the outcome, infer from the conclusion/disposition.
4. For citations, extract case names and numbers (e.g., "SC Appeal 45/2019").
5. For keywords, extract relevant legal concepts (e.g., "fundamental rights", "habeas corpus").
6. Keep section text concise - summarize if very long.

Here is the raw judgment text:
"""


class GeminiSegmenter:
    """
    Uses Google Gemini API to segment legal judgment text
    into structured sections and extract features.
    """

    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash"):
        """
        Initialize the Gemini Segmenter.

        Args:
            api_key: Google Gemini API Key.
            model_name: Gemini model to use.
        """
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)
        self.log_callback = None
        self.cancel_callback = None

    def set_callbacks(self, log_fn=None, cancel_fn=None):
        """
        Set callback functions for logging and cancellation.

        Args:
            log_fn: Function to call with log messages.
            cancel_fn: Function that returns True if cancellation is requested.
        """
        self.log_callback = log_fn
        self.cancel_callback = cancel_fn

    def _log(self, msg: str):
        """Log a message via callback or logger."""
        if self.log_callback:
            self.log_callback(msg)
        logger.info(msg)

    def _is_cancelled(self) -> bool:
        """Check if cancellation was requested."""
        if self.cancel_callback:
            return self.cancel_callback()
        return False

    def segment(self, raw_text: str, max_retries: int = 3) -> dict | None:
        """
        Segment raw judgment text using Gemini API.

        Args:
            raw_text: The raw text of the judgment document.
            max_retries: Maximum number of retry attempts on failure.

        Returns:
            Dictionary with 'sections' and 'features' keys, or None on failure.
        """
        if not raw_text or len(raw_text.strip()) < 100:
            self._log("Skipping: Text too short for segmentation.")
            return None

        # Truncate very long texts to avoid token limits
        max_chars = 30000
        text_to_send = raw_text[:max_chars]
        if len(raw_text) > max_chars:
            self._log(f"Text truncated from {len(raw_text)} to {max_chars} characters.")

        prompt = SEGMENTATION_PROMPT + text_to_send

        for attempt in range(max_retries):
            if self._is_cancelled():
                self._log("Cancelled during segmentation attempt.")
                return None

            try:
                response = self.model.generate_content(prompt)

                if not response or not response.text:
                    self._log(f"Empty response from Gemini (attempt {attempt + 1}).")
                    continue

                # Clean response text - remove markdown code blocks if present
                response_text = response.text.strip()
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.startswith("```"):
                    response_text = response_text[3:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                response_text = response_text.strip()

                # Parse JSON
                result = json.loads(response_text)

                # Validate structure
                if "sections" not in result:
                    result["sections"] = {}
                if "features" not in result:
                    result["features"] = {}

                return result

            except json.JSONDecodeError as e:
                self._log(f"JSON parse error (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff

            except Exception as e:
                self._log(f"Gemini API error (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff

        self._log("All segmentation attempts failed.")
        return None
