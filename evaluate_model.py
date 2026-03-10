import os
import json
import time
import torch
import torch.nn.functional as F
import numpy as np
from sklearn.metrics import confusion_matrix, classification_report
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# --- Calibration v2.2 (Sync with app.py) ---
TEMPERATURE = 1.8
CONFIDENCE_THRESHOLD = 0.60

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

# --- Configuration ---
MODEL_PATH = r"D:\RE\LawnovaWebapp\LAWNOVA_FINAL_BRAIN_v1\checkpoint-396"
TEST_SET_PATH = r"D:\RE\LawnovaWebapp\eval_test_set.jsonl"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"--- EVALUATING CALIBRATED ENGINE (v2.2) ---")

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH).to(DEVICE)
model.eval()

test_data = []
with open(TEST_SET_PATH, "r") as f:
    for line in f:
        if line.strip(): test_data.append(json.loads(line))

y_true, y_pred = [], []

for entry in test_data:
    text, true_label = entry['text'], entry['label']
    
    # Inference
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
    with torch.no_grad():
        logits = model(**inputs).logits
        probs = F.softmax(logits / TEMPERATURE, dim=-1).cpu().numpy()[0]
    
    score_law = probs[1]
    score_fact = probs[0]
    dominant_score = max(score_law, score_fact)
    
    # HEURISTICS v2.2
    clean_text = text.lower().strip()
    raw_tokens = [w.strip(".,!?;:\"") for w in clean_text.split() if w]
    words = [w for w in raw_tokens if w.isalnum()]
    
    has_marker = any(m in clean_text for m in LEGAL_MARKERS)
    fillers = [w for w in words if w in PROCEDURAL_FILLERS or len(w) <= 2]
    filler_ratio = len(fillers) / len(words) if words else 0
    
    is_very_short = len(words) < 8
    is_long = len(words) > 25
    
    demote = False
    if len(words) < 6 and not has_marker: demote = True
    elif filler_ratio > 0.70 and len(words) < 15 and not has_marker: demote = True
    elif is_long and has_marker and dominant_score >= 0.50: demote = False
    elif dominant_score < CONFIDENCE_THRESHOLD: demote = True
    
    is_strong = (not demote)
    
    # We want 1 if it's Law AND strong
    y_pred.append(1 if (is_strong and probs[1] > probs[0]) else 0)
    y_true.append(1 if true_label == 1 else 0)

print("\n--- RESULTS v2.2 ---")
print(classification_report(y_true, y_pred, target_names=["Non-Law", "Law"]))
cm = confusion_matrix(y_true, y_pred)
print(f"Matrix: Actual \\ Pred | Non-Law | Law")
print(f"Non-Law            | {cm[0][0]:7d} | {cm[0][1]:3d}")
print(f"Law                | {cm[1][0]:7d} | {cm[1][1]:3d}")
