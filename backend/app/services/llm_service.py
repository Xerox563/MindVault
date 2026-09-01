import os
import requests
from typing import List, Dict, Any, Optional
from app.config import settings
from app.utils.logger import log_error, log_info

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"
OPENROUTER_API_URL = "https://openrouter.ai/api/v1"

def _model_override(provider_id: str, prefix: str, default_model: str) -> str:
    """'mistral' -> default_model, 'mistral-mistral-small-latest' -> 'mistral-small-latest'."""
    if provider_id == prefix:
        return default_model
    if provider_id.startswith(prefix + "-"):
        return provider_id[len(prefix) + 1:]
    return default_model

def _build_messages(prompt: str, context: str) -> List[Dict[str, str]]:
    if context.strip():
        return [
            {"role": "system", "content": "You are a helpful assistant. Answer the user's question using the provided context from their documents. If the context doesn't contain the answer, say so rather than making one up."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {prompt}"}
        ]
    return [
        {"role": "system", "content": "You are a helpful, friendly assistant for MindVault, a document knowledge base. Chat naturally. If the user asks about their documents and none were found relevant, let them know you couldn't find anything in their uploaded files."},
        {"role": "user", "content": prompt}
    ]

class LLMService:
    """Unified LLM service supporting Mistral, Gemini, OpenRouter (server or per-user API
    key) and Ollama. Available models for each cloud provider are fetched live from that
    provider's own model-list endpoint rather than hardcoded.

    Providers are resolved per-call so a user-supplied API key (saved via
    /api/settings/api-keys) works immediately without a server restart, and so
    concurrent users with different keys/models never share mutable state.
    """

    def __init__(self):
        self.providers = {}
        self.hybrid_mode = settings.ENABLE_HYBRID_LLM
        self._init_ollama()

    def _init_ollama(self):
        """Probe Ollama once at startup; get_available_providers() re-probes lazily
        so starting Ollama after the backend doesn't require a restart."""
        try:
            import ollama
            if settings.OLLAMA_HOST and settings.OLLAMA_HOST != "http://localhost:11434":
                os.environ["OLLAMA_HOST"] = settings.OLLAMA_HOST
            ollama.list()
            self.providers['ollama'] = {
                'client': ollama,
                'default_model': settings.OLLAMA_MODEL,
                'embedding_model': settings.OLLAMA_EMBEDDING_MODEL,
            }
            log_info("Ollama client initialized")
        except Exception as e:
            log_info(f"Ollama not available at startup: {e}")
            self.providers['ollama'] = None

    def _ollama_client(self):
        """Return the ollama module, re-probing if it wasn't available at startup."""
        if self.providers.get('ollama'):
            return self.providers['ollama']['client']
        try:
            import ollama
            ollama.list()
            self.providers['ollama'] = {
                'client': ollama,
                'default_model': settings.OLLAMA_MODEL,
                'embedding_model': settings.OLLAMA_EMBEDDING_MODEL,
            }
            return ollama
        except Exception:
            return None

    # Mistral's model list includes non-chat models (embeddings, OCR, moderation,
    # audio/TTS, code-completion-only) that would just error out if picked here.
    _MISTRAL_NON_CHAT_HINTS = ("embed", "ocr", "moderation", "tts", "transcribe", "voxtral", "fim")

    def _list_mistral_models(self, api_key: str) -> List[str]:
        try:
            from mistralai.client import MistralClient
            client = MistralClient(api_key=api_key)
            models = client.list_models()
            return sorted(
                m.id for m in models.data
                if not any(hint in m.id.lower() for hint in self._MISTRAL_NON_CHAT_HINTS)
            )
        except Exception as e:
            log_error(f"Failed to list Mistral models: {e}")
            return []

    def _list_gemini_models(self, api_key: str) -> List[str]:
        try:
            response = requests.get(f"{GEMINI_API_URL}/models", params={"key": api_key}, timeout=8)
            response.raise_for_status()
            models = response.json().get("models", [])
            return sorted(
                m["name"].split("/")[-1] for m in models
                if "generateContent" in m.get("supportedGenerationMethods", [])
            )
        except Exception as e:
            log_error(f"Failed to list Gemini models: {e}")
            return []

    def _list_mistral_embedding_models(self, api_key: str) -> List[str]:
        try:
            from mistralai.client import MistralClient
            client = MistralClient(api_key=api_key)
            models = client.list_models()
            return sorted(m.id for m in models.data if "embed" in m.id.lower())
        except Exception as e:
            log_error(f"Failed to list Mistral embedding models: {e}")
            return []

    def _list_gemini_embedding_models(self, api_key: str) -> List[str]:
        try:
            response = requests.get(f"{GEMINI_API_URL}/models", params={"key": api_key}, timeout=8)
            response.raise_for_status()
            models = response.json().get("models", [])
            return sorted(
                m["name"].split("/")[-1] for m in models
                if "embedContent" in m.get("supportedGenerationMethods", [])
            )
        except Exception as e:
            log_error(f"Failed to list Gemini embedding models: {e}")
            return []

    def get_available_embedding_models(self, user_api_keys: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        """Same idea as get_available_providers but for embeddings - fetched live from
        each provider, never hardcoded. OpenRouter has no embeddings endpoint so it's
        excluded here entirely."""
        user_api_keys = user_api_keys or {}
        available = []

        mistral_key = user_api_keys.get('mistral') or settings.MISTRAL_API_KEY
        if mistral_key:
            source = 'user' if user_api_keys.get('mistral') else 'server'
            for model_id in self._list_mistral_embedding_models(mistral_key):
                available.append({'id': f'mistral-{model_id}', 'name': model_id, 'type': 'cloud', 'model': model_id, 'available': True, 'source': source})

        gemini_key = user_api_keys.get('gemini') or settings.GEMINI_API_KEY
        if gemini_key:
            source = 'user' if user_api_keys.get('gemini') else 'server'
            for model_id in self._list_gemini_embedding_models(gemini_key):
                available.append({'id': f'gemini-{model_id}', 'name': model_id, 'type': 'cloud', 'model': model_id, 'available': True, 'source': source})

        ollama_client = self._ollama_client()
        if ollama_client:
            try:
                models = ollama_client.list()
                for model in models.get('models', []):
                    name = model.get('name') or model.get('model')
                    if not name:
                        continue
                    available.append({'id': f'ollama-{name}', 'name': name, 'type': 'local', 'model': name, 'available': True, 'source': 'local'})
            except Exception as e:
                log_error(f"Failed to list Ollama models for embeddings: {e}")

        return available

    def _list_openrouter_models(self) -> List[str]:
        try:
            response = requests.get(f"{OPENROUTER_API_URL}/models", timeout=8)
            response.raise_for_status()
            models = response.json().get("data", [])
            return sorted(m["id"] for m in models if m.get("id"))
        except Exception as e:
            log_error(f"Failed to list OpenRouter models: {e}")
            return []

    def get_available_providers(self, user_api_keys: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        """List all usable providers, with each cloud provider's actual models fetched
        live from its own API (not hardcoded) once a key is available."""
        user_api_keys = user_api_keys or {}
        available = []

        mistral_key = user_api_keys.get('mistral') or settings.MISTRAL_API_KEY
        if mistral_key:
            source = 'user' if user_api_keys.get('mistral') else 'server'
            models = self._list_mistral_models(mistral_key)
            if not models:
                models = ['mistral-large-latest']  # key works but listing failed - keep a usable default
            for model_id in models:
                available.append({
                    'id': f'mistral-{model_id}',
                    'name': model_id,
                    'type': 'cloud',
                    'model': model_id,
                    'available': True,
                    'source': source,
                })

        gemini_key = user_api_keys.get('gemini') or settings.GEMINI_API_KEY
        if gemini_key:
            source = 'user' if user_api_keys.get('gemini') else 'server'
            for model_id in self._list_gemini_models(gemini_key):
                available.append({
                    'id': f'gemini-{model_id}',
                    'name': model_id,
                    'type': 'cloud',
                    'model': model_id,
                    'available': True,
                    'source': source,
                })

        openrouter_key = user_api_keys.get('openrouter') or settings.OPENROUTER_API_KEY
        if openrouter_key:
            source = 'user' if user_api_keys.get('openrouter') else 'server'
            for model_id in self._list_openrouter_models():
                available.append({
                    'id': f'openrouter-{model_id}',
                    'name': model_id,
                    'type': 'cloud',
                    'model': model_id,
                    'available': True,
                    'source': source,
                })

        ollama_client = self._ollama_client()
        if ollama_client:
            try:
                models = ollama_client.list()
                for model in models.get('models', []):
                    name = model.get('name') or model.get('model')
                    if not name:
                        continue
                    available.append({
                        'id': f"ollama-{name}",
                        'name': name,
                        'type': 'local',
                        'model': name,
                        'available': True,
                        'source': 'local',
                    })
            except Exception as e:
                log_error(f"Failed to list Ollama models: {e}")

        return available

    def generate_chat_response(self, prompt: str, context: str = "", provider_id: str = "mistral", api_key: Optional[str] = None) -> tuple[str, Optional[Dict[str, int]]]:
        """Returns (response_text, usage) where usage is {"prompt_tokens", "completion_tokens"}
        taken from the provider's own accounting, or None if the provider doesn't report it
        (callers should fall back to estimating from text length)."""
        try:
            messages = _build_messages(prompt, context)

            if provider_id.startswith('ollama'):
                client = self._ollama_client()
                if not client:
                    return "Ollama is not running or not reachable. Start it and try again.", None
                model = _model_override(provider_id, 'ollama', self.providers['ollama']['default_model'])
                response = client.chat(model=model, messages=messages)
                usage = None
                if response.get('prompt_eval_count') is not None or response.get('eval_count') is not None:
                    usage = {
                        "prompt_tokens": response.get('prompt_eval_count', 0),
                        "completion_tokens": response.get('eval_count', 0),
                    }
                return response['message']['content'], usage

            if provider_id.startswith('gemini'):
                key = api_key or settings.GEMINI_API_KEY
                if not key:
                    return "No Gemini API key configured. Add one under Settings to use Gemini.", None
                model = _model_override(provider_id, 'gemini', 'gemini-1.5-flash')
                return self._gemini_chat(model, messages, key)

            if provider_id.startswith('openrouter'):
                key = api_key or settings.OPENROUTER_API_KEY
                if not key:
                    return "No OpenRouter API key configured. Add one under Settings to use OpenRouter.", None
                model = _model_override(provider_id, 'openrouter', 'openai/gpt-4o-mini')
                return self._openrouter_chat(model, messages, key)

            key = api_key or settings.MISTRAL_API_KEY
            if not key:
                return "No Mistral API key configured. Add one under Settings to use Mistral.", None
            from mistralai.client import MistralClient
            client = MistralClient(api_key=key)
            model = _model_override(provider_id, 'mistral', 'mistral-large-latest')
            response = client.chat(model=model, messages=messages)
            usage = None
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens or 0,
                }
            return response.choices[0].message.content, usage

        except Exception as e:
            log_error(f"Error generating chat response: {str(e)}")
            return f"Error: {str(e)}", None

    def _gemini_chat(self, model: str, messages: List[Dict[str, str]], api_key: str) -> tuple[str, Optional[Dict[str, int]]]:
        system_parts = [m["content"] for m in messages if m["role"] == "system"]
        user_parts = [m["content"] for m in messages if m["role"] != "system"]
        body = {"contents": [{"role": "user", "parts": [{"text": "\n\n".join(user_parts)}]}]}
        if system_parts:
            body["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}

        response = requests.post(f"{GEMINI_API_URL}/models/{model}:generateContent", params={"key": api_key}, json=body, timeout=60)
        response.raise_for_status()
        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        usage_meta = data.get("usageMetadata", {})
        usage = None
        if usage_meta:
            usage = {
                "prompt_tokens": usage_meta.get("promptTokenCount", 0),
                "completion_tokens": usage_meta.get("candidatesTokenCount", 0),
            }
        return text, usage

    def _openrouter_chat(self, model: str, messages: List[Dict[str, str]], api_key: str) -> tuple[str, Optional[Dict[str, int]]]:
        response = requests.post(
            f"{OPENROUTER_API_URL}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": model, "messages": messages},
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        text = data["choices"][0]["message"]["content"]
        usage_data = data.get("usage") or {}
        usage = {
            "prompt_tokens": usage_data.get("prompt_tokens", 0),
            "completion_tokens": usage_data.get("completion_tokens", 0),
        } if usage_data else None
        return text, usage

    def generate_chat_response_stream(self, prompt: str, context: str = "", provider_id: str = "mistral", api_key: Optional[str] = None):
        """Yields (delta_text, usage) as the answer streams in; usage is only set on the last chunk."""
        try:
            messages = _build_messages(prompt, context)

            if provider_id.startswith('ollama'):
                client = self._ollama_client()
                if not client:
                    yield "Ollama is not running or not reachable. Start it and try again.", None
                    return
                model = _model_override(provider_id, 'ollama', self.providers['ollama']['default_model'])
                for part in client.chat(model=model, messages=messages, stream=True):
                    content = (part.get('message') or {}).get('content')
                    if content:
                        yield content, None
                    if part.get('done'):
                        yield "", {
                            "prompt_tokens": part.get('prompt_eval_count') or 0,
                            "completion_tokens": part.get('eval_count') or 0,
                        }
                return

            if provider_id.startswith('gemini'):
                key = api_key or settings.GEMINI_API_KEY
                if not key:
                    yield "No Gemini API key configured. Add one under Settings to use Gemini.", None
                    return
                model = _model_override(provider_id, 'gemini', 'gemini-1.5-flash')
                # Gemini's streaming endpoint is real but fiddlier to parse (SSE of partial JSON
                # objects); a non-streamed call plus a single yield keeps this provider correct
                # without more surface area than the "quick win" this feature needs.
                text, usage = self._gemini_chat(model, messages, key)
                yield text, usage
                return

            if provider_id.startswith('openrouter'):
                key = api_key or settings.OPENROUTER_API_KEY
                if not key:
                    yield "No OpenRouter API key configured. Add one under Settings to use OpenRouter.", None
                    return
                model = _model_override(provider_id, 'openrouter', 'openai/gpt-4o-mini')
                yield from self._openrouter_chat_stream(model, messages, key)
                return

            key = api_key or settings.MISTRAL_API_KEY
            if not key:
                yield "No Mistral API key configured. Add one under Settings to use Mistral.", None
                return
            from mistralai.client import MistralClient
            client = MistralClient(api_key=key)
            model = _model_override(provider_id, 'mistral', 'mistral-large-latest')
            for chunk in client.chat_stream(model=model, messages=messages):
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta, None
                if chunk.usage:
                    yield "", {
                        "prompt_tokens": chunk.usage.prompt_tokens,
                        "completion_tokens": chunk.usage.completion_tokens or 0,
                    }

        except Exception as e:
            log_error(f"Error streaming chat response: {str(e)}")
            yield f"Error: {str(e)}", None

    def _openrouter_chat_stream(self, model: str, messages: List[Dict[str, str]], api_key: str):
        import json as _json
        response = requests.post(
            f"{OPENROUTER_API_URL}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": model, "messages": messages, "stream": True},
            stream=True,
            timeout=60,
        )
        response.raise_for_status()
        for line in response.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data:"):
                continue
            payload = line[len("data:"):].strip()
            if payload == "[DONE]":
                break
            try:
                chunk = _json.loads(payload)
            except ValueError:
                continue
            delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
            if delta:
                yield delta, None
            usage_data = chunk.get("usage")
            if usage_data:
                yield "", {
                    "prompt_tokens": usage_data.get("prompt_tokens", 0),
                    "completion_tokens": usage_data.get("completion_tokens", 0),
                }

    def generate_embedding(self, text: str, provider_id: str = "mistral", api_key: Optional[str] = None) -> tuple[List[float], Optional[Dict[str, int]]]:
        """Returns (embedding_vector, usage) where usage is {"prompt_tokens"} taken from the
        provider's own accounting, or None if unavailable (callers should estimate instead).
        OpenRouter has no stable embeddings endpoint, so it isn't supported here - pick
        Mistral, Gemini or Ollama for the embedding side if you're using OpenRouter for chat."""
        try:
            if provider_id.startswith('ollama'):
                client = self._ollama_client()
                if not client:
                    log_error("Ollama is not running or not reachable")
                    return [], None
                embedding_model = _model_override(provider_id, 'ollama', self.providers['ollama']['embedding_model'])
                response = client.embeddings(model=embedding_model, prompt=text)
                return response['embedding'], None

            if provider_id.startswith('gemini'):
                key = api_key or settings.GEMINI_API_KEY
                if not key:
                    log_error("No Gemini API key configured for embeddings")
                    return [], None
                model = _model_override(provider_id, 'gemini', 'text-embedding-004')
                response = requests.post(
                    f"{GEMINI_API_URL}/models/{model}:embedContent",
                    params={"key": key},
                    json={"content": {"parts": [{"text": text}]}},
                    timeout=30,
                )
                response.raise_for_status()
                return response.json()["embedding"]["values"], None

            if provider_id.startswith('openrouter'):
                log_error("OpenRouter does not support embeddings; configure Mistral, Gemini, or Ollama for embeddings")
                return [], None

            key = api_key or settings.MISTRAL_API_KEY
            if not key:
                log_error("No Mistral API key configured for embeddings")
                return [], None
            from mistralai.client import MistralClient
            client = MistralClient(api_key=key)
            model = _model_override(provider_id, 'mistral', 'mistral-embed')
            response = client.embeddings(model=model, input=text)
            usage = {"prompt_tokens": response.usage.prompt_tokens} if response.usage else None
            return response.data[0].embedding, usage

        except Exception as e:
            log_error(f"Error generating embedding: {str(e)}")
            return [], None

    def pull_ollama_model(self, model_name: str) -> bool:
        client = self._ollama_client()
        if not client:
            return False
        try:
            log_info(f"Pulling Ollama model: {model_name}")
            client.pull(model_name)
            return True
        except Exception as e:
            log_error(f"Error pulling Ollama model: {str(e)}")
            return False

# Create singleton instance (holds only the stateless Ollama connection probe)
llm_service = LLMService()
