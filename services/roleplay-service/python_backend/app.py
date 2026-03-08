import sys
import io
import os

# Fix Windows console encoding - must be at the very top
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from dotenv import load_dotenv
# Load environment variables from the parent roleplay-service directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
import google.generativeai as genai

app = Flask(__name__)
# Enable CORS for frontend and cross-service communication
CORS(app)

# --- Configuration ---
# Path to the fine-tuned BERT model
MODEL_PATH = r"D:\RE\LawnovaWebapp\LAWNOVA_FINAL_BRAIN_v1\checkpoint-396"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print("[AUDIT] Initializing Argument Audit Service...")
print(f"[AUDIT] Loading model from: {MODEL_PATH}")
print(f"[AUDIT] Using device: {DEVICE}")

# Setup Gemini for the reasoning engine
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

classifier = None

def load_model():
    global classifier
    try:
        print(f"[AUDIT] Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

        print(f"[AUDIT] Loading model weights...")
        model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)

        # Determine device
        device_id = -1
        if DEVICE == "cuda":
            try:
                model = model.to("cuda")
                device_id = 0
                print("[AUDIT] Using CUDA acceleration")
            except Exception as cuda_err:
                print(f"[AUDIT] CUDA failed, falling back to CPU: {cuda_err}")
                model = model.to("cpu")
        else:
            model = model.to("cpu")
            print("[AUDIT] Using CPU for inference")

        # Initialize classification pipeline
        classifier = pipeline(
            "text-classification",
            model=model,
            tokenizer=tokenizer,
            device=device_id,
            top_k=None
        )
        print("[AUDIT] Pipeline successfully initialized! Service is ready.")
    except Exception as e:
        print(f"[AUDIT] CRITICAL ERROR loading model: {str(e)}")
        import traceback
        traceback.print_exc()

# Load model on startup
load_model()

def calculate_verdict(score):
    """
    Categorize the confidence score into Strong, Moderate, or Weak levels.
    """
    if score >= 0.7:
        return "Strong"
    elif score >= 0.4:
        return "Moderate"
    else:
        return "Weak"

@app.route('/health', methods=['GET'])
def health():
    """Service health check endpoint"""
    return jsonify({
        "status": "online",
        "model_loaded": classifier is not None,
        "device": DEVICE,
        "model_path": MODEL_PATH
    })

@app.route('/api/audit', methods=['POST'])
def audit():
    """
    Main endpoint for argument auditing.
    Expects: { "arguments": ["string1", "string2", ...] }
    Returns: { "results": [ { "score": 0.85, "verdict": "Strong" }, ... ] }
    """
    if not classifier:
        return jsonify({"error": "Model not successfully loaded on server"}), 500

    try:
        data = request.json
        if not data or 'arguments' not in data:
            return jsonify({"error": "Missing 'arguments' field in request JSON"}), 400

        arguments = data['arguments']
        if not isinstance(arguments, list):
            return jsonify({"error": "'arguments' must be a JSON array of strings"}), 400

        if not arguments:
            return jsonify({
                "status": "success",
                "results": [],
                "count": 0
            })

        # Process in batches for efficiency
        batch_size = min(len(arguments), 32)
        raw_results = classifier(arguments, batch_size=batch_size)

        processed_results = []
        for res in raw_results:
            # Result format: [{'label': 'LABEL_0', 'score': 0.1}, {'label': 'LABEL_1', 'score': 0.9}]
            # Index 1 represents the 'strong argument' probability
            score = next((item['score'] for item in res if '1' in item['label']), res[-1]['score'])

            processed_results.append({
                "score": round(float(score), 4),
                "verdict": calculate_verdict(score)
            })

        return jsonify({
            "status": "success",
            "results": processed_results,
            "count": len(processed_results)
        })

    except Exception as e:
        print(f"[AUDIT] Inference Error: {str(e)}")
        return jsonify({
            "error": "Failed to process arguments",
            "details": str(e)
        }), 500

