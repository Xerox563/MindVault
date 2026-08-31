from sqlalchemy.orm import Session
from app.models.user import File, Chunk, User
from app.services.embeddings import get_embedding, get_chat_response, get_chat_response_stream
from app.services.vectordb import search_similar
from app.services.user_settings import get_user_api_keys, base_provider
from app.config import settings

RELEVANCE_DISTANCE_THRESHOLD = 0.62

def _retrieve(db: Session, question: str, user: User):
    # find the top matching chunks and turn them into an LLM prompt + citation list
    provider_id = user.preferred_provider or settings.LLM_PROVIDER
    api_key = get_user_api_keys(user).get(base_provider(provider_id))

    query_embedding = get_embedding(question, provider_id=provider_id, api_key=api_key, db=db, user_id=user.id)
    if not query_embedding:
        return provider_id, api_key, None, None

    similar_chunks = search_similar(query_embedding, user_id=user.id, n_results=5)
    relevant_chunks = [c for c in similar_chunks if c["distance"] <= RELEVANCE_DISTANCE_THRESHOLD]

    context = ""
    sources = []
    for chunk in relevant_chunks:
        chunk_record = db.query(Chunk).filter(Chunk.id == int(chunk["id"])).first()
        if chunk_record:
            file = db.query(File).filter(File.id == chunk_record.file_id, File.user_id == user.id).first()
            if file:
                context += chunk_record.content + "\n\n"
                sources.append({
                    "chunk_id": chunk_record.id,
                    "file_id": file.id,
                    "file_name": file.filename,
                    "source_type": file.source_type or file.source or "local",
                    "source": file.source or file.source_type or "local",
                    "content": chunk_record.content[:200]
                })

    return provider_id, api_key, context, sources

def rag_query(db: Session, question: str, user: User) -> dict:
    provider_id, api_key, context, sources = _retrieve(db, question, user)
    if context is None:
        return {"answer": "Embedding generation failed. Check your model configuration in Settings.", "sources": []}

    answer = get_chat_response(question, context, provider_id=provider_id, api_key=api_key, db=db, user_id=user.id)

    return {"answer": answer, "sources": sources}

def rag_query_stream(db: Session, question: str, user: User):
    # same retrieval as rag_query, but yields the answer as it's generated
    provider_id, api_key, context, sources = _retrieve(db, question, user)
    if context is None:
        yield {"type": "error", "message": "Embedding generation failed. Check your model configuration in Settings."}
        return

    yield {"type": "sources", "sources": sources}

    stream = get_chat_response_stream(question, context, provider_id=provider_id, api_key=api_key, db=db, user_id=user.id)
    answer = ""
    try:
        while True:
            delta = next(stream)
            answer += delta
            yield {"type": "chunk", "text": delta}
    except StopIteration as stop:
        if stop.value:
            answer = stop.value

    yield {"type": "done", "answer": answer, "sources": sources}
