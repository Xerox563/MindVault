from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ChatBase(BaseModel):
    question: str

class ChatCreate(ChatBase):
    pass

class CitationBase(BaseModel):
    chunk_id: int
    file_id: int
    confidence_score: Optional[float] = None

class CitationResponse(CitationBase):
    id: int
    chat_id: int

    class Config:
        from_attributes = True

class ChatResponse(ChatBase):
    id: int
    user_id: int
    answer: str
    created_at: datetime

    class Config:
        from_attributes = True

class AskRequest(BaseModel):
    question: str

class AskResponse(BaseModel):
    answer: str
    sources: list[dict]
