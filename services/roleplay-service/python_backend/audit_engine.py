import sys
import io
import os
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from flask import Flask, request, jsonify
from flask_cors import CORS
import re

# Fix Windows console encoding for characters like emojis
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

app = Flask(__name__)
CORS(app)

# --- Configuration (Dual Model Audit Engine v3.0) ---
MODEL_A_PATH = r"D:\RE\LawnovaWebapp\ML MODELS\LAWNOVA_MODEL_A"
MODEL_B_PATH = r"D:\RE\LawnovaWebapp\ML MODELS\LAWNOVA_MODEL_B_35K"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"[AUDIT] Initializing Dual-Model Engine on {DEVICE}...")

# Load Model A (Evidence Strength Expert)
try:
    tokenizer_a = AutoTokenizer.from_pretrained(MODEL_A_PATH)
    model_a = AutoModelForSequenceClassification.from_pretrained(MODEL_A_PATH).to(DEVICE)
    model_a.eval()
    print("[AUDIT] Model A (Evidence) Loaded.")
except Exception as e:
    print(f"[AUDIT] Error loading Model A: {e}")

# Load Model B (Statutory Law Expert)
try:
    tokenizer_b = AutoTokenizer.from_pretrained(MODEL_B_PATH)
    model_b = AutoModelForSequenceClassification.from_pretrained(MODEL_B_PATH).to(DEVICE)
    model_b.eval()
    print("[AUDIT] Model B (Statutory) Loaded.")
except Exception as e:
    print(f"[AUDIT] Error loading Model B: {e}")

# --- Semantic Density Filtering (v2.2) ---
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
    """Returns scores from both Model A and Model B."""
    # Model A Prediction
    inputs_a = tokenizer_a(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
    with torch.no_grad():
        outputs_a = model_a(**inputs_a)
        probs_a = F.softmax(outputs_a.logits, dim=-1).cpu().numpy()[0]
    
    # Model B Prediction
    inputs_b = tokenizer_b(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
    with torch.no_grad():
        outputs_b = model_b(**inputs_b)
        probs_b = F.softmax(outputs_b.logits, dim=-1).cpu().numpy()[0]
    
    return {
        "model_a": {"weak": float(probs_a[0]), "strong": float(probs_a[1])},
        "model_b": {"fact": float(probs_b[0]), "law": float(probs_b[1])}
    }

def heuristic_logic_gate(text, model_b_label):
    """Overrides Model B Law label if testimonial verbs are present."""
    if model_b_label == "Law":
        pattern = r"\b(" + "|".join(TESTIMONIAL_VERBS) + r")\b"
        if re.search(pattern, text.lower()):
            print(f"[AUDIT] [Heuristic Gate] Overriding 'Law' to 'Fact' for: {text[:50]}...")
            return "Fact"
    return model_b_label

def get_auditor_comment(density, grounding, classification):
    """Generates a contextual comment based on scores."""
    if classification == "Law":
        if density > 0.7:
            return "Strong statutory citation with high logical density."
        else:
            return "Pure statutory citation without direct evidentiary link."
    else: # Fact
        if density > 0.7:
            return "Compelling factual claim with high probative value."
        else:
            return "Weak factual assertion; lacks depth or specific detail."

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "online", "models": ["LAWNOVA_MODEL_A", "LAWNOVA_MODEL_B"]})

@app.route('/api/audit-transcript', methods=['POST'])
def audit_transcript():
    try:
        data = request.json
        messages = data.get('history', [])
        
        # Ingest user messages only
        user_messages = [msg.get('content') for msg in messages if msg.get('role') == 'user' and msg.get('content')]
        if not user_messages:
            return jsonify({"status": "success", "results": []})

        results = []
        for text in user_messages:
            # 1. Semantic Density Filtering (Skip Fillers)
            clean_text = text.lower().strip()
            raw_tokens = [w.strip(".,!?;:\"") for w in clean_text.split() if w]
            words = [w for w in raw_tokens if w.isalnum()]
            
            fillers = [w for w in words if w in PROCEDURAL_FILLERS or len(w) <= 2]
            filler_ratio = len(fillers) / len(words) if words else 0
            
            if len(words) < 7 and filler_ratio > 0.6:
                continue # Skip procedural noise

            # 2. Dual Model Inference
            scores = predict_dual_scores(text)
            
            evidence_density = scores["model_a"]["strong"]
            legal_grounding = scores["model_b"]["law"]
            
            # Initial Classification
            raw_label = "Law" if legal_grounding > scores["model_b"]["fact"] else "Fact"
            
            # 3. Heuristic Logic Gate
            final_label = heuristic_logic_gate(text, raw_label)
            
            # If overridden, adjust grounding score display (optional, but logical)
            if final_label == "Fact" and raw_label == "Law":
                legal_grounding = scores["model_b"]["fact"]

            # 4. Generate Scorecard
            results.append({
                "argument": text,
                "evidence_density": round(evidence_density, 4),
                "legal_grounding": round(legal_grounding, 4),
                "classification": final_label,
                "auditor_comment": get_auditor_comment(evidence_density, legal_grounding, final_label)
            })

        return jsonify({"status": "success", "results": results})

    except Exception as e:
        print(f"[AUDIT] Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Running on 5009 — Dual-Model Audit Engine (used by RL Reward Loop + Trial Finalization)
    app.run(host='0.0.0.0', port=5009)
