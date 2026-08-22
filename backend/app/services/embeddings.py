import os
from mistralai.client import MistralClient
from app.config import settings
from app.utils.logger import log_error, log_info
from app.utils.retry import retry

client = MistralClient(api_key=settings.MISTRAL_API_KEY) if settings.MISTRAL_API_KEY else None

@retry(max_attempts=3, delay=1.0)
def get_embedding(text: str) -> list[float]:
    if not client:
        log_error("Mistral API key not configured")
        return []
    response = client.embeddings(
        model="mistral-embed",
        input=text
    )
    log_info(f"Generated embedding for text length {len(text)}")
    return response.data[0].embedding

@retry(max_attempts=3, delay=1.0)
def get_chat_response(prompt: str, context: str = "") -> str:
    if not client:
        log_error("Mistral API key not configured")
        return "Mistral API key not configured"
    messages = [
        {"role": "system", "content": "You are a helpful assistant. Answer based on the provided context."},
        {"role": "user", "content": f"Context: {context}\n\nQuestion: {prompt}"}
    ]
    response = client.chat(
        model="mistral-large-latest",
        messages=messages
    )
    log_info(f"Generated chat response for question length {len(prompt)}")
    return response.choices[0].message.content
