import os
import torch
from faster_whisper import WhisperModel

# 4. Performance Requirements:
# Implement GPU acceleration detection; if a CUDA-compatible GPU is not found,
# default to cpu with int8 quantization to keep the RAM usage low while maintaining speed.
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if device == "cuda" else "int8"

# 1. Core Engine: Faster-Whisper
# Use the faster-whisper library to load the 'base' or 'small' model to ensure
# low-latency performance on a laptop (Lenovo V15).
model_size = "small"

print(f"[AI Backend] Loading Faster-Whisper model '{model_size}' on device: {device} (compute_type: {compute_type})")
model = WhisperModel(model_size, device=device, compute_type=compute_type)

def transcribe_audio(file_path):
    """
    Accepts a path to a .wav or .webm audio chunk, processes it, and returns a clean string of text.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")
        
    # 2. Technical Specifications:
    # Beam Size: Set beam_size=5 for a balance between speed and accuracy.
    # Language Detection: Explicitly set the language to 'en' (English) to reduce processing time, 
    # as legal trials in this system are in English.
    segments, info = model.transcribe(
        file_path, 
        beam_size=5, 
        language="en"
    )
    
    # 2. Timestamp Removal:
    # Ensure the output is a continuous string of text without timestamps, 
    # as this will be used for vector searching later.
    transcription = " ".join([segment.text.strip() for segment in segments])
    
    return transcription.strip()
