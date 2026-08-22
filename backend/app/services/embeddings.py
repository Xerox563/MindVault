import os
from typing import Optional
from app.config import settings
from app.utils.logger import log_error, log_info
from app.utils.retry import retry
from app.services.llm_service import llm_service

@retry(max_attempts=3, delay=1.0)
def get_embedding(text: str, provider_id: Optional[str] = None, api_key: Optional[str] = None) -> list[float]:
    """Generate embedding using the given (or default) LLM provider"""
    embedding = llm_service.generate_embedding(text, provider_id=provider_id or settings.LLM_PROVIDER, api_key=api_key)
    if embedding:
        log_info(f"Generated embedding for text length {len(text)}")
    return embedding

@retry(max_attempts=3, delay=1.0)
def get_chat_response(prompt: str, context: str = "", provider_id: Optional[str] = None, api_key: Optional[str] = None) -> str:
    """Generate chat response using the given (or default) LLM provider"""
    response = llm_service.generate_chat_response(prompt, context, provider_id=provider_id or settings.LLM_PROVIDER, api_key=api_key)
    log_info(f"Generated chat response for question length {len(prompt)}")
    return response
