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
        # Prompt optimized for identifying Sri Lankan legal concepts.
        prompt = f"""
        Analyze the following legal transcript block and extract the 3-5 most critical legal terms, 
        statutes, or core principles (e.g., 'Rei-vindicatio', 'Section 35 Civil Procedure Code', 'Evidence Act').
        Return ONLY a JSON array of plain strings.
        
        Transcript: 
        {transcript}
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt,
        )
        
        # Clean response and parse JSON array.
        content = response.text.replace('```json', '').replace('```', '').strip()
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            return json.loads(match.group())
            
        return ["Sri Lankan general law"]
        
    except Exception as e:
        print(f"[Intelligence Layer] NLP Extraction skip: {e}")
        return ["Legal procedure Sri Lanka"]

def search_legal_documents(query_text, top_k=3):
    """
    2. Vector Search (Pinecone Integration)
    Queries the index for the top matches.
    
    NOTE: While the user requested 'llama-text-embed-v2', testing confirmed 
    the current index is 768 dimensions (llama-text-embed-v2 is 1024). 
    We use 'gemini-embedding-001' at 768 to maintain compatibility and high match scores.
    """
    try:
        # 1. Keyword Extraction: Bridge between raw transcript and vector database.
        keywords = extract_legal_terms(query_text)
        search_query = ", ".join(keywords)
        print(f"[Intelligence Layer] Extracted Keywords: {search_query}")

        # 2. Embedding Generation (768 Dimensions)
        # Using gemini-embedding-001 at length 768 ensures perfect alignment with the existing 'lawnova-acts' index.
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=search_query,
            config={
                "task_type": "RETRIEVAL_QUERY",
                "output_dimensionality": 768
            }
        )
        query_embedding = result.embeddings[0].values

        # 2. Retrieval: Requesting matches with metadata for act_name and raw_text.
        results = index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True
        )

        matches = []
        score_threshold = 0.55 # 4. Robust threshold to prevent LLM hallucination on noise.
        
        for match in results.get('matches', []):
            if match.get('score', 0) < score_threshold:
                continue
                
            # 3. Metadata Filtering: Mapping fields correctly.
            meta = match.get('metadata', {})
            act_name = meta.get('act_name') or meta.get('source') or 'General Law'
            section = meta.get('section_number') or meta.get('page_segment') or 'N/A'
            raw_text = meta.get('raw_text') or meta.get('text') or ''
            
            # 3. Context Block Formatting: Ensures easy parsing by the Synthesis Layer.
            context_block = f"Snippet From: {act_name} (Section {section})\nContent: {raw_text}"
            matches.append(context_block)
            
        if not matches:
             # 4. Error Handling: Default 'general legal principles' set to prevent hallucinations.
             print(f"[Intelligence Layer] Score threshold alert (low relevance). returning fallback context.")
             return "General legal principles: Maintain standard Sri Lankan judicial procedures, emphasizing the balance of probabilities in civil matters and beyond reasonable doubt in criminal matters. Rely on broad foundational legal knowledge without specific statute hallucinations."
            
        return "\n\n---\n\n".join(matches)

    except Exception as e:
        print(f"[Intelligence Layer] Fatal search error: {e}")
        return "General Sri Lankan legal procedure applies. Rely on standard judicial principles."
