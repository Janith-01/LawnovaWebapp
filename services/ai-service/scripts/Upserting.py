import json
import time
from google import genai
from pinecone import Pinecone
from tqdm import tqdm

# --- CONFIGURATION ---
PINECONE_API_KEY = "pcsk_6cUmnh_MBGqM16C1sR7KNqGHn8ia5EY8YXTcydxsWMgqKtgoEzEgiT7GDtXsL83XKhuCPK"
GEMINI_API_KEY = "AIzaSyCv12PdLMmh4SG4X82dXHYgTt60OKZ3oOg"
INDEX_NAME = "lawnova-acts" # Ensure this matches your dashboard exactly
DATA_PATH = '../cleaned_chunks.json'

client = genai.Client(api_key=GEMINI_API_KEY)

# Initialize New Pinecone Client
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(INDEX_NAME)

def upsert_data():
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        chunks = json.load(f)

    print(f"--- Starting Upsert of {len(chunks)} chunks ---")
    
    batch_size = 50 # Smaller batch size for stability
    for i in tqdm(range(0, len(chunks), batch_size)):
        batch = chunks[i:i + batch_size]
        upsert_records = []

        # 1. Prepare texts for batch embedding
        texts = [item['text'] for item in batch]
        
        try:
            # 2. Generate Embeddings using new SDK
            # task_type="RETRIEVAL_DOCUMENT" is best for RAG knowledge bases
            res = client.models.embed_content(
                model="gemini-embedding-001",
                contents=texts,
                config={
                    "task_type": "RETRIEVAL_DOCUMENT",
                    "output_dimensionality": 768
                }
            )
            
            # 3. Format for Pinecone
            for idx, item in enumerate(batch):
                upsert_records.append({
                    "id": item['id'],
                    "values": res.embeddings[idx].values,
                    "metadata": {
                        "text": item['text'],
                        "source": item['metadata']['source']
                    }
                })

            # 4. Push to Pinecone
            if upsert_records:
                index.upsert(vectors=upsert_records)
                
        except Exception as e:
            print(f"\nError in batch starting at {i}: {e}")

    print("\n--- Knowledge Base successfully live on Pinecone! ---")

if __name__ == "__main__":
    upsert_data()