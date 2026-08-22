import os
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from app.database import get_db
from app.models.user import User
from app.utils.deps import get_current_user
from app.config import settings
from app.services.drive import list_drive_files, download_drive_file
from app.services.extractor import extract_text
from app.services.processor import process_file
from app.models.user import File as FileModel

router = APIRouter(prefix="/api", tags=["google"])

def get_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            }
        },
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
        redirect_uri=settings.GOOGLE_REDIRECT_URI
    )

@router.get("/auth/google/connect")
def connect_google(current_user: User = Depends(get_current_user)):
    flow = get_flow()
    auth_url, _ = flow.authorization_url(prompt="consent", access_type="offline")
    return {"auth_url": auth_url}

@router.get("/auth/google/callback")
def google_callback(request: Request, code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    flow = get_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    current_user.google_token = creds.token
    current_user.google_refresh_token = creds.refresh_token
    db.commit()
    return RedirectResponse(url="/dashboard")

@router.get("/drive/files")
def drive_files(current_user: User = Depends(get_current_user)):
    if not current_user.google_refresh_token:
        raise HTTPException(400, "Google Drive not connected")
    files = list_drive_files({
        "token": current_user.google_token,
        "refresh_token": current_user.google_refresh_token
    })
    return files

@router.post("/sync/drive/{file_id}")
def sync_drive_file(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.google_refresh_token:
        raise HTTPException(400, "Google Drive not connected")
    
    result = download_drive_file({
        "token": current_user.google_token,
        "refresh_token": current_user.google_refresh_token
    }, file_id)
    
    if not result:
        raise HTTPException(400, "Failed to download file")
    
    content, filename = result
    
    user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    
    file_path = os.path.join(user_dir, filename)
    with open(file_path, "wb") as f:
        f.write(content)
    
    file_ext = os.path.splitext(filename)[1].lower()
    file_record = FileModel(
        user_id=current_user.id,
        filename=filename,
        file_path=file_path,
        file_type=file_ext,
        file_size=len(content),
        source="drive"
    )
    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    
    text = extract_text(file_path, file_ext)
    if text:
        file_record.extracted_text = text
        db.commit()
        process_file(db, file_record)
    
    return {"message": "File synced", "file_id": file_record.id}
