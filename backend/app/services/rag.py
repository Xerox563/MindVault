from sqlalchemy.orm import Session
from app.models.user import File, Chunk
from app.services.embeddings import get_embedding, get_chat_response
from app.services.vectordb import search_similar

def rag_query(db: Session, question: str, user_id: int) -> dict:
    query_embedding = get_embedding(question)
    if not query_embedding:
        return {"answer": "Embedding generation failed", "sources": []}
    
    similar_chunks = search_similar(query_embedding, n_results=5)
    
    context = ""
    sources = []
    for chunk in similar_chunks:
        chunk_record = db.query(Chunk).filter(Chunk.id == int(chunk["id"])).first()
        if chunk_record:
            file = db.query(File).filter(File.id == chunk_record.file_id).first()
            if file and file.user_id == user_id:
                context += chunk_record.content + "\n\n"
                sources.append({
                    "chunk_id": chunk_record.id,
                    "file_name": file.filename,
                    "content": chunk_record.content[:200]
                })
    
    if not context:
        return {"answer": "No relevant documents found", "sources": []}
    
    answer = get_chat_response(question, context)
    
    return {"answer": answer, "sources": sources}
