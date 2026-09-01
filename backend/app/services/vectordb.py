import os
import chromadb
from chromadb.config import Settings
from app.config import settings

CHROMA_DIR = settings.CHROMA_PERSIST_DIR
os.makedirs(CHROMA_DIR, exist_ok=True)

chroma_client = chromadb.PersistentClient(path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False))

# Chroma collections are fixed to one embedding dimensionality, but different
# embedding providers produce different dimensions (Mistral 1024, Gemini 3072, ...),
# so each dimension gets its own collection. 1024 keeps the original "mindvault" name
# so existing embeddings (all Mistral, from before multi-provider support) still work
# without a data migration.
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

def search_similar(query_embedding: list[float], user_id: int, n_results: int = 5, workspace_id: int | None = None) -> list[dict]:
    """Returns nearest chunks with their L2 distance so callers can drop irrelevant
    matches (Chroma's default n_results are always returned even when nothing
    is actually relevant, e.g. small talk against a document collection).

    Scoped to a workspace's shared files when workspace_id is given, otherwise to
    the user's own personal (non-workspace) files. Only searches the collection
    matching the query embedding's own dimension - chunks embedded with a
    different-dimension model (e.g. after switching embedding providers) won't
    show up until re-embedded with the current one."""
    collection = _collection_for_dim(len(query_embedding))
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
    # dimension isn't tracked per chunk, so check every collection that exists on
    # disk rather than only ones this process has already touched
    for collection in chroma_client.list_collections():
        try:
            collection.delete(ids=[str(chunk_id)])
        except Exception:
            pass
