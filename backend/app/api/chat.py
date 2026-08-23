from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, ChatHistory, Citation, File, Chunk
from app.schemas.chat import AskRequest, AskResponse
from app.utils.deps import get_current_user
from app.services.rag import rag_query
from app.services.llm_service import llm_service
from app.services.user_settings import get_user_api_keys
from app.services.cache import get_cached_result, cache_result, get_cache_stats, clear_expired_cache
from app.config import settings
from app.core.rate_limit import limiter

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/ask", response_model=AskResponse)
@limiter.limit("30/minute")  # Rate limit: 30 chat requests per minute
def ask_question(request: Request, request_data: AskRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Process a question and return an answer.
    
    Uses query result caching to reduce LLM costs:
    - Checks cache first for identical/similar questions
    - Returns cached result if found (saves LLM API call)
    - Caches new results for future identical questions
    """
    # Check cache first
    cached_result = get_cached_result(db, request_data.question)
    
    if cached_result:
        # Return cached result
        result = {
            "answer": cached_result["answer"],
            "sources": cached_result["sources"],
            "from_cache": True,
            "cache_hits": cached_result["hit_count"]
        }
    else:
        # No cache hit - call LLM
        result = rag_query(db, request_data.question, current_user)
        result["from_cache"] = False
        
        # Cache the result for future use
        cache_result(db, request_data.question, result["answer"], result["sources"])

    # Save to chat history
    chat = ChatHistory(
        user_id=current_user.id,
        question=request_data.question,
        answer=result["answer"]
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)

    # Save citations
    for source in result["sources"]:
        chunk = db.query(Chunk).filter(Chunk.id == source["chunk_id"]).first()
        if chunk:
            citation = Citation(
                chat_id=chat.id,
                chunk_id=chunk.id,
                file_id=chunk.file_id,
                source_type=source.get("source_type") or source.get("source") or "local"
            )
            db.add(citation)
    db.commit()

    return AskResponse(
        answer=result["answer"], 
        sources=result["sources"],
        from_cache=result.get("from_cache", False),
        cache_hits=result.get("cache_hits", 0)
    )

@router.get("/chat/history")
def get_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    chats = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).order_by(ChatHistory.created_at.desc()).all()
    return [{"id": c.id, "question": c.question, "answer": c.answer, "created_at": c.created_at} for c in chats]

@router.get("/llm/status")
def get_llm_status(current_user: User = Depends(get_current_user)):
    """Get all available LLM providers/models for this user (server-configured + their own saved API keys)."""
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
    """Set the active LLM provider for this user (persisted per-user, not global)."""
    current_user.preferred_provider = provider_id
    db.commit()
    return {"message": f"Provider set to: {provider_id}"}

@router.post("/llm/ollama/pull/{model_name}")
def pull_ollama_model(model_name: str, current_user: User = Depends(get_current_user)):
    """Pull an Ollama model"""
    success = llm_service.pull_ollama_model(model_name)
    if success:
        return {"message": f"Successfully pulled model: {model_name}"}
    else:
        raise HTTPException(500, f"Failed to pull model: {model_name}")

@router.get("/cache/stats")
def get_cache_statistics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get query cache statistics"""
    return get_cache_stats(db)

@router.post("/cache/clear-expired")
def clear_cache_expired(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Clear all expired cache entries"""
    count = clear_expired_cache(db)
    return {"message": f"Cleared {count} expired cache entries"}

@router.post("/cache/clear-all")
def clear_cache_all(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Clear all cache entries (admin only)"""
    # In production, add admin check here
    from app.models.user import QueryCache
    count = db.query(QueryCache).count()
    db.query(QueryCache).delete()
    db.commit()
    return {"message": f"Cleared {count} cache entries"}
