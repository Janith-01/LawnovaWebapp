import os
import json
import re
from pinecone import Pinecone
from google import genai
from dotenv import load_dotenv

load_dotenv()

# Initialize Pinecone Connection
pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
index_name = os.environ.get("PINECONE_INDEX_NAME", "lawnova-acts")
index = pc.Index(index_name)

# Initialize Gemini Client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def extract_legal_terms(transcript):
    """
    1. Keyword Extraction (The NLP Bridge)
    Analyzes the provided transcript and identifies the top 3-5 legal concepts.
    Returns a clean list of strings to be used for the vector search.
    """
    try:
        prompt = f"""
        Analyze the following legal transcript and extract the top 3-5 key legal concepts, 
        principles, or specific statutes mentioned (e.g., 'Rei-vindicatio', 'Prescriptive Title', 'Section 35 Civil Procedure Code').
        Return ONLY a JSON array of plain strings without any markdown blocks or explanation.
        
        Transcript: 
        {transcript}
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        # Clean any markdown artifacts (like ```json ... ```)
        content = response.text.replace('```json', '').replace('```', '').strip()
        
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            return json.loads(match.group())
            
        # Fallback if standard JSON mapping fails
        lines = [line.strip('- *') for line in content.split('\n') if line.strip()]
        return lines[:5]
        
    except Exception as e:
        print(f"[Retrieval] Error extracting legal terms: {e}")
        return ["Sri Lankan law"]

def search_legal_documents(query_text, top_k=3, score_threshold=0.35):
    """
    2. Vector Search (Pinecone Integration)
    Queries the Pinecone index for the most relevant matches.
    Incorporates NLP pre-processing for better matches and threshold-based error handling.
    """
    try:
        # Pre-process: if the incoming query is long (like a trial transcript block), extract keywords.
        if len(query_text.split()) > 15:
            keywords = extract_legal_terms(query_text)
            search_query = ", ".join(keywords)
            print(f"[Retrieval] Extracted NLP Keywords for query: {search_query}")
        else:
            search_query = query_text
            
        # Generate the compatible embedding. We use gemini-embedding-001 at length 768 
        # (which matches the Pinecone index dimensions created)
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=search_query,
            config={
                "task_type": "RETRIEVAL_QUERY",
                "output_dimensionality": 768
            }
        )
        query_embedding = result.embeddings[0].values

        # Retrieval: Query Pinecone index
        results = index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True
        )

        matches = []
        for match in results.get('matches', []):
            # 4. Error Handling: Score Threshold check
            if match.get('score', 0) < score_threshold:
                continue
                
            # 3. Technical Specifications: Metadata filtering
            meta = match.get('metadata', {})
            act_name = meta.get('source', 'Unknown Act')
            section = meta.get('page_segment', 'N/A')
            raw_text = meta.get('text', '')
            
            # Response Formatting: Combine the retrieved segments into a 'Context Block'
            context_block = f"[Source: {act_name} | Segment/Section: {section}]\n{raw_text}"
            matches.append(context_block)
            
        if not matches:
             # 4. Error Handling: Default 'general legal principles' set to prevent hallucinations
             print(f"[Retrieval] No vectors breached minimum score {score_threshold}. Triggering fallback.")
             return "General legal principles: Maintain standard Sri Lankan judicial procedures, emphasizing the balance of probabilities in civil matters and beyond reasonable doubt in criminal matters. Rely on broad foundational legal knowledge without specific statute hallucinations."
            
        return "\n\n---\n\n".join(matches)

    except Exception as e:
        print(f"[Retrieval] Fatal search error: {e}")
        return "General legal principles: Maintain standard Sri Lankan judicial procedures, emphasizing the balance of probabilities in civil matters and beyond reasonable doubt in criminal matters. Rely on broad foundational legal knowledge without specific statute hallucinations."
