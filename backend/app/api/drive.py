import os
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from app.database import get_db
from app.models.user import User
from app.utils.deps import get_current_user
from app.config import settings
from app.services.drive import list_drive_files, download_drive_file
from app.services.extractor import extract_text
from app.services.processor import process_file
from app.services.user_settings import get_user_api_keys, base_provider
from app.models.user import File as FileModel

router = APIRouter(prefix="/api", tags=["google"])

def get_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
        redirect_uri=settings.GOOGLE_REDIRECT_URI
    )

@router.get("/auth/google/connect")
def connect_google(current_user: User = Depends(get_current_user)):
    """Return a Google OAuth URL for the frontend to open in a popup.

    Auth is handled the normal way (Authorization header via get_current_user);
    the user id travels through the OAuth `state` param since the popup's
    redirect back to /callback carries no auth header of its own.
    """
    import json
    import base64
    state = base64.urlsafe_b64encode(json.dumps({"user_id": current_user.id}).encode()).decode()

    flow = get_flow()
    auth_url, _ = flow.authorization_url(
        prompt="consent",
        access_type="offline",
        state=state
    )
    return {"auth_url": auth_url}

@router.get("/auth/google/callback")
def google_callback(request: Request, code: str, state: str = None, db: Session = Depends(get_db)):
    """Google OAuth callback - handles popup flow with state parameter"""
    flow = get_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    
    # Get user from state parameter
    if state:
        import json
        import base64
        try:
            state_data = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
            user_id = state_data.get('user_id')
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.google_token = creds.token
                user.google_refresh_token = creds.refresh_token
                db.commit()
        except Exception as e:
            print(f"Error decoding state: {e}")
    
    # Return a page that closes the popup
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Google Drive Connected</title>
        <script>
            window.opener.postMessage('google-drive-connected', '*');
            window.close();
        </script>
    </head>
    <body>
        <h1>Google Drive Connected!</h1>
        <p>You can close this window.</p>
    </body>
    </html>
    """
    return Response(content=html_content, media_type="text/html")

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
            provider_id = current_user.preferred_provider or settings.LLM_PROVIDER
            api_key = get_user_api_keys(current_user).get(base_provider(provider_id))
            process_file(db, file_record, provider_id=provider_id, api_key=api_key)

        return {"message": "File synced", "file_id": file_record.id}
    except Exception as e:
        print(f"Error syncing Drive file: {e}")
        raise HTTPException(500, f"Failed to sync file: {str(e)}")

@router.get("/integrations")
def list_integrations(current_user: User = Depends(get_current_user)):
    """List available third-party integrations and whether the current user has connected them."""
    return [
        {
            "id": "google_drive",
            "name": "Google Drive",
            "description": "Import files from your Google Drive into your knowledge base",
            "icon": "drive",
            "connected": bool(current_user.google_refresh_token),
        }
    ]
