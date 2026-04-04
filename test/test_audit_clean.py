import requests
import json

url = "http://127.0.0.1:5002/api/audit-transcript"
data = {
    "history": [
        {"role": "user", "content": "hello your honor"}
    ]
}

try:
    response = requests.post(url, json=data)
    print(f"Status: {response.status_code}")
    res_data = response.json()
    for r in res_data.get('results', []):
        print(f"Argument: {r.get('argument')}")
        print(f"Score: {r.get('score')}")
        print(f"Status: {r.get('status')}")
except Exception as e:
    print(f"Error: {e}")
