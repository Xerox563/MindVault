import os
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.utils.deps import get_current_user
from app.config import settings
from app.services.sheets import list_sheets, get_sheet_data, extract_sheet_as_text
from app.services.slack import get_slack_channels, get_channel_history_text, search_slack_messages
from app.services.notion import get_notion_databases, get_notion_pages, extract_notion_as_text
from app.services.extractor import extract_text
from app.services.processor import process_file
from app.services.user_settings import get_user_api_keys, base_provider
from app.services.sync import record_sync, get_synced_files_for_user
from app.models.user import File as FileModel
from app.core.rate_limit import limiter
from app.utils.logger import log_error

router = APIRouter(prefix="/api", tags=["integrations"])

@router.get("/integrations")
def list_integrations(current_user: User = Depends(get_current_user)):
    return [
        {"id": "google_drive", "name": "Google Drive", "description": "Import files from Google Drive", "icon": "drive", "connected": bool(current_user.google_refresh_token)},
        {"id": "google_sheets", "name": "Google Sheets", "description": "Import data from Google Sheets", "icon": "sheets", "connected": bool(current_user.google_refresh_token)},
        {"id": "slack", "name": "Slack", "description": "Search messages from Slack channels", "icon": "slack", "connected": bool(current_user.slack_bot_token)},
        {"id": "notion", "name": "Notion", "description": "Import pages from Notion workspaces", "icon": "notion", "connected": bool(current_user.notion_api_key)},
    ]

@router.get("/sheets")
def get_spreadsheets(current_user: User = Depends(get_current_user)):
    if not current_user.google_refresh_token:
        raise HTTPException(400, "Google Sheets not connected")
    creds = {"token": current_user.google_token, "refresh_token": current_user.google_refresh_token}
    return list_sheets(creds)

@router.get("/sheets/{spreadsheet_id}/data")
def get_sheet_by_id(spreadsheet_id: str, sheet_name: str = None, current_user: User = Depends(get_current_user)):
    if not current_user.google_refresh_token:
        raise HTTPException(400, "Google Sheets not connected")
    creds = {"token": current_user.google_token, "refresh_token": current_user.google_refresh_token}
    return {"data": get_sheet_data(creds, spreadsheet_id, sheet_name)}

@router.post("/sheets/{spreadsheet_id}/sync")
@limiter.limit("10/minute")
def sync_spreadsheet(request: Request, spreadsheet_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.google_refresh_token:
        raise HTTPException(400, "Google Sheets not connected")
    try:
        creds = {"token": current_user.google_token, "refresh_token": current_user.google_refresh_token}
        text = extract_sheet_as_text(creds, spreadsheet_id)
        if not text:
            raise HTTPException(400, "Failed to extract sheet data")
        
        filename = f"sheet_{spreadsheet_id}.txt"
        user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
        os.makedirs(user_dir, exist_ok=True)
        file_path = os.path.join(user_dir, filename)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text)
        
        file_record = FileModel(
            user_id=current_user.id,
            filename=filename,
            file_path=file_path,
            file_type=".txt",
            file_size=len(text),
            extracted_text=text,
            source="sheets",
            source_type="sheets",
            external_id=spreadsheet_id
        )
        db.add(file_record)
        db.commit()
        db.refresh(file_record)
        
        record_sync(
            db=db,
            user_id=current_user.id,
            external_id=spreadsheet_id,
            source="google_sheets",
            filename=filename,
            mime_type="text/plain",
            size=len(text),
            local_file_id=file_record.id,
            status="active"
        )
        
        provider_id = current_user.preferred_provider or settings.LLM_PROVIDER
        api_key = get_user_api_keys(current_user).get(base_provider(provider_id))
        process_file(db, file_record, provider_id=provider_id, api_key=api_key)
        
        return {"message": "Sheet synced successfully", "file_id": file_record.id}
    except Exception as e:
        log_error(f"Failed to sync sheet: {e}")
        raise HTTPException(500, f"Failed to sync sheet: {str(e)}")

@router.get("/slack/channels")
def get_channels(current_user: User = Depends(get_current_user)):
    if not current_user.slack_bot_token:
        raise HTTPException(400, "Slack not connected")
    return get_slack_channels(current_user.slack_bot_token)

