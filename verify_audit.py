import requests
import json

url = "http://localhost:5002/api/audit-transcript"
payload = {
    "history": [
        {"role": "user", "content": "Thank you, Your Honor."}
    ]
}

print("--- Testing Audit Service (v2.2) No-Op Filter ---")
try:
    resp = requests.post(url, json=payload, timeout=20)
    data = resp.json()
    
    if data.get('status') == 'success':
        for r in data['results']:
            print(f"Argument: {r['argument']}")
            print(f"Status: {r['status']}")
            print(f"Score: {r['score']}")
            print(f"Reason: {r['reason']}")
    else:
        print(f"Audit failed: {data}")
        
except Exception as e:
    print(f"Error: {e}")
