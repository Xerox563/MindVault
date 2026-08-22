from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, ChatHistory, Citation, File, Chunk
from app.schemas.chat import AskRequest, AskResponse
from app.utils.deps import get_current_user
from app.services.rag import rag_query
from app.services.llm_service import llm_service
from app.services.user_settings import get_user_api_keys
from app.config import settings

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/ask", response_model=AskResponse)
def ask_question(request: AskRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = rag_query(db, request.question, current_user)

    chat = ChatHistory(
        user_id=current_user.id,
        question=request.question,
        answer=result["answer"]
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)

    for source in result["sources"]:
        chunk = db.query(Chunk).filter(Chunk.id == source["chunk_id"]).first()
        if chunk:
            citation = Citation(
                chat_id=chat.id,
                chunk_id=chunk.id,
                file_id=chunk.file_id
            )
            db.add(citation)
    db.commit()

    return AskResponse(answer=result["answer"], sources=result["sources"])

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
