import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, File as FileModel
from app.schemas.file import FileResponse
from app.utils.deps import get_current_user
from app.config import settings
from app.services.extractor import extract_text
from app.services.workspace import get_active_workspace_id, require_role
from app.services.space import get_active_space_id, require_space_role
from app.services.processor import process_file
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

    workspace_id = get_active_workspace_id(db, current_user)
    if workspace_id:
        try:
            require_role(db, workspace_id, current_user, "editor")
        except PermissionError:
            raise HTTPException(403, "Viewers can't upload files to this workspace")

    space_id = get_active_space_id(db, current_user)
    if space_id:
        try:
            require_space_role(db, space_id, current_user, "editor")
        except PermissionError:
            raise HTTPException(403, "Viewers can't upload files to this space")

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
        workspace_id=workspace_id,
        space_id=space_id,
        filename=uploaded_file.filename or "uploaded_file",
        file_path=file_path,
        file_type=file_ext,
        file_size=len(content),
        processing_status="pending",
    )
    db.add(file_record)
    db.commit()
    db.refresh(file_record)

    text = extract_text(file_path, file_ext)
    if text:
        file_record.extracted_text = text
        file_record.processing_status = "processing"
        db.commit()
        try:
            process_file(db, file_record)
            file_record.processing_status = "complete"
            db.commit()
        except Exception as e:
            db.rollback()
            file_record.processing_status = "error"
            file_record.processing_error = str(e)[:500]
            db.commit()
    else:
        file_record.processing_status = "complete"  # nothing to index (e.g. empty file)
        db.commit()

    return file_record

def _scoped_file_query(db: Session, current_user: User):
    workspace_id = get_active_workspace_id(db, current_user)
    space_id = get_active_space_id(db, current_user)
    query = db.query(FileModel)
    if space_id:
        return query.filter(FileModel.space_id == space_id)
    if workspace_id:
        return query.filter(FileModel.workspace_id == workspace_id, FileModel.space_id.is_(None))
    return query.filter(FileModel.user_id == current_user.id, FileModel.workspace_id.is_(None))

@router.get("/files", response_model=list[FileResponse])
def list_files(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _scoped_file_query(db, current_user).all()

@router.delete("/files/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    file = _scoped_file_query(db, current_user).filter(FileModel.id == file_id).first()
    if not file:
        raise HTTPException(404, "File not found")
    if file.space_id:
        try:
            require_space_role(db, file.space_id, current_user, "editor")
        except PermissionError:
            raise HTTPException(403, "Viewers can't delete files from this space")
    elif file.workspace_id:
        try:
            require_role(db, file.workspace_id, current_user, "editor")
        except PermissionError:
            raise HTTPException(403, "Viewers can't delete files from this workspace")
    if os.path.exists(file.file_path):
        os.remove(file.file_path)
    db.delete(file)
    db.commit()
    return {"message": "File deleted"}

@router.get("/files/{file_id}/content")
def get_file_content(file_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    file = _scoped_file_query(db, current_user).filter(FileModel.id == file_id).first()
    if not file:
        raise HTTPException(404, "File not found")
    return {"content": file.extracted_text or "", "file_type": file.file_type, "filename": file.filename}
