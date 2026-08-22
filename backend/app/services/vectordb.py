import chromadb
from chromadb.config import Settings

chroma_client = chromadb.Client(Settings())

collection = chroma_client.get_or_create_collection(name="mindvault")

def add_embedding(chunk_id: int, text: str, embedding: list[float], metadata: dict):
    collection.add(
        ids=[str(chunk_id)],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata]
    )

def search_similar(query_embedding: list[float], n_results: int = 5) -> list[dict]:
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results
    )
    return [{"id": r[0], "text": r[1], "metadata": r[2]} for r in zip(results["ids"][0], results["documents"][0], results["metadatas"][0])]

def delete_embedding(chunk_id: int):
    collection.delete(ids=[str(chunk_id)])
