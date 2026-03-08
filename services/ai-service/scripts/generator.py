import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

# Initialize Client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def generate_study_suite(transcript: str, legal_context: str) -> dict:
    """
    1. Input Handling: Accepts the text transcript of the student's speech 
    and the legal context retrieved from the Intelligence Layer (Pinecone).
    """
    
    # 4. Fallback mechanism: If no specific context was found, rely on Legal Basics
    is_empty_context = not legal_context or "General legal principles" in legal_context or "No specific legal context" in legal_context
    if is_empty_context:
        print("[Synthesis Layer] Empty or general context detected, returning Legal Basics fallback.")
        return {
            "flashcards": [
                {
                    "front": "Legal Basics",
                    "back": "To improve arguments, you must focus on citing specific statutory provisions. Provide more precise legal terminology in your speech to trigger accurate database retrieval.",
                    "citation": "General Academic Advice"
                }
            ],
            "quizzes": []
        }
        
    # 2. System Instructions (The Persona)
    system_instruction = (
        "You are a Senior Sri Lankan Legal Academic. "
        "Strict Grounding Rule: You are EXPLICITLY FORBIDDEN from using external knowledge. "
        "You MUST generate flashcards and quizzes based SOLELY on the provided legal_context to avoid hallucinations. "
        "Ensure exactly 3 Flashcards and 2 Multiple Choice Questions are generated. "
        "Mandatory Citations: The 'citation' field must include the specific Act name and Section number found in the metadata of the retrieved law (e.g., 'Penal Code Section 369')."
    )

    prompt = (
        f"Trial Transcript:\n{transcript}\n\n"
        f"Retrieved Legal Context (Use ONLY this to generate the JSON response):\n{legal_context}\n"
    )
    
    # 3. Output Requirements (JSON Schema constraint)
    response_schema = {
        "type": "object",
        "properties": {
            "flashcards": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "front": {"type": "string"},
                        "back": {"type": "string"},
                        "citation": {"type": "string"}
                    },
                    "required": ["front", "back", "citation"]
                }
            },
            "quizzes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {"type": "string"},
                        "options": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "answer": {"type": "string"},
                        "explanation": {"type": "string"}
                    },
                    "required": ["question", "options", "answer", "explanation"]
                }
            }
        },
        "required": ["flashcards", "quizzes"]
    }

    try:
        # 4. Technical Configuration: response_mime_type
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_schema": response_schema,
            }
        )
        
        return json.loads(response.text)
        
    except Exception as e:
        print(f"[Synthesis Layer] Error generating study suite: {e}")
        return {
            "flashcards": [],
            "quizzes": [],
            "error": str(e)
        }
