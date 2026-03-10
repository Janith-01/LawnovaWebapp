import requests
import json

url = "http://localhost:10005/api/roleplay/chat"
payload = {
    "sessionId": "rp_test_session",
    "message": "I object, Your Honor! This is hearsay!",
    "history": []
}

# First, create a session
create_url = "http://localhost:10005/api/roleplay/session"
create_payload = {
    "userId": "test_user",
    "caseTitle": "State v. Perera",
    "caseDetails": {
        "title": "State v. Perera",
        "facts": ["The accused was seen at the scene."],
        "userRole": "Defense"
    }
}

print("--- Testing Roleplay Service (v2.2) ---")
try:
    # 1. Create Session
    create_resp = requests.post(create_url, json=create_payload)
    session_data = create_resp.json()
    if not session_data.get('success'):
        print(f"Failed to create session: {session_data}")
    else:
        session_id = session_data['data']['sessionId']
        print(f"Created session: {session_id}")
        
        # 2. Send Message
        payload['sessionId'] = session_id
        chat_resp = requests.post(url, json=payload, timeout=60)
        chat_data = chat_resp.json()
        
        if chat_data.get('success'):
            print(f"Response: {chat_data['data']['speaker']} ({chat_data['data']['speakerRole']}) - {chat_data['data']['ai_reply'][:100]}...")
            print(f"Win Prob: {chat_data['data']['win_probability']}%")
        else:
            print(f"Chat failed: {chat_data}")
            
except Exception as e:
    print(f"Error: {e}")
