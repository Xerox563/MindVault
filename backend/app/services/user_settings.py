import json
from sqlalchemy.orm import Session
from app.models.user import User
from app.utils.crypto import encrypt_value, decrypt_value
from app.utils.logger import log_error

def get_user_api_keys(user: User) -> dict[str, str]:
    if not user.api_keys_encrypted:
        return {}
    try:
        encrypted = json.loads(user.api_keys_encrypted)
        keys = {}
        for provider, token in encrypted.items():
            try:
                keys[provider] = decrypt_value(token)
            except Exception as e:
                log_error(f"Failed to decrypt API key for provider {provider}: {e}")
        return keys
    except Exception as e:
        log_error(f"Failed to parse stored API keys: {e}")
        return {}

def set_user_api_key(db: Session, user: User, provider: str, api_key: str) -> None:
    encrypted = json.loads(user.api_keys_encrypted) if user.api_keys_encrypted else {}
    encrypted[provider] = encrypt_value(api_key)
    user.api_keys_encrypted = json.dumps(encrypted)
    db.commit()

def delete_user_api_key(db: Session, user: User, provider: str) -> None:
    if not user.api_keys_encrypted:
        return
    encrypted = json.loads(user.api_keys_encrypted)
    if provider in encrypted:
        del encrypted[provider]
        user.api_keys_encrypted = json.dumps(encrypted)
        db.commit()

PROVIDER_PREFIXES = ("ollama", "mistral", "gemini", "openrouter")

def base_provider(provider_id: str) -> str:
    # collapses a model id like gemini-gemini-1.5-flash down to just gemini
    for prefix in PROVIDER_PREFIXES:
        if provider_id == prefix or provider_id.startswith(prefix + "-"):
            return prefix
    return provider_id
