import os
import chromadb
from chromadb.config import Settings
from app.config import settings

CHROMA_DIR = os.path.join(os.path.dirname(settings.UPLOAD_DIR.rstrip("/")) or "data", "chroma")
os.makedirs(CHROMA_DIR, exist_ok=True)

chroma_client = chromadb.PersistentClient(path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False))

collection = chroma_client.get_or_create_collection(name="mindvault")

def add_embedding(chunk_id: int, text: str, embedding: list[float], metadata: dict):
    collection.add(
        ids=[str(chunk_id)],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata]
    )

def search_similar(query_embedding: list[float], user_id: int, n_results: int = 5) -> list[dict]:
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where={"user_id": user_id}
    )
    if not results["ids"] or not results["ids"][0]:
        return []
    return [{"id": r[0], "text": r[1], "metadata": r[2]} for r in zip(results["ids"][0], results["documents"][0], results["metadatas"][0])]

def delete_embedding(chunk_id: int):
    collection.delete(ids=[str(chunk_id)])
