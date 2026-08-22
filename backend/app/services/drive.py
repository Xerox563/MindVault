from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.config import settings
from app.utils.logger import log_error, log_info

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

def get_drive_service(credentials_dict: dict):
    creds = Credentials(
        token=credentials_dict.get("token"),
        refresh_token=credentials_dict.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET
    )
    return build("drive", "v3", credentials=creds)

def list_drive_files(credentials_dict: dict) -> list[dict]:
    try:
        service = get_drive_service(credentials_dict)
        results = service.files().list(
            pageSize=50,
            fields="files(id, name, mimeType, size)"
        ).execute()
        files = results.get("files", [])
        log_info(f"Listed {len(files)} Drive files")
        return files
    except Exception as e:
        log_error(f"Failed to list Drive files: {str(e)}")
        return []

def download_drive_file(credentials_dict: dict, file_id: str) -> tuple[bytes, str] | None:
    try:
        service = get_drive_service(credentials_dict)
        file_meta = service.files().get(fileId=file_id).execute()
        file_name = file_meta.get("name", "unknown")
        content = service.files().get_media(fileId=file_id).execute()
        log_info(f"Downloaded Drive file: {file_name}")
        return content, file_name
    except Exception as e:
        log_error(f"Failed to download Drive file {file_id}: {str(e)}")
        return None
