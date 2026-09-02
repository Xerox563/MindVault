import os
import chromadb
from chromadb.config import Settings
from app.config import settings

if settings.CHROMA_API_KEY:
    chroma_client = chromadb.CloudClient(
        api_key=settings.CHROMA_API_KEY,
        tenant=settings.CHROMA_TENANT,
        database=settings.CHROMA_DATABASE,
    )
else:
    CHROMA_DIR = settings.CHROMA_PERSIST_DIR
    os.makedirs(CHROMA_DIR, exist_ok=True)
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False))

# each embedding dimension gets its own chroma collection since chroma needs one fixed size per collection
_LEGACY_DIM = 1024
_LEGACY_NAME = "mindvault"
_collections: dict[int, "chromadb.Collection"] = {}

def _collection_for_dim(dim: int):
    if dim not in _collections:
        name = _LEGACY_NAME if dim == _LEGACY_DIM else f"mindvault_{dim}"
        _collections[dim] = chroma_client.get_or_create_collection(name=name)
    return _collections[dim]

def add_embedding(chunk_id: int, text: str, embedding: list[float], metadata: dict):
    collection = _collection_for_dim(len(embedding))
    collection.add(
        ids=[str(chunk_id)],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata]
    )

def search_similar(query_embedding: list[float], user_id: int, n_results: int = 5, workspace_id: int | None = None, space_id: int | None = None) -> list[dict]:
    collection = _collection_for_dim(len(query_embedding))
    if space_id:
        where = {"space_id": space_id}
    elif workspace_id:
        where = {"$and": [{"workspace_id": workspace_id}, {"space_id": 0}]}
    else:
        where = {"$and": [{"user_id": user_id}, {"workspace_id": 0}]}
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
    # dimension is not tracked per chunk, so check every collection that exists
    for collection in chroma_client.list_collections():
        try:
            collection.delete(ids=[str(chunk_id)])
        except Exception:
            pass
