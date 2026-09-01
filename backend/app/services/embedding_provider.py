from sqlalchemy.orm import Session
from app.models.user import User
from app.services.user_settings import get_user_api_keys, base_provider
from app.services.llm_service import llm_service

def resolve_embedding_provider(db: Session, user: User) -> tuple[str | None, str | None]:
    """Returns (provider_id, api_key) to use for embeddings.

    Never hardcoded: the first time a user needs an embedding model, this picks the
    first one available from a live provider model list and remembers that choice on
    the user so later calls (including per-chunk calls during file processing) don't
    re-hit the provider's list-models API every time."""
    user_api_keys = get_user_api_keys(user)

    if user.preferred_embedding_provider:
        provider_id = user.preferred_embedding_provider
        return provider_id, user_api_keys.get(base_provider(provider_id))

    models = llm_service.get_available_embedding_models(user_api_keys)
    if not models:
        return None, None

    # Prefer an embedding model from the same provider family as the user's chosen
    # chat model (e.g. chat on Gemini -> try Gemini embeddings first) before falling
    # back to whatever else is available.
    chat_family = base_provider(user.preferred_provider) if user.preferred_provider else None
    chosen = next((m for m in models if base_provider(m["id"]) == chat_family), models[0])

    provider_id = chosen["id"]
    user.preferred_embedding_provider = provider_id
    db.commit()
    return provider_id, user_api_keys.get(base_provider(provider_id))