@app.route('/api/audit-transcript', methods=['POST'])
def audit_transcript():
    """
    Expects full trial JSON context. Extracts user messages, gets logic score from InLegalBERT,
    and uses Gemini to generate a reasoning for why it's Strong/Weak based on Sri Lankan law.
    """
    if not classifier:
        return jsonify({"error": "Model not successfully loaded on server"}), 500

    try:
        data = request.json
        if not data:
            return jsonify({"error": "Missing request JSON"}), 400

        # Accept either history key or assume it is the history itself
        history = data.get('history', data)
        if hasattr(history, 'get') and 'history' in history:
            history = history['history']
            
        if not isinstance(history, list):
            history = [data] # Fallback inside an array

        # Filter user messages
        user_messages = [msg.get('content') for msg in history if msg.get('role') == 'user' and msg.get('content')]

        if not user_messages:
            return jsonify({
                "status": "success",
                "results": [],
                "count": 0
            })

        # Process through the InLegalBERT classification pipeline
        try:
            batch_size = min(len(user_messages), 32)
            raw_results = classifier(user_messages, batch_size=batch_size)
        except Exception as model_err:
            print(f"[AUDIT] InLegalBERT Model Inference Error (D:\\RE\\LawnovaWebapp\\LAWNOVA_FINAL_BRAIN_v1): {str(model_err)}")
            return jsonify({
                "error": "InLegalBERT Model Inference Failed",
                "details": str(model_err)
            }), 500

        processed_results = []
        for idx, res in enumerate(raw_results):
            score = next((item['score'] for item in res if '1' in item['label']), res[-1]['score'])
            verdict = calculate_verdict(score)
            argument_text = user_messages[idx]
            
            # Use Gemini reasoning engine
            reason = "No reasoning provided."
            if GEMINI_API_KEY:
                try:
                    model = genai.GenerativeModel('gemini-2.5-flash')
                    prompt = f"""
You are a Sri Lankan legal evaluator.
The following argument was scored as {verdict} (Logic Score: {score:.2f}) by our primary logic model.
Briefly explain WHY this argument is considered {verdict} under Sri Lankan law logic (such as Penal Code or Contract Law) in one or two sentences.

Argument: "{argument_text}"
"""
                    response = model.generate_content(prompt)
                    reason = response.text.strip()
                except Exception as llm_e:
                    print(f"[AUDIT] LLM Reasoning Error: {str(llm_e)}")
                    reason = f"Error generating reason: {str(llm_e)}"
            
            processed_results.append({
                "argument": argument_text,
                "score": round(float(score), 4),
                "status": verdict,
                "reason": reason
            })

        return jsonify({
            "status": "success",
            "results": processed_results,
            "count": len(processed_results)
        })

    except Exception as e:
        print(f"[AUDIT] Audit Transcript Error: {str(e)}")
        return jsonify({
            "error": "Failed to process transcript",
            "details": str(e)
        }), 500

@app.route('/predict', methods=['POST'])
def predict():
    """
    Win probability endpoint for the Legal Merit bar.
    Called by aiJudge.js with { "text": "user argument" }
    Returns { "status": "success", "win_probability": 0-100 }
    """
    if not classifier:
        return jsonify({"status": "error", "win_probability": 50.0}), 500

    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({"status": "error", "win_probability": 50.0}), 400

        text = data['text']
        if not text or not text.strip():
            return jsonify({"status": "success", "win_probability": 50.0})

        # Run inference on the single argument
        result = classifier(text[:512])  # Truncate to model max length

        # Extract the "strong argument" probability (LABEL_1)
        score = 0.5
        if result and len(result) > 0:
            labels = result[0] if isinstance(result[0], list) else result
            for item in labels:
                if '1' in item.get('label', ''):
                    score = item['score']
                    break

        # Convert 0-1 score to 0-100 percentage
        win_probability = round(float(score) * 100, 1)

        # Clamp to reasonable range (20-95) so it feels dynamic
        win_probability = max(20.0, min(95.0, win_probability))

        print(f"[PREDICT] Score: {win_probability}% for: {text[:60]}...")
        return jsonify({
            "status": "success",
            "win_probability": win_probability
        })

    except Exception as e:
        print(f"[PREDICT] Error: {str(e)}")
        return jsonify({"status": "error", "win_probability": 50.0}), 500

if __name__ == '__main__':
    print("[AUDIT] Microservice listening on port 5002")
    app.run(host='0.0.0.0', port=5002, debug=False)