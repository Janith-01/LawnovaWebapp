from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
from dotenv import load_dotenv

# Ensure the scripts directory and root are in path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts'))

from retrieval import search_legal_documents
from generator import generate_study_suite
from transcription import transcribe_audio
from validator import validate_stage_context
import uuid
import requests
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import re
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
CORS(app)

# Per-room penalty cooldown tracker (room_id -> last penalty epoch)
_penalty_cooldowns = {}

# --- Audit Engine Configuration (Dual Model Audit Engine v2.1) ---
MODEL_A_PATH = r"D:\RE\LawnovaWebapp\ML MODELS\LAWNOVA_MODEL_A"
MODEL_B_PATH = r"D:\RE\LawnovaWebapp\ML MODELS\LAWNOVA_MODEL_B_35K"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"[AI Backend] Initializing Audit Engine on {DEVICE}...")

# Global model/tokenizer placeholders
tokenizer_a = None
model_a = None
tokenizer_b = None
model_b = None

def init_audit_models():
    global tokenizer_a, model_a, tokenizer_b, model_b
    try:
        if tokenizer_a is None:
            tokenizer_a = AutoTokenizer.from_pretrained(MODEL_A_PATH)
            model_a = AutoModelForSequenceClassification.from_pretrained(MODEL_A_PATH).to(DEVICE)
            model_a.eval()
            print("[AI Backend] Model A (Evidence) Loaded.")
        if tokenizer_b is None:
            tokenizer_b = AutoTokenizer.from_pretrained(MODEL_B_PATH)
            model_b = AutoModelForSequenceClassification.from_pretrained(MODEL_B_PATH).to(DEVICE)
            model_b.eval()
            print("[AI Backend] Model B (Statutory) Loaded.")
    except Exception as e:
        print(f"[AI Backend] Error loading Audit Models: {e}")

# Call initialization
init_audit_models()

PROCEDURAL_FILLERS = {
    "hello", "hi", "hey", "morning", "afternoon", "evening", "honor", "honour", "horner", "honer",
    "lord", "lordship", "justice", "much", "obliged", "thank", "you", "yes", "no", "agree",
    "alright", "proceed", "wait", "moment", "understood", "counsel", "judge", 
    "court", "session", "clerk", "sir", "madam", "the", "is", "in", "to", "of", "a", "my", "your",
    "me", "we", "are", "here", "today", "address", "addressing", "representing", "name",
    "this", "that", "at", "by", "from", "with", "would", "could", "should", "i", "am",
    "objection", "relevance", "hearsay", "overruled", "sustained", "line", "reasoning", "object",
    "mr", "mrs", "ms", "dr", "prof"
}

TESTIMONIAL_VERBS = [
    "stated", "testified", "told", "said", "claimed", "reported", "deposed", 
    "expressed", "witnessed", "observed", "saw", "heard", "informed"
]

def predict_dual_scores(text):
    if not model_a or not model_b:
        return None
    
    inputs_a = tokenizer_a(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
    with torch.no_grad():
        outputs_a = model_a(**inputs_a)
        probs_a = F.softmax(outputs_a.logits, dim=-1).cpu().numpy()[0]
    
    inputs_b = tokenizer_b(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
    with torch.no_grad():
        outputs_b = model_b(**inputs_b)
        probs_b = F.softmax(outputs_b.logits, dim=-1).cpu().numpy()[0]
    
    return {
        "model_a": {"weak": float(probs_a[0]), "strong": float(probs_a[1])},
        "model_b": {"fact": float(probs_b[0]), "law": float(probs_b[1])}
    }

def heuristic_logic_gate(text, model_b_label):
    if model_b_label == "Law":
        pattern = r"\b(" + "|".join(TESTIMONIAL_VERBS) + r")\b"
        if re.search(pattern, text.lower()):
            return "Fact"
    return model_b_label

def get_auditor_comment(density, grounding, classification):
    if classification == "Law":
        return "Strong statutory citation with high logical density." if density > 0.7 else "Pure statutory citation without direct evidentiary link."
    else:
        return "Compelling factual claim with high probative value." if density > 0.7 else "Weak factual assertion; lacks depth or specific detail."

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "online", "service": "AI Backend Python Processor"})

@app.route('/generate-study-material', methods=['POST'])
def handle_generate_study_materials():
    """
    Main endpoint for generating materials from live trial transcript.
    """
    try:
        data = request.json
        transcript = data.get('transcript', '')

        if not transcript:
            return jsonify({"success": False, "error": "Transcript is required"}), 400

        print(f"[AI Backend] Processing transcript generation request...")

        # 1. Retrieval: Fetch relevant laws from Pinecone
        legal_context = search_legal_documents(transcript)

        # 2. Generation: Produce flashcards and quizzes using Gemini
        study_materials = generate_study_suite(transcript, legal_context)

        # 3. Augment with meta info
        study_materials['metadata'] = {
            "source": "Gemini 2.5 Flash Lite",
            "rag_context_retrieved": "No specific context" not in legal_context
        }

        return jsonify({
            "success": True,
            "data": study_materials
        })

    except Exception as e:
        print(f"[AI Backend] Fatal Server Error: {str(e)}")
        return jsonify({
            "success": False, 
            "error": "Internal processor error",
            "details": str(e)
        }), 500

