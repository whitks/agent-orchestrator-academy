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

def retrieve(domain: str, query: str, tenant_id: str = "apex_university", k: int = 5, threshold: float = 1.5) -> List[Dict[str, Any]]:
    """
    Retrieve top k chunks for a domain with strict multi-tenant isolation.
    Checks tenant_id in Chroma metadata. For apex_university, also matches legacy chunks without tenant_id.
    """
    client = get_chroma_client()
    try:
        collection = client.get_collection(name=domain)
    except Exception:
        return []
        
    # We query with where filter on tenant_id when searching, with fallback for backward compatibility
    query_kwargs = {
        "query_texts": [query],
        "n_results": k
    }
    
    # Try tenant-isolated query first
    try:
        results = collection.query(
            where={"tenant_id": tenant_id},
            **query_kwargs
        )
    except Exception:
        results = None

    # Fallback to general query ONLY for apex_university legacy chunks
    if (not results or not results.get("documents") or not results["documents"][0]) and tenant_id == "apex_university":
        results = collection.query(**query_kwargs)
        
    if not results or not results.get("documents") or not results["documents"][0]:
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
        
        # Guardrail: check tenant isolation on metadata
        chunk_tenant = meta.get("tenant_id")
        if chunk_tenant:
            if chunk_tenant != tenant_id:
                continue
        else:
            if tenant_id != "apex_university":
                continue

        chunks.append({
            "text": doc,
            "source_file": meta.get("source_file", "unknown"),
            "section": meta.get("section", "unknown"),
            "tenant_id": chunk_tenant or tenant_id,
            "score": dist
        })
        
    return chunks
