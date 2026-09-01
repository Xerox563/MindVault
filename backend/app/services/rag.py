from sqlalchemy.orm import Session
from app.models.user import File, Chunk, User
from app.services.embeddings import get_embedding, get_chat_response, get_chat_response_stream
from app.services.hybrid_retrieval import hybrid_search
from app.services.user_settings import get_user_api_keys, base_provider
from app.services.workspace import get_active_workspace_id
from app.services.embedding_provider import resolve_embedding_provider
from app.config import settings

def _retrieve(db: Session, question: str, user: User):
    # find the top matching chunks and turn them into an LLM prompt + citation list
    provider_id = user.preferred_provider or settings.LLM_PROVIDER
    api_key = get_user_api_keys(user).get(base_provider(provider_id))
    workspace_id = get_active_workspace_id(db, user)

    embedding_provider_id, embedding_api_key = resolve_embedding_provider(db, user)
    if not embedding_provider_id:
        return provider_id, api_key, None, None

    query_embedding = get_embedding(question, provider_id=embedding_provider_id, api_key=embedding_api_key, db=db, user_id=user.id)
    if not query_embedding:
        return provider_id, api_key, None, None

    chunk_ids = hybrid_search(db, question, query_embedding, user.id, workspace_id)

    hits = []
    files_by_id = {}
    for chunk_id in chunk_ids:
        chunk_record = db.query(Chunk).filter(Chunk.id == int(chunk_id)).first()
        if not chunk_record:
            continue
        file = files_by_id.get(chunk_record.file_id)
        if file is None:
            file_query = db.query(File).filter(File.id == chunk_record.file_id)
            file_query = file_query.filter(File.workspace_id == workspace_id) if workspace_id else file_query.filter(File.user_id == user.id, File.workspace_id.is_(None))
            file = file_query.first()
            if file:
                files_by_id[chunk_record.file_id] = file
        if file:
            hits.append(chunk_record)

    # a matched fragment is often mid-sentence (e.g. one job entry cut off) - pull its
    # immediate neighbors in the same file so the model sees the whole entry, not a sliver
    context_chunks = {c.id: c for c in hits}
    for chunk_record in hits:
        for neighbor_index in (chunk_record.chunk_index - 1, chunk_record.chunk_index + 1):
            if neighbor_index < 0:
                continue
            neighbor = db.query(Chunk).filter(Chunk.file_id == chunk_record.file_id, Chunk.chunk_index == neighbor_index).first()
            if neighbor and neighbor.id not in context_chunks:
                context_chunks[neighbor.id] = neighbor

    ordered_context = sorted(context_chunks.values(), key=lambda c: (c.file_id, c.chunk_index))
    context = "\n\n".join(c.content for c in ordered_context)

    sources = [{
        "chunk_id": chunk_record.id,
        "file_id": files_by_id[chunk_record.file_id].id,
        "file_name": files_by_id[chunk_record.file_id].filename,
        "source_type": files_by_id[chunk_record.file_id].source_type or files_by_id[chunk_record.file_id].source or "local",
        "source": files_by_id[chunk_record.file_id].source or files_by_id[chunk_record.file_id].source_type or "local",
        "content": chunk_record.content[:200]
    } for chunk_record in hits]

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
