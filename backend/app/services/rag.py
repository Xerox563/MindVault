from sqlalchemy.orm import Session
from app.models.user import File, Chunk, User
from app.services.embeddings import get_embedding, get_chat_response
from app.services.vectordb import search_similar
from app.services.user_settings import get_user_api_keys, base_provider
from app.config import settings

def rag_query(db: Session, question: str, user: User) -> dict:
    provider_id = user.preferred_provider or settings.LLM_PROVIDER
    api_key = get_user_api_keys(user).get(base_provider(provider_id))

    query_embedding = get_embedding(question, provider_id=provider_id, api_key=api_key)
    if not query_embedding:
        return {"answer": "Embedding generation failed. Check your model configuration in Settings.", "sources": []}

    similar_chunks = search_similar(query_embedding, user_id=user.id, n_results=5)

    context = ""
    sources = []
    for chunk in similar_chunks:
        chunk_record = db.query(Chunk).filter(Chunk.id == int(chunk["id"])).first()
        if chunk_record:
            file = db.query(File).filter(File.id == chunk_record.file_id, File.user_id == user.id).first()
            if file:
                context += chunk_record.content + "\n\n"
                sources.append({
                    "chunk_id": chunk_record.id,
                    "file_name": file.filename,
                    "content": chunk_record.content[:200]
                })

    if not context:
        return {"answer": "No relevant documents found", "sources": []}

    answer = get_chat_response(question, context, provider_id=provider_id, api_key=api_key)

    return {"answer": answer, "sources": sources}
