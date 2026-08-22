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
    """Legacy Google OAuth connection - kept for backward compatibility"""
    flow = get_flow()
    auth_url, _ = flow.authorization_url(prompt="consent", access_type="offline")
    return {"auth_url": auth_url}

@router.get("/auth/google/callback")
def google_callback(request: Request, code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Legacy Google OAuth callback - kept for backward compatibility"""
    flow = get_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    current_user.google_token = creds.token
    current_user.google_refresh_token = creds.refresh_token
    db.commit()
    return RedirectResponse(url="/dashboard")

@router.get("/drive/files")
def drive_files(current_user: User = Depends(get_current_user)):
    """List Google Drive files using stored OAuth tokens"""
    from app.services.drive import get_drive_service
    
    # Check if user has connected Google Drive
    if not current_user.google_refresh_token:
        raise HTTPException(400, "Google Drive not connected. Please connect your Google Drive using the Connect button.")
    
    # Get Google Drive service using stored tokens
    drive_service = get_drive_service({
        "token": current_user.google_token,
        "refresh_token": current_user.google_refresh_token
    })
    
    try:
        # List files from Google Drive
        results = drive_service.files().list(
            pageSize=50,
            fields="files(id, name, mimeType, size)"
        ).execute()
        files = results.get('files', [])
        return files
    except Exception as e:
        print(f"Error listing Drive files: {e}")
        raise HTTPException(500, f"Failed to list Google Drive files: {str(e)}")

@router.post("/sync/drive/{file_id}")
def sync_drive_file(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Sync a file from Google Drive using stored OAuth tokens"""
    from app.services.drive import get_drive_service
    
    # Check if user has connected Google Drive
    if not current_user.google_refresh_token:
        raise HTTPException(400, "Google Drive not connected. Please connect your Google Drive first.")
    
    # Get Google Drive service using stored tokens
    drive_service = get_drive_service({
        "token": current_user.google_token,
        "refresh_token": current_user.google_refresh_token
    })
    
    try:
        # Get file metadata
        file_meta = drive_service.files().get(fileId=file_id).execute()
        file_name = file_meta.get("name", "unknown")
        
        # Download file content
        content = drive_service.files().get_media(fileId=file_id).execute()
        
        if not content:
            raise HTTPException(400, "Failed to download file")
        
        # Save file locally
        user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
        os.makedirs(user_dir, exist_ok=True)
        
        file_path = os.path.join(user_dir, file_name)
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Create file record
        file_ext = os.path.splitext(file_name)[1].lower()
        file_record = FileModel(
            user_id=current_user.id,
            filename=file_name,
            file_path=file_path,
            file_type=file_ext,
            file_size=len(content),
            source="drive"
        )
        db.add(file_record)
        db.commit()
        db.refresh(file_record)
        
        # Extract text and process
        text = extract_text(file_path, file_ext)
        if text:
            file_record.extracted_text = text
            db.commit()
            process_file(db, file_record)
        
        return {"message": "File synced", "file_id": file_record.id}
    except Exception as e:
        print(f"Error syncing Drive file: {e}")
        raise HTTPException(500, f"Failed to sync file: {str(e)}")
