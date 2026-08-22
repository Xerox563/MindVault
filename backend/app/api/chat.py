from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, ChatHistory, Citation, File, Chunk
from app.schemas.chat import AskRequest, AskResponse
from app.utils.deps import get_current_user
from app.services.rag import rag_query

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/ask", response_model=AskResponse)
def ask_question(request: AskRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = rag_query(db, request.question, current_user.id)
    
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