@app.route('/search-legal-context', methods=['POST'])
def handle_search_legal_context():
    """
    Search-only endpoint for external agents.
    """
    try:
        data = request.json
        query = data.get('query', '')
        top_k = data.get('top_k', 3)

        if not query:
            return jsonify({"success": False, "error": "Query is required"}), 400

        print(f"[AI Backend] Searching legal context for: {query[:50]}...")
        context = search_legal_documents(query, top_k=top_k)

        return jsonify({
            "success": True,
            "context": context
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/transcribe', methods=['POST'])
def handle_transcription():
    """
    3. Integration with Flask: Temporary storage logic that saves the incoming audio buffer 
    from the Node.js mocktrial-service to a local folder before passing it to the transcription function.
    """
    try:
        # Check if an audio file was uploaded in the request
        if 'audio' not in request.files:
            return jsonify({"success": False, "error": "No audio file provided in request"}), 400
            
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({"success": False, "error": "Empty audio filename"}), 400
            
        # Create temporary storage directory: /temp/chunks/ to match nodemon ignore rules
        tmp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp', 'chunks')
        os.makedirs(tmp_dir, exist_ok=True)
        
        # Create a unique filename to avoid concurrency collisions
        safe_filename = secure_filename(audio_file.filename) or "chunk.webm"
        file_path = os.path.join(tmp_dir, f"{uuid.uuid4()}_{safe_filename}")
        
        # Save the incoming audio buffer to disk
        audio_file.save(file_path)
        print(f"[AI Backend] Received and stored audio chunk at: {file_path}")
        
        # Process audio using Faster-Whisper
        transcribed_text = transcribe_audio(file_path)
        print(f"[AI Backend] Transcription Result: {transcribed_text[:100]}...")
        
        # Clean up temporary audio file after processing to save disk space
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"[AI Backend] Warning: Failed to clean up temp file {file_path}: {e}")
            
        return jsonify({
            "success": True,
            "text": transcribed_text
        })
        
    except Exception as e:
        print(f"[AI Backend] Transcription Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/validate-stage', methods=['POST'])
def handle_stage_validation():
    """
    Requirement 2 & 3: Penalty Trigger.
    Analyzes the latest 30-second window or chunk for required legal vocabulary.
    Sends PENALTY_REQUIRED to Node if keywords are missing.
    Cooldown: skips penalty callback if last penalty for this room was < 60s ago.
    """
    try:
        data = request.json
        transcript = data.get('transcript', '')
        current_stage = data.get('stage', 'Opening Statements')
        room_id = data.get('roomId', '')
        
        if not transcript or not room_id:
            return jsonify({"success": False, "error": "Missing Required Data"}), 400
            
        # 1. Logic: Run Stage Validator (Requirement 1)
        is_legal_context, found = validate_stage_context(transcript, current_stage)
        
        # 2. Penalty Trigger: If no keywords found, notify Node (with cooldown)
        if not is_legal_context:
            import time
            now = time.time()
            last_penalty = _penalty_cooldowns.get(room_id, 0)
            if now - last_penalty >= 60:
                _penalty_cooldowns[room_id] = now
                print(f"[AI Penalty] Stage: {current_stage} | NO KEYWORDS FOUND. Triggering Time Inflation...")
                try:
                    # Notify Node.js for Time Inflation
                    node_url = os.environ.get("MOCKTRIAL_SERVICE_URL", "http://127.0.0.1:10004")
                    penalty_resp = requests.post(
                        f"{node_url}/api/rooms/{room_id}/session/penalty",
                        json={"reason": "Missing required legal vocabulary for active stage"},
                        headers={"x-internal-service-auth": os.environ.get("INTERNAL_SERVICE_SECRET")},
                        timeout=5
                    )
                    print(f"[AI Penalty] Callback status: {penalty_resp.status_code}")
                except Exception as e:
                    print(f"[AI Penalty] Node Callback Failed: {e}")
            else:
                print(f"[AI Penalty] Cooldown active for room {room_id}, skipping penalty")
                
        return jsonify({
            "success": True,
            "valid": is_legal_context,
            "found_keywords": found
        })
    except Exception as e:
        print(f"[AI Penalty] Fatal Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/audit', methods=['POST'])
def handle_audit():
    """
    Calibrated Audit Engine v2.1
    Processes trial transcript and returns Strong/Weak argument analysis.
    """
    try:
        data = request.json
        history = data.get('history', [])
        
        print(f"[AI Backend] Auditing transcript with {len(history)} items...")
        
        # Filter for user messages
        user_segments = [msg.get('content') for msg in history if msg.get('role') == 'user' and msg.get('content')]
        
        if not user_segments:
            return jsonify({
                "success": True,
                "status": "success",
                "results": []
            })

        results = []
        for text in user_segments:
            # 1. Semantic Density Filtering
            clean_text = text.lower().strip()
            raw_tokens = [w.strip(".,!?;:\"") for w in clean_text.split() if w]
            words = [w for w in raw_tokens if w.isalnum()]
            
            fillers = [w for w in words if w in PROCEDURAL_FILLERS or len(w) <= 2]
            filler_ratio = len(fillers) / len(words) if words else 0
            
            if len(words) < 7 and filler_ratio > 0.6:
                continue

            # 2. Dual Model Inference
            scores = predict_dual_scores(text)
            if not scores:
                continue
                
            evidence_density = scores["model_a"]["strong"]
            legal_grounding = scores["model_b"]["law"]
            
            # 3. Labeling and Gates
            raw_label = "Law" if legal_grounding > scores["model_b"]["fact"] else "Fact"
            final_label = heuristic_logic_gate(text, raw_label)
            
            if final_label == "Fact" and raw_label == "Law":
                legal_grounding = scores["model_b"]["fact"]

            # 4. Final Scorecard Logic (Combining Model A density + Model B grounding)
            # Higher weight on Model A for 'Fact', higher weight on Model B for 'Law'
            if final_label == "Law":
                final_score = (legal_grounding * 0.7) + (evidence_density * 0.3)
            else:
                final_score = (evidence_density * 0.8) + (legal_grounding * 0.2)
                
            # Classify Verdict
            if final_score >= 0.8:
                verdict = "Strong"
            elif final_score >= 0.55:
                verdict = "Moderate"
            else:
                verdict = "Weak"

            # 5. Result Formatting
            results.append({
                "argument": text,
                "score": round(final_score, 4),
                "verdict": verdict,
                "evidence_density": round(evidence_density, 4),
                "legal_grounding": round(legal_grounding, 4),
                "classification": final_label,
                "auditor_comment": get_auditor_comment(evidence_density, legal_grounding, final_label)
            })

        return jsonify({
            "success": True,
            "status": "success",
            "results": results
        })

    except Exception as e:
        print(f"[AI Backend] Audit Error: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Legal Brain encountered an error during audit",
            "details": str(e)
        }), 500

@app.route('/predict', methods=['POST'])
def handle_predict():
    """
    Real-time Legal Merit Scoring.
    Calculates the 'Win Probability' for a single statement.
    """
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({"status": "success", "win_probability": 50.0})

        # 1. Semantic Density Filtering (Prevent filler inflation)
        clean_text = text.lower().strip()
        raw_tokens = [w.strip(".,!?;:\"") for w in clean_text.split() if w]
        words = [w for w in raw_tokens if w.isalnum()]
        
        fillers = [w for w in words if w in PROCEDURAL_FILLERS or len(w) <= 2]
        filler_ratio = len(fillers) / len(words) if words else 0
        
        # If it's mostly filler logic or too short, decrease win probability (Penalize fluff)
        if len(words) < 6 and filler_ratio > 0.7:
            return jsonify({"status": "success", "win_probability": 25.0})

        # 2. Dual Model Inference
        scores = predict_dual_scores(text)
        if not scores:
            return jsonify({"status": "success", "win_probability": 50.0})
            
        evidence_density = scores["model_a"]["strong"]
        legal_grounding = scores["model_b"]["law"]
        
        # Classification for weighting
        raw_label = "Law" if legal_grounding > scores["model_b"]["fact"] else "Fact"
        final_label = heuristic_logic_gate(text, raw_label)
        
        # Calculate Merit Score (0-100)
        if final_label == "Law":
            merit_score = (legal_grounding * 0.7) + (evidence_density * 0.3)
        else:
            merit_score = (evidence_density * 0.8) + (legal_grounding * 0.2)
            
        win_prob = round(merit_score * 100, 1)
        
        # Guardrails: Never drop below 10% or rise above 95% purely on one statement
        win_prob = max(10.0, min(95.0, win_prob))
        
        print(f"[AI Merit] Text: {text[:40]}... | Score: {win_prob}%")
        
        return jsonify({
            "status": "success",
            "win_probability": win_prob
        })

    except Exception as e:
        print(f"[AI Merit] Error: {str(e)}")
        return jsonify({"status": "success", "win_probability": 50.0})

if __name__ == '__main__':
    # Running on 5009 so it doesn't conflict with Node's 5008
    PORT = int(os.environ.get("PYTHON_AI_SERVICE_PORT", 5009))
    print(f"[AI Backend] Python Flask server starting on port {PORT}...")
    # Disable reloader so it doesn't restart when saving temporary audio chunks to disk.
    app.run(host='0.0.0.0', port=PORT, debug=True, use_reloader=False)
