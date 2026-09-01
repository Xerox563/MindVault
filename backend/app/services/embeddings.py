import os
from typing import Optional, Tuple
from app.config import settings
from app.utils.logger import log_error, log_info
from app.utils.retry import retry
from app.services.llm_service import llm_service

def estimate_tokens(text: str) -> int:
    return len(text) // 4

@retry(max_attempts=3, delay=1.0)
def get_embedding(text: str, provider_id: Optional[str] = None, api_key: Optional[str] = None, db=None, user_id: int = None) -> list[float]:
    embedding, usage = llm_service.generate_embedding(text, provider_id=provider_id or settings.LLM_PROVIDER, api_key=api_key)
    if embedding:
        log_info(f"Generated embedding for text length {len(text)}")

        if db and user_id:
            try:
                from app.services.cost import track_cost
                input_tokens = usage.get("prompt_tokens") if usage else None
                if input_tokens is None:
                    input_tokens = estimate_tokens(text)
                track_cost(
                    db=db,
                    user_id=user_id,
                    provider=provider_id or settings.LLM_PROVIDER,
                    operation="embedding",
                    input_tokens=input_tokens,
                    output_tokens=0
                )
            except Exception as e:
                log_error(f"Failed to track embedding cost: {e}")

    return embedding

@retry(max_attempts=3, delay=1.0)
def get_chat_response(prompt: str, context: str = "", provider_id: Optional[str] = None, api_key: Optional[str] = None, db=None, user_id: int = None) -> str:
    response, usage = llm_service.generate_chat_response(prompt, context, provider_id=provider_id or settings.LLM_PROVIDER, api_key=api_key)
    log_info(f"Generated chat response for question length {len(prompt)}")

    if db and user_id:
        try:
            from app.services.cost import track_cost
            if usage:
                input_tokens = usage.get("prompt_tokens", 0)
                output_tokens = usage.get("completion_tokens", 0)
            else:
                input_tokens = estimate_tokens(context) + estimate_tokens(prompt)
                output_tokens = estimate_tokens(response)
            track_cost(
                db=db,
                user_id=user_id,
                provider=provider_id or settings.LLM_PROVIDER,
                operation="chat",
                input_tokens=input_tokens,
                output_tokens=output_tokens
            )
        except Exception as e:
            log_error(f"Failed to track chat cost: {e}")

    return response

def get_chat_response_stream(prompt: str, context: str = "", provider_id: Optional[str] = None, api_key: Optional[str] = None, db=None, user_id: int = None):
    chunks = []
    final_usage = None
    for delta, usage in llm_service.generate_chat_response_stream(prompt, context, provider_id=provider_id or settings.LLM_PROVIDER, api_key=api_key):
        if delta:
            chunks.append(delta)
            yield delta
        if usage:
            final_usage = usage

    response = "".join(chunks)
    log_info(f"Streamed chat response for question length {len(prompt)}")

    if db and user_id:
        try:
            from app.services.cost import track_cost
            if final_usage:
                input_tokens = final_usage.get("prompt_tokens", 0)
                output_tokens = final_usage.get("completion_tokens", 0)
            else:
                input_tokens = estimate_tokens(context) + estimate_tokens(prompt)
                output_tokens = estimate_tokens(response)
            track_cost(
                db=db,
                user_id=user_id,
                provider=provider_id or settings.LLM_PROVIDER,
                operation="chat",
                input_tokens=input_tokens,
                output_tokens=output_tokens
            )
        except Exception as e:
            log_error(f"Failed to track chat cost: {e}")

    return response
