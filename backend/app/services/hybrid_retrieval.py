import re
import math
from sqlalchemy.orm import Session
from rank_bm25 import BM25Okapi
from app.models.user import File, Chunk
from app.services.vectordb import search_similar

VECTOR_CANDIDATES = 20
BM25_CANDIDATES = 20
FINAL_TOP_K = 6
BROAD_FINAL_TOP_K = 14
RRF_K = 60
RELEVANCE_DISTANCE_THRESHOLD = 0.62

# queries like "list my experience" or "summarize this" want broad recall, not one exact snippet
_BROAD_INTENT_TERMS = {
    "all", "every", "everything", "each", "list", "summarize", "summary",
    "overview", "experience", "experiences", "history", "timeline", "compare",
    "skills", "education", "projects", "details",
}

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# without this, common words like what and the make every document look like a match
_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "what", "which", "who", "whom", "this", "that", "these", "those",
    "and", "or", "but", "if", "of", "at", "by", "for", "with", "about",
    "against", "between", "into", "through", "during", "to", "from", "in",
    "on", "off", "up", "down", "out", "over", "under", "again", "then",
    "so", "than", "too", "very", "can", "will", "just", "should", "now",
    "do", "does", "did", "have", "has", "had", "having", "it", "its",
    "i", "me", "my", "you", "your", "he", "him", "his", "she", "her",
    "we", "us", "our", "they", "them", "their", "not", "no",
}

def _tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS and len(t) > 1]

def _scoped_chunks(db: Session, user_id: int, workspace_id: int | None) -> list[Chunk]:
    query = db.query(Chunk).join(File, File.id == Chunk.file_id)
    if workspace_id:
        query = query.filter(File.workspace_id == workspace_id)
    else:
        query = query.filter(File.user_id == user_id, File.workspace_id.is_(None))
    return query.all()

def hybrid_search(db: Session, question: str, query_embedding: list[float], user_id: int, workspace_id: int | None = None) -> list[str]:
    # rebuilds the keyword index on every call, fine at this scale but not for a huge corpus
    vector_hits = search_similar(query_embedding, user_id=user_id, n_results=VECTOR_CANDIDATES, workspace_id=workspace_id)
    vector_ranks = {hit["id"]: rank for rank, hit in enumerate(vector_hits)}
    vector_distance = {hit["id"]: hit["distance"] for hit in vector_hits}

    chunks = _scoped_chunks(db, user_id, workspace_id)
    bm25_ranks: dict[str, int] = {}
    if chunks:
        corpus = [_tokenize(c.content) for c in chunks]
        query_tokens = _tokenize(question)
        query_token_set = set(query_tokens)
        if query_tokens and any(corpus):
            # one shared common word alone should not count as a real match
            min_overlap = max(1, math.ceil(len(query_token_set) * 0.34))
            bm25 = BM25Okapi(corpus)
            scores = bm25.get_scores(query_tokens)
            candidates = [
                (chunk, score) for chunk, score, tokens in zip(chunks, scores, corpus)
                if score > 0 and len(query_token_set & set(tokens)) >= min_overlap
            ]
            ranked = sorted(candidates, key=lambda pair: pair[1], reverse=True)
            bm25_ranks = {str(chunk.id): rank for rank, (chunk, score) in enumerate(ranked[:BM25_CANDIDATES])}

    # a vector hit only counts if it also clears the old distance bar, so unrelated questions get no sources
    candidate_ids = {cid for cid, dist in vector_distance.items() if dist <= RELEVANCE_DISTANCE_THRESHOLD}
    candidate_ids |= set(bm25_ranks.keys())

    fused = []
    for chunk_id in candidate_ids:
        score = 0.0
        if chunk_id in vector_ranks:
            score += 1 / (RRF_K + vector_ranks[chunk_id] + 1)
        if chunk_id in bm25_ranks:
            score += 1 / (RRF_K + bm25_ranks[chunk_id] + 1)
        fused.append((chunk_id, score))

    fused.sort(key=lambda pair: pair[1], reverse=True)
    query_tokens_for_intent = _tokenize(question)
    top_k = BROAD_FINAL_TOP_K if set(query_tokens_for_intent) & _BROAD_INTENT_TERMS else FINAL_TOP_K
    return [chunk_id for chunk_id, _ in fused[:top_k]]
