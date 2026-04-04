import requests
import json

url = "http://127.0.0.1:5002/api/audit-transcript"
data = {
    "history": [
        {"role": "user", "content": "hellow your horner \\"},
        {"role": "user", "content": "The defendant was at the scene of the crime according to the witness testimony."}
    ]
}

try:
    response = requests.post(url, json=data)
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