@router.get("/slack/channels/{channel_id}/messages")
def get_messages(channel_id: str, limit: int = 100, current_user: User = Depends(get_current_user)):
    if not current_user.slack_bot_token:
        raise HTTPException(400, "Slack not connected")
    text = get_channel_history_text(current_user.slack_bot_token, channel_id, limit)
    return {"messages": text}

@router.post("/slack/channels/{channel_id}/sync")
@limiter.limit("10/minute")
def sync_slack_channel(request: Request, channel_id: str, channel_name: str = None, limit: int = 200, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.slack_bot_token:
        raise HTTPException(400, "Slack not connected")
    try:
        text = get_channel_history_text(current_user.slack_bot_token, channel_id, limit)
        if not text:
            raise HTTPException(400, "Failed to fetch channel messages")
        
        filename = f"slack_{channel_id}.txt"
        user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
        os.makedirs(user_dir, exist_ok=True)
        file_path = os.path.join(user_dir, filename)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text)
        
        file_record = FileModel(
            user_id=current_user.id,
            filename=channel_name or filename,
            file_path=file_path,
            file_type=".txt",
            file_size=len(text),
            extracted_text=text,
            source="slack",
            source_type="slack",
            external_id=channel_id
        )
        db.add(file_record)
        db.commit()
        db.refresh(file_record)
        
        record_sync(
            db=db,
            user_id=current_user.id,
            external_id=channel_id,
            source="slack",
            filename=filename,
            mime_type="text/plain",
            size=len(text),
            local_file_id=file_record.id,
            status="active"
        )
        
        provider_id = current_user.preferred_provider or settings.LLM_PROVIDER
        api_key = get_user_api_keys(current_user).get(base_provider(provider_id))
        process_file(db, file_record, provider_id=provider_id, api_key=api_key)
        
        return {"message": "Slack channel synced successfully", "file_id": file_record.id}
    except Exception as e:
        log_error(f"Failed to sync Slack channel: {e}")
        raise HTTPException(500, f"Failed to sync channel: {str(e)}")

@router.get("/notion/databases")
def get_notion_dbs(current_user: User = Depends(get_current_user)):
    if not current_user.notion_api_key:
        raise HTTPException(400, "Notion not connected")
    return get_notion_databases(current_user.notion_api_key)

@router.get("/notion/pages")
def get_notion_page_list(database_id: str = None, current_user: User = Depends(get_current_user)):
    if not current_user.notion_api_key:
        raise HTTPException(400, "Notion not connected")
    return get_notion_pages(current_user.notion_api_key, database_id)

@router.post("/notion/pages/{page_id}/sync")
@limiter.limit("10/minute")
def sync_notion_page(request: Request, page_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.notion_api_key:
        raise HTTPException(400, "Notion not connected")
    try:
        text = extract_notion_as_text(current_user.notion_api_key, page_id=page_id)
        if not text:
            raise HTTPException(400, "Failed to extract page content")
        
        filename = f"notion_{page_id}.txt"
        user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
        os.makedirs(user_dir, exist_ok=True)
        file_path = os.path.join(user_dir, filename)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text)
        
        file_record = FileModel(
            user_id=current_user.id,
            filename=filename,
            file_path=file_path,
            file_type=".txt",
            file_size=len(text),
            extracted_text=text,
            source="notion",
            source_type="notion",
            external_id=page_id
        )
        db.add(file_record)
        db.commit()
        db.refresh(file_record)
        
        record_sync(
            db=db,
            user_id=current_user.id,
            external_id=page_id,
            source="notion",
            filename=filename,
            mime_type="text/plain",
            size=len(text),
            local_file_id=file_record.id,
            status="active"
        )
        
        provider_id = current_user.preferred_provider or settings.LLM_PROVIDER
        api_key = get_user_api_keys(current_user).get(base_provider(provider_id))
        process_file(db, file_record, provider_id=provider_id, api_key=api_key)
        
        return {"message": "Notion page synced successfully", "file_id": file_record.id}
    except Exception as e:
        log_error(f"Failed to sync Notion page: {e}")
        raise HTTPException(500, f"Failed to sync page: {str(e)}")

