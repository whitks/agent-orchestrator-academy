import os
from pathlib import Path
import chromadb
from typing import List, Dict, Any

DB_PATH = Path(os.getenv("VECTOR_DB_PATH", "../data/vector_db")).resolve()
_client = None

def get_chroma_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(DB_PATH))
    return _client

def retrieve(domain: str, query: str, k: int = 5, threshold: float = 1.5) -> List[Dict[str, Any]]:
    """
    Retrieve top k chunks for a domain.
    threshold: Chroma returns L2 distance by default. Lower score is better.
    If the top score > threshold, return empty list.
    """
    client = get_chroma_client()
    try:
        collection = client.get_collection(name=domain)
    except Exception:
        return []
        
    results = collection.query(
        query_texts=[query],
        n_results=k
    )
    
    if not results.get("documents") or not results["documents"][0]:
        return []
        
    chunks = []
    distances = results["distances"][0]
    
    if distances[0] > threshold:
        return []
        
    for i in range(len(results["documents"][0])):
        dist = distances[i]
        if dist > threshold:
            continue
            
        doc = results["documents"][0][i]
        meta = results["metadatas"][0][i]
        chunks.append({
            "text": doc,
            "source_file": meta.get("source_file", "unknown"),
            "section": meta.get("section", "unknown"),
            "score": dist
        })
        
    return chunks
