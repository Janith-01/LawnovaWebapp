from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import os

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
# 1. Get the directory where app.py is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. MATCH THIS TO YOUR ACTUAL FILE NAME
MODEL_FILENAME = "legal_win_predictor.pkl" 

# 3. Combine them
MODEL_PATH = os.path.join(BASE_DIR, MODEL_FILENAME)

model = None
vectorizer = None

def load_brain():
    global model, vectorizer
    print(f"🔍 Looking for model at: {MODEL_PATH}")
    
    if os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, "rb") as f:
                vectorizer, model = pickle.load(f)
            print("✅ Brain Loaded Successfully!")
        except Exception as e:
            print(f"❌ Error loading pickle: {e}")
    else:
        print(f"❌ Error: File not found at {MODEL_PATH}")

load_brain()

@app.route('/predict', methods=['POST'])
def predict():
    if not model:
        return jsonify({"error": "Model not loaded"}), 500
    
    try:
        data = request.json
        text = data.get("text", "")
        if not text:
            return jsonify({"error": "No text provided"}), 400

        vec = vectorizer.transform([text])
        win_prob = model.predict_proba(vec)[0][1]
        
        return jsonify({
            "status": "success",
            "win_probability": round(win_prob * 100, 2)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Python Backend running on port 5001")
    app.run(port=5001, debug=True)