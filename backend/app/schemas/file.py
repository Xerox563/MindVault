from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class FileBase(BaseModel):
    filename: str
    file_type: str
    file_size: int

class FileCreate(FileBase):
    file_path: str

class FileResponse(FileBase):
    id: int
    user_id: int
    file_path: str
    uploaded_at: datetime
    source: Optional[str] = "local"
    source_type: Optional[str] = "local"
    processing_status: Optional[str] = "complete"
    processing_progress: Optional[int] = 0
    processing_total: Optional[int] = 0
    processing_error: Optional[str] = None

    class Config:
        from_attributes = True

class ChunkBase(BaseModel):
    content: str
    chunk_index: int
    page_number: Optional[int] = None

class ChunkResponse(ChunkBase):
    id: int
    file_id: int
    created_at: datetime

    class Config:
        from_attributes = True
