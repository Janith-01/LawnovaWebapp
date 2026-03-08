import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import os

MODEL_PATH = r"D:\RE\LawnovaWebapp\LAWNOVA_FINAL_BRAIN_v1\checkpoint-396"

try:
    print("Trying to load model...")
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
    print("✅ Model loaded!")
    
    print("Trying to load tokenizer...")
    # Try loading from the same path
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        print("✅ Tokenizer loaded from local path!")
    except Exception as e:
        print(f"❌ Failed to load tokenizer from local path: {e}")
        print("Trying to load from law-ai/InLegalBERT...")
        tokenizer = AutoTokenizer.from_pretrained("law-ai/InLegalBERT")
        print("✅ Tokenizer loaded from law-ai/InLegalBERT!")

except Exception as e:
    print(f"❌ Error: {e}")
