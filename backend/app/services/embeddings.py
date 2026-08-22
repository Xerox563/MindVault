import os
from app.config import settings
from app.utils.logger import log_error, log_info
from app.utils.retry import retry
from app.services.llm_service import llm_service

@retry(max_attempts=3, delay=1.0)
def get_embedding(text: str) -> list[float]:
    """Generate embedding using configured LLM provider"""
    embedding = llm_service.generate_embedding(text)
    if embedding:
        log_info(f"Generated embedding for text length {len(text)}")
    return embedding

@retry(max_attempts=3, delay=1.0)
def get_chat_response(prompt: str, context: str = "") -> str:
    """Generate chat response using configured LLM provider"""
    response = llm_service.generate_chat_response(prompt, context)
    log_info(f"Generated chat response for question length {len(prompt)}")
    return response
