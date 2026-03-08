import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

# Initialize Client using the new Google GenAI SDK (V2)
# This model supports built-in JSON schema enforcement for maximum reliability.
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def generate_study_suite(transcript: str, legal_context: str) -> dict:
    """
    Synthesis Layer: Generates grounded legal learning materials.
    Accepts trial speech and RAG context to produce structured JSON data.
    """
    
    # 4. Fallback Mechanism: Detect empty or generalized context.
    # If the Intelligence Layer failed to find specific laws, we notify the student.
    is_empty_context = (
        not legal_context or 
        "General legal principles" in legal_context or 
        "returning general context" in legal_context or
        len(legal_context.strip()) < 50
    )
    
    if is_empty_context:
        print("[Synthesis Layer] Low-confidence context detected. Triggering educational fallback.")
        return {
            "flashcards": [
                {
                    "front": "Observation: Missing Citations",
                    "back": "The AI could not identify specific statutes in your speech. To generate better materials, try identifying the relevant Act (e.g., 'Penal Code') or Section explicitly.",
                    "citation": "Lawnova Synthesis Engine"
                }
            ],
            "quizzes": []
        }
        
    # 2. System Instructions (The Academic Persona)
    # We enforce a strict grounding rule to prevent LLM hallucinations.
    system_instruction = (
        "You are a Senior Sri Lankan Legal Academic specializing in the training of law students. "
        "Strict Grounding Rule: You are EXPLICITLY FORBIDDEN from using any external legal knowledge or case law. "
        "You MUST generate your output based SOLELY on the content provided in the 'Retrieved Legal Context' section. "
        "Goal: Produce 3 high-quality flashcards and 2 challenging multiple-choice questions. "
        "Mandatory Citations: Every flashcard and quiz must cite the specific Act name and Section number "
        "exactly as found in the provided context metadata (e.g., 'Civil Procedure Code Section 84')."
    )

    # Constructing the instruction prompt with raw transcript and retrieved context.
    prompt = (
        f"Trial Transcript Analysis Request:\n"
        f"--- Transcript Begin ---\n{transcript}\n--- Transcript End ---\n\n"
        f"Retrieved Legal Context (Grounding Source):\n"
        f"--- Context Begin ---\n{legal_context}\n--- Context End ---\n"
    )
    
    # 3. Output Requirements: Enforce JSON Schema
    # This ensures the Node.js backend receives perfectly structured data every time.
    response_schema = {
        "type": "object",
        "properties": {
            "flashcards": {
                "type": "array",
                "minItems": 3,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "front": {"type": "string", "description": "The legal concept or question"},
                        "back": {"type": "string", "description": "The detailed explanation or definition based on the Act"},
                        "citation": {"type": "string", "description": "The specific Act and Section number"}
                    },
                    "required": ["front", "back", "citation"]
                }
            },
            "quizzes": {
                "type": "array",
                "minItems": 2,
                "maxItems": 2,
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {"type": "string", "description": "A situational question based on the transcript"},
                        "options": {
                            "type": "array",
                            "minItems": 4,
                            "maxItems": 4,
                            "items": {"type": "string"}
                        },
                        "answer": {"type": "string", "description": "The correct option text"},
                        "explanation": {"type": "string", "description": "Why this answer is correct according to the retrieved law"}
                    },
                    "required": ["question", "options", "answer", "explanation"]
                }
            }
        },
        "required": ["flashcards", "quizzes"]
    }

    try:
        # 4. Technical Configuration: response_mime_type and schema enforcement
        # Using Gemini 2.5 Flash for high performance and strict schema adherence.
        response = client.models.generate_content(
            model='gemini-2.5-flash', # Or the specific version deployed in your environment
            contents=prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_schema": response_schema,
                "temperature": 0.1, # Low temperature for consistent, grounded output
            }
        )
        
        # Parse and return synthesized data
        return json.loads(response.text)
        
    except Exception as e:
        print(f"[Synthesis Layer] Critical Generation Error: {e}")
        return {
            "flashcards": [],
            "quizzes": [],
            "error": "The AI generator encountered a technical error while synthesizing legal materials."
        }