@router.post("/notion/databases/{database_id}/sync")
@limiter.limit("10/minute")
def sync_notion_database(request: Request, database_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.notion_api_key:
        raise HTTPException(400, "Notion not connected")
    try:
        text = extract_notion_as_text(current_user.notion_api_key, database_id=database_id)
        if not text:
            raise HTTPException(400, "Failed to extract database content")
        
        filename = f"notion_db_{database_id}.txt"
        user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
        os.makedirs(user_dir, exist_ok=True)
        file_path = os.path.join(user_dir, filename)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text)
        
        file_record = FileModel(
            user_id=current_user.id,
            filename=filename,
            file_path=file_path,
            file_type=".txt",
            file_size=len(text),
            extracted_text=text,
            source="notion",
            source_type="notion",
            external_id=database_id
        )
        db.add(file_record)
        db.commit()
        db.refresh(file_record)
        
        record_sync(
            db=db,
            user_id=current_user.id,
            external_id=database_id,
            source="notion",
            filename=filename,
            mime_type="text/plain",
            size=len(text),
            local_file_id=file_record.id,
            status="active"
        )
        
        provider_id = current_user.preferred_provider or settings.LLM_PROVIDER
        api_key = get_user_api_keys(current_user).get(base_provider(provider_id))
        process_file(db, file_record, provider_id=provider_id, api_key=api_key)
        
        return {"message": "Notion database synced successfully", "file_id": file_record.id}
    except Exception as e:
        log_error(f"Failed to sync Notion database: {e}")
        raise HTTPException(500, f"Failed to sync database: {str(e)}")

@router.get("/integrations/connect/slack")
def get_slack_install_url(current_user: User = Depends(get_current_user)):
    import json, base64
    state = base64.urlsafe_b64encode(json.dumps({"user_id": current_user.id}).encode()).decode()
    return {"install_url": f"https://slack.com/oauth/v2/authorize?client_id={settings.SLACK_CLIENT_ID}&scope=channels:read&redirect_uri={settings.SLACK_REDIRECT_URI}&state={state}"}

@router.get("/integrations/slack/callback")
def slack_callback(code: str, state: str = None, db: Session = Depends(get_db)):
    from slack_sdk.web_client import WebClient
    from app.models.user import User
    try:
        client = WebClient()
        response = client.oauth_v2_access(client_id=settings.SLACK_CLIENT_ID, client_secret=settings.SLACK_CLIENT_SECRET, code=code)
        token = response["access_token"]
        
        user_id = None
        if state:
            import json, base64
            try:
                state_data = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
                user_id = state_data.get('user_id')
            except: pass
        
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.slack_bot_token = token
                db.commit()
        
        return {"message": "Slack connected successfully"}
    except Exception as e:
        log_error(f"Slack OAuth failed: {e}")
        raise HTTPException(500, "Failed to connect Slack")

@router.get("/integrations/connect/notion")
def get_notion_auth_url(current_user: User = Depends(get_current_user)):
    import json, base64
    state = base64.urlsafe_b64encode(json.dumps({"user_id": current_user.id}).encode()).decode()
    return {"auth_url": f"https://api.notion.com/v1/oauth/authorize?client_id={settings.NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri={settings.NOTION_REDIRECT_URI}&state={state}"}

@router.get("/integrations/notion/callback")
def notion_callback(code: str, state: str = None, db: Session = Depends(get_db)):
    import requests
    from app.models.user import User
    try:
        response = requests.post("https://api.notion.com/v1/oauth/token", data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.NOTION_REDIRECT_URI,
            "client_id": settings.NOTION_CLIENT_ID,
            "client_secret": settings.NOTION_CLIENT_SECRET
        }, headers={"Content-Type": "application/x-www-form-urlencoded"})
        data = response.json()
        
        user_id = None
        if state:
            import json, base64
            try:
                state_data = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
                user_id = state_data.get('user_id')
            except: pass
        
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.notion_api_key = data.get("access_token")
                db.commit()
        
        return {"message": "Notion connected successfully"}
    except Exception as e:
        log_error(f"Notion OAuth failed: {e}")
        raise HTTPException(500, "Failed to connect Notion")