from sqlalchemy.orm import Session
from app.models.user import User
from app.services.user_settings import get_user_api_keys, base_provider
from app.services.llm_service import llm_service

def resolve_embedding_provider(db: Session, user: User) -> tuple[str | None, str | None]:
    # first pick is saved on the user so later chunk calls do not re-fetch the model list
    user_api_keys = get_user_api_keys(user)

    if user.preferred_embedding_provider:
        provider_id = user.preferred_embedding_provider
        return provider_id, user_api_keys.get(base_provider(provider_id))

    models = llm_service.get_available_embedding_models(user_api_keys)
    if not models:
        return None, None

    # prefer an embedding model from the same provider as the chat model, if available
    chat_family = base_provider(user.preferred_provider) if user.preferred_provider else None
    chosen = next((m for m in models if base_provider(m["id"]) == chat_family), models[0])

    provider_id = chosen["id"]
    user.preferred_embedding_provider = provider_id
    db.commit()
    return provider_id, user_api_keys.get(base_provider(provider_id))
