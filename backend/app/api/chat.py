import json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, ChatHistory, Citation, Chunk
from app.schemas.chat import AskRequest, AskResponse
from app.utils.deps import get_current_user
from app.services.rag import rag_query, rag_query_stream
from app.services.llm_service import llm_service
from app.services.user_settings import get_user_api_keys
from app.services.cache import get_cached_result, cache_result, get_cache_stats, clear_expired_cache
from app.services.space import get_active_space_id
from app.config import settings
from app.core.rate_limit import limiter

router = APIRouter(prefix="/api", tags=["chat"])

def _save_chat(db: Session, user: User, question: str, answer: str, sources: list):
    # store the Q&A pair and its citations so chat history and sources work later
    chat = ChatHistory(user_id=user.id, space_id=get_active_space_id(db, user), question=question, answer=answer)
    db.add(chat)
    db.commit()
    db.refresh(chat)

    for source in sources:
        chunk = db.query(Chunk).filter(Chunk.id == source["chunk_id"]).first()
        if chunk:
            db.add(Citation(
                chat_id=chat.id,
                chunk_id=chunk.id,
                file_id=chunk.file_id,
                source_type=source.get("source_type") or source.get("source") or "local"
            ))
    db.commit()

@router.post("/ask", response_model=AskResponse)
@limiter.limit("30/minute")  # Rate limit: 30 chat requests per minute
def ask_question(request: Request, request_data: AskRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cached_result = get_cached_result(db, request_data.question)

    if cached_result:
        result = {
            "answer": cached_result["answer"],
            "sources": cached_result["sources"],
            "from_cache": True,
            "cache_hits": cached_result["hit_count"]
        }
    else:
        result = rag_query(db, request_data.question, current_user)
        result["from_cache"] = False

        cache_result(db, request_data.question, result["answer"], result["sources"])

    _save_chat(db, current_user, request_data.question, result["answer"], result["sources"])

    return AskResponse(
        answer=result["answer"],
        sources=result["sources"],
        from_cache=result.get("from_cache", False),
        cache_hits=result.get("cache_hits", 0)
    )

@router.post("/ask/stream")
@limiter.limit("30/minute")
def ask_question_stream(request: Request, request_data: AskRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cached_result = get_cached_result(db, request_data.question)

    def sse(event: dict) -> str:
        return f"data: {json.dumps(event)}\n\n"

    def event_stream():
        if cached_result:
            yield sse({"type": "sources", "sources": cached_result["sources"]})
            yield sse({"type": "chunk", "text": cached_result["answer"]})
            yield sse({"type": "done", "from_cache": True, "cache_hits": cached_result["hit_count"]})
            return

        sources = []
        answer = ""
        for event in rag_query_stream(db, request_data.question, current_user):
            if event["type"] == "sources":
                sources = event["sources"]
                yield sse(event)
            elif event["type"] == "chunk":
                yield sse(event)
            elif event["type"] == "error":
                yield sse(event)
                return
            elif event["type"] == "done":
                answer = event["answer"]

        cache_result(db, request_data.question, answer, sources)
        _save_chat(db, current_user, request_data.question, answer, sources)
        yield sse({"type": "done", "from_cache": False, "cache_hits": 0})

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.get("/chat/history")
def get_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    space_id = get_active_space_id(db, current_user)
    chats = db.query(ChatHistory).filter(
        ChatHistory.user_id == current_user.id,
        ChatHistory.space_id == space_id if space_id else ChatHistory.space_id.is_(None)
    ).order_by(ChatHistory.created_at.desc()).all()
    return [{"id": c.id, "question": c.question, "answer": c.answer, "created_at": c.created_at} for c in chats]

@router.get("/llm/status")
def get_llm_status(current_user: User = Depends(get_current_user)):
    user_keys = get_user_api_keys(current_user)
    providers = llm_service.get_available_providers(user_api_keys=user_keys)
    current_provider = current_user.preferred_provider or settings.LLM_PROVIDER

    return {
        "current_provider": current_provider,
        "hybrid_mode": llm_service.hybrid_mode,
        "providers": providers,
        "default_provider": settings.LLM_PROVIDER
    }

@router.post("/llm/set-provider/{provider_id}")
def set_llm_provider(provider_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.preferred_provider = provider_id
    db.commit()
    return {"message": f"Provider set to: {provider_id}"}

@router.get("/llm/embedding-status")
def get_embedding_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.services.embedding_provider import resolve_embedding_provider
    user_keys = get_user_api_keys(current_user)
    models = llm_service.get_available_embedding_models(user_api_keys=user_keys)

    if not current_user.preferred_embedding_provider:
        resolve_embedding_provider(db, current_user)

    return {
        "current_provider": current_user.preferred_embedding_provider,
        "providers": models,
    }

@router.post("/llm/set-embedding-provider/{provider_id}")
def set_embedding_provider(provider_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # existing files keep their old vectors, this only affects new uploads and questions
    current_user.preferred_embedding_provider = provider_id
    db.commit()
    return {"message": f"Embedding model set to: {provider_id}"}

@router.post("/llm/ollama/pull/{model_name}")
def pull_ollama_model(model_name: str, current_user: User = Depends(get_current_user)):
    success = llm_service.pull_ollama_model(model_name)
    if success:
        return {"message": f"Successfully pulled model: {model_name}"}
    else:
        raise HTTPException(500, f"Failed to pull model: {model_name}")

@router.get("/cache/stats")
def get_cache_statistics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_cache_stats(db)

@router.post("/cache/clear-expired")
def clear_cache_expired(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = clear_expired_cache(db)
    return {"message": f"Cleared {count} expired cache entries"}

@router.post("/cache/clear-all")
def clear_cache_all(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # TODO add admin check before this ships
    from app.models.user import QueryCache
    count = db.query(QueryCache).count()
    db.query(QueryCache).delete()
    db.commit()
    return {"message": f"Cleared {count} cache entries"}
