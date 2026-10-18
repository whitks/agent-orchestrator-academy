import os
import argparse
from pathlib import Path
from typing import Optional, List, Dict, Any
import chromadb

DATA_DIR = Path(os.getenv("DATA_DIR", "../data")).resolve()
DB_PATH = Path(os.getenv("VECTOR_DB_PATH", "../data/vector_db")).resolve()

def get_chroma_client():
    return chromadb.PersistentClient(path=str(DB_PATH))

def chunk_text(text: str, filename: str, chunk_size: int = 2000, overlap: int = 320):
    lines = text.split('\n')
    chunks = []
    current_section = "General"
    current_text = ""
    
    for line in lines:
        if line.startswith('#'):
            if current_text.strip():
                chunks.append({
                    "text": current_text.strip(),
                    "metadata": {"source_file": filename, "section": current_section}
                })
                # reset without overlap because it's a new section
                current_text = ""
            current_section = line.lstrip('# ').strip()
        else:
            current_text += line + "\n"
            if len(current_text) >= chunk_size:
                chunks.append({
                    "text": current_text.strip(),
                    "metadata": {"source_file": filename, "section": current_section}
                })
                current_text = current_text[-overlap:]
                
    if current_text.strip():
        chunks.append({
            "text": current_text.strip(),
            "metadata": {"source_file": filename, "section": current_section}
        })
        
    return chunks

def ingest_domain(domain: str, tenant_id: str = "apex_university", source_dir: Optional[Path] = None):
    domain_dir = source_dir if source_dir else DATA_DIR / domain
    if not domain_dir.exists():
        return
        
    client = get_chroma_client()
    collection = client.get_or_create_collection(name=domain)
    
    files = list(domain_dir.glob("*.md")) + list(domain_dir.glob("*.txt"))
    for file_path in files:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        chunks = chunk_text(content, file_path.name)
        if not chunks:
            continue
            
        ids = [f"{tenant_id}_{domain}_{file_path.name}_{i}" for i in range(len(chunks))]
        documents = [c["text"] for c in chunks]
        metadatas = [{**c["metadata"], "tenant_id": tenant_id, "domain": domain} for c in chunks]
        
        collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"[{tenant_id}] Ingested {len(documents)} chunks from {file_path.name} into '{domain}' collection.")

def ingest_tenant(tenant_id: str):
    tenant_dir = DATA_DIR / "tenants" / tenant_id
    domains = ["academics", "placement", "events", "services"]
    if tenant_dir.exists():
        for d in domains:
            ingest_domain(d, tenant_id=tenant_id, source_dir=tenant_dir / d)
    else:
        # Fallback to root data dirs for apex
        if tenant_id == "apex_university":
            for d in domains:
                ingest_domain(d, tenant_id=tenant_id, source_dir=DATA_DIR / d)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Ingest all domains and tenants")
    parser.add_argument("--tenant", type=str, help="Ingest specific tenant ID")
    args = parser.parse_args()
    
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    if args.tenant:
        ingest_tenant(args.tenant)
    elif args.all:
        tenants = ["apex_university", "stanford_global", "cambridge_tech"]
        for t in tenants:
            ingest_tenant(t)
    else:
        print("Please specify --all or --tenant <tenant_id>")

if __name__ == "__main__":
    main()
