import gspread
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from app.config import settings
from app.utils.logger import log_error, log_info

def get_sheets_service(credentials_dict: dict):
    creds = Credentials(
        token=credentials_dict.get("token"),
        refresh_token=credentials_dict.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET
    )
    if creds.expired:
        creds.refresh(Request())
    return gspread.authorize(creds)

def list_sheets(credentials_dict: dict) -> list[dict]:
    try:
        service = get_sheets_service(credentials_dict)
        spreadsheets = service.openall()
        return [{
            "id": s.id,
            "title": s.title,
            "url": s.url
        } for s in spreadsheets[:50]]
    except Exception as e:
        log_error(f"Failed to list sheets: {str(e)}")
        return []

def get_sheet_data(credentials_dict: dict, spreadsheet_id: str, sheet_name: str = None) -> list[list]:
    try:
        service = get_sheets_service(credentials_dict)
        spreadsheet = service.open_by_key(spreadsheet_id)
        
        if sheet_name:
            worksheet = spreadsheet.worksheet(sheet_name)
        else:
            worksheet = spreadsheet.sheet1
            
        return worksheet.get_all_values()
    except Exception as e:
        log_error(f"Failed to get sheet data: {str(e)}")
        return []

def get_sheet_columns(credentials_dict: dict, spreadsheet_id: str) -> list[str]:
    try:
        service = get_sheets_service(credentials_dict)
        spreadsheet = service.open_by_key(spreadsheet_id)
        return [ws.title for ws in spreadsheet.worksheets()]
    except Exception as e:
        log_error(f"Failed to get sheet columns: {str(e)}")
        return []

def extract_sheet_as_text(credentials_dict: dict, spreadsheet_id: str) -> str:
    try:
        service = get_sheets_service(credentials_dict)
        spreadsheet = service.open_by_key(spreadsheet_id)
        
        text_parts = []
        for worksheet in spreadsheet.worksheets():
            text_parts.append(f"Sheet: {worksheet.title}")
            rows = worksheet.get_all_values()
            for row in rows:
                row_text = " | ".join([cell for cell in row if cell.strip()])
                if row_text:
                    text_parts.append(row_text)
            text_parts.append("")
        
        return "\n".join(text_parts)
    except Exception as e:
        log_error(f"Failed to extract sheet as text: {str(e)}")
        return ""