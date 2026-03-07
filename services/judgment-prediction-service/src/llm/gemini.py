import os
import logging
import time
from dotenv import load_dotenv
from google import genai
from google.api_core import exceptions
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

load_dotenv()
logger = logging.getLogger(__name__)

class GeminiExplainer:
    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY not set.")
            self.client = None
        else:
            try:
                # Use the SDK client initialization
                self.client = genai.Client(api_key=api_key)
                self.model_id = "gemini-2.5-flash"
                logger.info(f"Gemini Client initialized: {self.model_id}")
            except Exception as e:
                logger.error(f"Initialization failed: {e}")
                self.client = None

    # This decorator handles the 429 error automatically
    @retry(
        retry=retry_if_exception_type(exceptions.ResourceExhausted),
        wait=wait_exponential(multiplier=2, min=4, max=60), # Waits 4s, 8s, 16s... up to 60s
        stop=stop_after_attempt(5) # Gives up after 5 tries
    )
    def generate_explanation(self, facts: str, predicted_outcome: str, confidence: dict, context_docs: list) -> str:
        if not self.client:
            return "Explanation unavailable (Model not configured)."

        # 1. Cleaner Context Formatting
        formatted_context = "\n".join([
            f"[{i+1}] {doc.get('metadata', {}).get('title', 'Ref')}: {doc.get('text', '')[:400]}"
            for i, doc in enumerate(context_docs)
        ])

        # 2. Optimized Prompt for Legal Triage
        prompt = f"""
        ROLE: Sri Lankan Judicial Assistant (AI).
        PREDICTION: {predicted_outcome} (Confidence: {confidence.get('score', 'N/A')})
        
        CASE FACTS:
        {facts[:1500]}
        
        LEGAL CONTEXT:
        {formatted_context}
        
        TASK:
        Explain why the outcome is {predicted_outcome}. 
        - Cite the Document title provided in Context.
        - If Confidence is below 0.6, explicitly state: "CAUTION: This prediction is based on weak legal parallels."
        - Focus on Jurisdictional or Procedural rules first.
        """

        try:
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=prompt
            )
            return response.text
        except exceptions.ResourceExhausted:
            logger.error("Quota exceeded. Tenacity will retry...")
            raise # Raise to trigger the @retry decorator
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            return f"Error: {str(e)}"