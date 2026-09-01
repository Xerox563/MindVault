import os
import chromadb
from chromadb.config import Settings
from app.config import settings

CHROMA_DIR = settings.CHROMA_PERSIST_DIR
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

def search_similar(query_embedding: list[float], user_id: int, n_results: int = 5, workspace_id: int | None = None) -> list[dict]:
    """Returns nearest chunks with their L2 distance so callers can drop irrelevant
    matches (Chroma's default n_results are always returned even when nothing
    is actually relevant, e.g. small talk against a document collection).

    Scoped to a workspace's shared files when workspace_id is given, otherwise to
    the user's own personal (non-workspace) files."""
    where = {"workspace_id": workspace_id} if workspace_id else {"$and": [{"user_id": user_id}, {"workspace_id": 0}]}
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where=where,
        include=["documents", "metadatas", "distances"]
    )
    if not results["ids"] or not results["ids"][0]:
        return []
    return [
        {"id": r[0], "text": r[1], "metadata": r[2], "distance": r[3]}
        for r in zip(results["ids"][0], results["documents"][0], results["metadatas"][0], results["distances"][0])
    ]

def delete_embedding(chunk_id: int):
    collection.delete(ids=[str(chunk_id)])
