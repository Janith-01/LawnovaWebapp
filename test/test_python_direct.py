import requests
import json

URL = "http://localhost:5009/generate-study-material"
TRANSCRIPT = "Prosecutor: We allege Section 380 robbery. Witness: I saw him with a knife stole 50000 rupees."

def test_python():
    print(f"Testing Python AI Backend at {URL}...")
    try:
        resp = requests.post(URL, json={"transcript": TRANSCRIPT, "topic": "Robbery Test"})
        print("Status Code:", resp.status_code)
        print("Response:", json.dumps(resp.json(), indent=2))
    except Exception as e:
        print("Error connecting to Python backend:", str(e))

if __name__ == "__main__":
    test_python()
