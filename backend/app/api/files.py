import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, File as FileModel
from app.schemas.file import FileResponse
from app.utils.deps import get_current_user
from app.config import settings
from app.services.extractor import extract_text
from app.services.processor import process_file
from app.services.user_settings import get_user_api_keys, base_provider
from app.core.rate_limit import limiter

router = APIRouter(prefix="/api", tags=["files"])

def validate_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in settings.ALLOWED_EXTENSIONS

@router.post("/upload", response_model=FileResponse)
@limiter.limit("10/minute")  # Rate limit: 10 uploads per minute (expensive operation)
async def upload_file(
    request: Request,
    uploaded_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not validate_file(uploaded_file.filename or ""):
        raise HTTPException(400, "Invalid file type")
    
    content = await uploaded_file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(400, "File too large")
    
    user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    
    file_path = os.path.join(user_dir, uploaded_file.filename or "uploaded_file")
    with open(file_path, "wb") as f:
        f.write(content)
    
    file_ext = os.path.splitext(uploaded_file.filename or "")[1].lower()
    file_record = FileModel(
        user_id=current_user.id,
        filename=uploaded_file.filename or "uploaded_file",
        file_path=file_path,
        file_type=file_ext,
        file_size=len(content)
    )
    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    
    text = extract_text(file_path, file_ext)
    if text:
        file_record.extracted_text = text
        db.commit()
        provider_id = current_user.preferred_provider or settings.LLM_PROVIDER
        api_key = get_user_api_keys(current_user).get(base_provider(provider_id))
        process_file(db, file_record, provider_id=provider_id, api_key=api_key)

    return file_record

@router.get("/files", response_model=list[FileResponse])
def list_files(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(FileModel).filter(FileModel.user_id == current_user.id).all()

@router.delete("/files/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    file = db.query(FileModel).filter(FileModel.id == file_id, FileModel.user_id == current_user.id).first()
    if not file:
        raise HTTPException(404, "File not found")
    if os.path.exists(file.file_path):
        os.remove(file.file_path)
    db.delete(file)
    db.commit()
    return {"message": "File deleted"}

@router.get("/files/{file_id}/content")
def get_file_content(file_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    file = db.query(FileModel).filter(FileModel.id == file_id, FileModel.user_id == current_user.id).first()
    if not file:
        raise HTTPException(404, "File not found")
    return {"content": file.extracted_text or "", "file_type": file.file_type, "filename": file.filename}
