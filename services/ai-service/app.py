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
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
CORS(app)

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
            "source": "Gemini 2.5 Flash",
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
            
        # Create temporary storage directory: /tmp/chunks/
        # Using abstract path combined with __file__ directory to ensure it is created within the microservice root
        tmp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp', 'chunks')
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
        
        # 2. Penalty Trigger: If no keywords found, notify Node
        if not is_legal_context:
            print(f"[AI Penalty] Stage: {current_stage} | NO KEYWORDS FOUND. Triggering Time Inflation...")
            try:
                # Notify Node.js for Time Inflation
                node_url = os.environ.get("MOCKTRIAL_SERVICE_URL", "http://localhost:10004")
                penalty_resp = requests.post(
                    f"{node_url}/api/rooms/{room_id}/session/penalty",
                    json={"reason": "Missing required legal vocabulary for active stage"},
                    headers={"x-internal-service-auth": os.environ.get("INTERNAL_SERVICE_SECRET")}
                )
                print(f"[AI Penalty] Callback status: {penalty_resp.status_code}")
            except Exception as e:
                print(f"[AI Penalty] Node Callback Failed: {e}")
                
        return jsonify({
            "success": True,
            "valid": is_legal_context,
            "found_keywords": found
        })
    except Exception as e:
        print(f"[AI Penalty] Fatal Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Running on 5009 so it doesn't conflict with Node's 5008
    PORT = int(os.environ.get("PYTHON_AI_SERVICE_PORT", 5009))
    print(f"[AI Backend] Python Flask server starting on port {PORT}...")
    app.run(host='0.0.0.0', port=PORT, debug=True)
