import sys
from app.rag.retriever import retrieve

def test():
    queries = {
        "academics": "What is the minimum attendance required?",
        "placement": "What is the CGPA cutoff for Tier 1 companies?",
        "events": "When is the cultural fest?",
        "services": "What is the late fee for library books?",
        "services": "Tell me about quantum physics" # Test threshold
    }
    
    for domain, query in queries.items():
        print(f"\n--- Testing Domain: {domain} ---")
        print(f"Query: {query}")
        results = retrieve(domain, query, k=2)
        if not results:
            print("Status: insufficient_evidence (Below threshold or no data)")
        for i, res in enumerate(results):
            print(f"[{i+1}] Source: {res['source_file']} ({res['section']}) | Score: {res['score']:.4f}")
            print(f"Text: {res['text']}\n")

if __name__ == "__main__":
    test()
