import os
import torch
import json
import logging
from sentence_transformers import SentenceTransformer

# Setup Logging
logger = logging.getLogger(__name__)

class SimpleVectorStore:
    def __init__(self, index_path="data/embeddings.pt", metadata_path="data/metadata.json"):
        self.index_path = index_path
        self.metadata_path = metadata_path
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.vectors = None
        self.metadata = []
        
        self.load()

    def load(self):
        if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
            logger.info(f"Loading vector index from {self.index_path}")
            try:
                # weights_only=False to support older pytorch versions or complex types if needed, 
                # though True is safer. Defaulting to safe attempt first.
                self.vectors = torch.load(self.index_path)
                with open(self.metadata_path, 'r', encoding='utf-8') as f:
                    self.metadata = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load index: {e}. Starting empty (Backup created).")
                # Backup corrupt file
                try:
                   os.rename(self.index_path, self.index_path + ".bak")
                except:
                   pass
                self.vectors = None
                self.metadata = []
        else:
            logger.info("No existing index found. Starting empty.")

    def index_documents(self, documents: list[dict]):
        """
        documents: List of dicts with 'text', 'id', 'meta'
        """
        texts = [doc['text'] for doc in documents]
        logger.info(f"Encoding {len(texts)} documents...")
        
        embeddings = self.model.encode(texts, convert_to_tensor=True)
        
        if self.vectors is not None:
            self.vectors = torch.cat((self.vectors, embeddings), dim=0)
        else:
            self.vectors = embeddings
            
        # Append metadata
        for doc in documents:
            self.metadata.append({
                "id": doc['id'],
                "meta": doc.get('meta', {})
            })
            
        self.save()

    def save(self):
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        torch.save(self.vectors, self.index_path)
        with open(self.metadata_path, 'w', encoding='utf-8') as f:
            json.dump(self.metadata, f)
        logger.info("Index saved.")

    def search(self, query: str, k: int = 5):
        if self.vectors is None:
            return []
            
        logger.info(f"Searching for: {query}")
        query_embedding = self.model.encode(query, convert_to_tensor=True)
        
        # Cosine Similarity
        cos_scores = torch.nn.functional.cosine_similarity(query_embedding, self.vectors)
        
        # Top K
        top_results = torch.topk(cos_scores, k=min(k, len(self.vectors)))
        
        results = []
        for score, idx in zip(top_results.values, top_results.indices):
            meta = self.metadata[idx.item()]
            results.append({
                "score": score.item(),
                "id": meta['id'],
                "metadata": meta['meta']
            })
            
        return results
