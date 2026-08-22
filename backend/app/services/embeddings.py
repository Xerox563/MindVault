import os
from mistralai import Mistral
from app.config import settings

client = Mistral(api_key=settings.MISTRAL_API_KEY) if settings.MISTRAL_API_KEY else None

def get_embedding(text: str) -> list[float]:
    if not client:
        return []
    try:
        response = client.embeddings.create(
            model="mistral-embed",
            input=text
        )
        return response.data[0].embedding
    except Exception:
        return []

def get_chat_response(prompt: str, context: str = "") -> str:
    if not client:
        return "Mistral API key not configured"
    try:
        messages = [
            {"role": "system", "content": "You are a helpful assistant. Answer based on the provided context."},
            {"role": "user", "content": f"Context: {context}\n\nQuestion: {prompt}"}
        ]
        response = client.chat.complete(
            model="mistral-large-latest",
            messages=messages
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"
