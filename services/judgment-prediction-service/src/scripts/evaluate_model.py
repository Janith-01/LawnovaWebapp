import sys
import os
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Add project root to path
sys.path.append(os.getcwd())

def evaluate():
    model_path = "models/judgment_predictor"
    data_path = "data/dataset.csv"
    
    if not os.path.exists(model_path):
        print(f"Model path {model_path} does not exist. Training might be incomplete.")
        return

    print("Loading dataset...")
    df = pd.read_csv(data_path)
    texts = df['text'].tolist()
    labels = df['label'].tolist()
    
    # Split (Same random_state as train.py to ensure we test on validation set)
    _, val_texts, _, val_labels = train_test_split(texts, labels, test_size=0.2, random_state=42)
    
    print(f"Loading model from {model_path}...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForSequenceClassification.from_pretrained(model_path)
    except Exception as e:
         print(f"Error loading model: {e}")
         return

    print(f"Evaluating on {len(val_texts)} validation samples...")
    
    predictions = []
    
    # Inference
    # For bulk inference, we could use a pipeline or batching, 
    # but loop is fine for small val set (24 samples)
    with torch.no_grad():
        for text in val_texts:
            inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
            outputs = model(**inputs)
            logits = outputs.logits
            pred = logits.argmax().item()
            predictions.append(pred)
            
    # Metrics
    acc = accuracy_score(val_labels, predictions)
    report = classification_report(val_labels, predictions, target_names=["DISMISSED", "ALLOWED"])
    
    print("\n=== EVALUATION RESULTS ===")
    print(f"Accuracy: {acc:.4f}")
    print("\nClassification Report:")
    print(report)
    
    # Show specifics
    print("\n=== SAMPLE PREDICTIONS ===")
    for i in range(min(5, len(val_texts))):
        text_preview = val_texts[i][:100].replace('\n', ' ')
        actual = "ALLOWED" if val_labels[i] == 1 else "DISMISSED"
        pred = "ALLOWED" if predictions[i] == 1 else "DISMISSED"
        match = "✅" if actual == pred else "❌"
        print(f"{match} Pred: {pred} | Act: {actual} | Text: {text_preview}...")

if __name__ == "__main__":
    evaluate()
