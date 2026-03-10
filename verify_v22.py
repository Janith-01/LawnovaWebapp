import requests
import json

url = "http://localhost:5002/api/audit-transcript"
payload = {
    "history": [
        {"role": "user", "content": "your horner"},
        {"role": "user", "content": "*OBJECTION! I object to this line of reasoning!*"},
        {"role": "user", "content": "May it please the Court, Your Honor, Counsel, we are here today to address a calculated violation of a home's sanctity. This is the case of State v. Rajapaksa, a matter involving the theft of an antique gold necklace valued at LKR 1.5 million from the residence of Mrs. Anusha Perera. While the defense may point to the absence of a \"smoking gun,\" the Prosecution will present a tapestry of circumstantial evidence so tightly woven that it leaves no room for reasonable doubt. Under Sections 367 and 368 of the Penal Code, we will prove that the accused, Mr. Nimal Rajapaksa, dishonestly took moveable property out of the possession of Mrs. Perera without her consent."}
    ]
}

print("--- Testing Audit Engine v2.2 ---")
try:
    response = requests.post(url, json=payload, timeout=30)
    data = response.json()
    
    for i, res in enumerate(data.get('results', [])):
        print(f"\n{i+1}. Text: {res['argument'][:50]}...")
        print(f"   Score: {res['score']*100:.1f}% | Status: {res['status']} | Label: {res['label']}")
        print(f"   Reason: {res['reason']}")
        
except Exception as e:
    print(f"Error: {e}")
    print("MIGHT NEED RESTART: Try stopping the Audit terminal and running 'python app.py' in python_backend.")
