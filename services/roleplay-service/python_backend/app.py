import sys
import io
import os

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# --- Configuration (Senior ML v2.2) ---
MODEL_PATH = r"D:\RE\LawnovaWebapp\LAWNOVA_FINAL_BRAIN_v1\checkpoint-396"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MAINTENANCE_MODE = False

TEMPERATURE = 1.8 
CONFIDENCE_THRESHOLD = 0.60 # Lowered to allow substantive legal speech through the gate

# --- Semantic Density Filtering (Refined v2.2) ---
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

LEGAL_MARKERS = [
    "section", "sections", "article", "contract", "breach", "liability", "evidence", 
    "witness", "clause", "case", "statute", "penal", "ordinance", "codes",
    "constitution", "rule", "procedure", "testify", "testified", "recovered",
    "identification", "guilty", "defendant", "accused", "plaintiff", "victim",
    "theft", "murder", "robbery", "assault", "negligence", "offence", "offense",
    "beyond", "reasonable", "doubt", "proved", "guilt", "innocent"
]

def log_audit(message):
    try:
        print(f"[AUDIT] {message}", flush=True)
    except:
        pass

log_audit("Initializing Senior ML Audit Engine v2.2...")

# Setup Gemini for reasoning
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

model = None
tokenizer = None

def load_model():
    global model, tokenizer, MAINTENANCE_MODE
    try:
        log_audit("Loading model components...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
        model = model.to(DEVICE)
        model.eval()
        log_audit(f"Service Ready on {DEVICE}.")
        MAINTENANCE_MODE = False
    except Exception as e:
        log_audit(f"CRITICAL LOAD ERROR: {str(e)}")
        MAINTENANCE_MODE = True

load_model()

def get_calibrated_probs(text):
    if not text.strip(): return []
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
    with torch.no_grad():
        outputs = model(**inputs)
        scaled_logits = outputs.logits / TEMPERATURE
        probs = F.softmax(scaled_logits, dim=-1).cpu().numpy()[0]
    return [{"label": "Fact", "score": float(probs[0])}, {"label": "Law", "score": float(probs[1])}]

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "online" if not MAINTENANCE_MODE else "maintenance", "device": DEVICE})

@app.route('/api/audit-transcript', methods=['POST'])
def audit_transcript():
    if MAINTENANCE_MODE or not model:
        return jsonify({"status": "maintenance"}), 503

    try:
        data = request.json
        messages = data.get('history', [])
        if not isinstance(messages, list): messages = [data]
        
        user_messages = [msg.get('content') for msg in messages if msg.get('role') == 'user' and msg.get('content')]
        if not user_messages: return jsonify({"status": "success", "results": []})

        results = []
        for text in user_messages:
            # Inference
            raw_scores = get_calibrated_probs(text)
            score_law = raw_scores[1]['score']
            score_fact = raw_scores[0]['score']
            
            dominant_score = max(score_law, score_fact)
            dominant_label = "Law" if score_law > score_fact else "Fact"
            
            # Semantic Analysis
            clean_text = text.lower().strip()
            raw_tokens = [w.strip(".,!?;:\"") for w in clean_text.split() if w]
            words = [w for w in raw_tokens if w.isalnum()]
            
            has_marker = any(m in clean_text for m in LEGAL_MARKERS)
            fillers = [w for w in words if w in PROCEDURAL_FILLERS or len(w) <= 2]
            filler_ratio = len(fillers) / len(words) if words else 0
            
            is_very_short = len(words) < 8
            is_long = len(words) > 25
            
            demote = False
            status = "Strong"
            reason = "Reasoning pending..."
            
            # --- Logic v2.2 Decision Tree ---
            
            # Rule 1: Extreme Noise Gate (Very short messages without markers)
            if len(words) < 6 and not has_marker:
                demote = True
                reason = "Procedural courtesy or social greeting; lacks substantive legal or factual weight."
                dominant_score = min(dominant_score, 0.40)
            
            # Rule 2: Filler Gate (Heavily social messages)
            elif filler_ratio > 0.70 and len(words) < 15 and not has_marker:
                demote = True
                reason = "Procedural statement; insufficient legal density for a valid trial argument."
                dominant_score = min(dominant_score, 0.45)
            
            # Rule 3: Substantial Substance Persistence (If it's long and has markers, it's likely Strong)
            elif is_long and has_marker and dominant_score >= 0.50:
                status = "Strong"
            
            # Rule 4: Model Threshold
            elif dominant_score < CONFIDENCE_THRESHOLD:
                demote = True
                reason = "Statement lacks sufficient legal or factual specificity to be classified as a strong argument."
                dominant_score = min(dominant_score, 0.60)

            if demote:
                status = "Weak"
            
            results.append({
                "argument": text,
                "score": round(float(dominant_score), 4),
                "status": status,
                "reason": reason,
                "label": dominant_label
            })

        # Reasoning Generation (Gemini)
        items_to_reason = [r for r in results if r["reason"] == "Reasoning pending..."]
        if GEMINI_API_KEY and items_to_reason:
            try:
                gen_model = genai.GenerativeModel('gemini-2.5-flash-lite')
                for r in items_to_reason:
                    prompt = f"As a legal auditor, explain in one punchy sentence the merit of this {r['label']} argument in a Sri Lankan court trial: '{r['argument']}'"
                    response = gen_model.generate_content(prompt)
                    r['reason'] = response.text.strip()
            except Exception as e:
                log_audit(f"Gemini Error: {e}")

        return jsonify({"status": "success", "results": results})

    except Exception as e:
        log_audit(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    try:
        text = request.json.get('text', '')
        raw = get_calibrated_probs(text)
        win_prob = round(float(raw[1]['score']) * 100, 1)
        return jsonify({"status": "success", "win_probability": win_prob})
    except:
        return jsonify({"status": "success", "win_probability": 50.0})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)
