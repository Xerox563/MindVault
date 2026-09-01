from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.utils.deps import get_current_user
from app.schemas.settings import ApiKeyUpdate, ApiKeyStatus
from app.services.user_settings import get_user_api_keys, set_user_api_key, delete_user_api_key
from app.config import settings as app_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

SUPPORTED_PROVIDERS = ["mistral", "gemini", "openrouter"]

@router.get("/api-keys", response_model=list[ApiKeyStatus])
def list_api_keys(current_user: User = Depends(get_current_user)):
    user_keys = get_user_api_keys(current_user)
    result = []
    for provider in SUPPORTED_PROVIDERS:
        has_user_key = provider in user_keys
        has_server_key = bool(getattr(app_settings, f"{provider.upper()}_API_KEY", ""))
        result.append(ApiKeyStatus(
            provider=provider,
            configured=has_user_key or has_server_key,
            source="user" if has_user_key else ("server" if has_server_key else "none"),
        ))
    return result

@router.put("/api-keys")
def save_api_key(payload: ApiKeyUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(400, f"Unsupported provider: {payload.provider}")
    if not payload.api_key.strip():
        raise HTTPException(400, "API key cannot be empty")
    set_user_api_key(db, current_user, payload.provider, payload.api_key.strip())
    return {"message": f"API key saved for {payload.provider}"}

@router.delete("/api-keys/{provider}")
def remove_api_key(provider: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    delete_user_api_key(db, current_user, provider)
    return {"message": f"API key removed for {provider}"}
