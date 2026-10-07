import os
import argparse
from pathlib import Path
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

def ingest_domain(domain: str):
    domain_dir = DATA_DIR / domain
    if not domain_dir.exists():
        print(f"Directory {domain_dir} does not exist.")
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
            
        ids = [f"{file_path.name}_{i}" for i in range(len(chunks))]
        documents = [c["text"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        
        collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"Ingested {len(documents)} chunks from {file_path.name} into '{domain}' collection.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Ingest all domains")
    args = parser.parse_args()
    
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    if args.all:
        domains = ["academics", "placement", "events", "services"]
        for d in domains:
            ingest_domain(d)
    else:
        print("Please specify --all")

if __name__ == "__main__":
    main()
