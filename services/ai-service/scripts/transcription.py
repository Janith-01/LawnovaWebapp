import os
import torch
from faster_whisper import WhisperModel

# 4. Performance Requirements:
# Implement GPU acceleration detection; if a CUDA-compatible GPU is not found,
# default to cpu with int8 quantization to keep the RAM usage low while maintaining speed.
# This ensures efficient performance on a laptop like the Lenovo V15.
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if device == "cuda" else "int8"

# 1. Core Engine: Faster-Whisper
# Load the 'small' model for a balance between speed and quality on standard hardware.
model_size = "small"

print(f"[AI Backend] Perception Layer: Loading Faster-Whisper model '{model_size}' on device: {device} (compute_type: {compute_type})")
model = WhisperModel(model_size, device=device, compute_type=compute_type)

def transcribe_audio(file_path):
    """
    Core function for the Perception Layer. 
    Accepts a path to a .wav or .webm audio chunk, processes it, and returns a clean string of text.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")
        
    # 2. Technical Specifications:
    # beam_size=5 ensures accuracy via multiple alternative paths.
    # language="en" pinpoints the model to English, accelerating detection.
    segments, info = model.transcribe(
        file_path, 
        beam_size=5, 
        language="en"
    )
    
    # 2. Timestamp Removal:
    # We join all segment texts into a single continuous string. 
    # This prepares the data for effective RAG pipeline search.
    transcription = " ".join([segment.text.strip() for segment in segments])
    
    return transcription.strip()
