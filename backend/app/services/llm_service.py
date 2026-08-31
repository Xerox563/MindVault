import os
from typing import List, Dict, Any, Optional
from app.config import settings
from app.utils.logger import log_error, log_info

class LLMService:
    """Unified LLM service supporting Mistral (server or per-user API key) and Ollama.

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

    def get_available_providers(self, user_api_keys: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        """List all usable providers: Mistral if a server or per-user key exists, plus
        every locally-pulled Ollama model."""
        user_api_keys = user_api_keys or {}
        available = []

        mistral_key = user_api_keys.get('mistral') or settings.MISTRAL_API_KEY
        if mistral_key:
            available.append({
                'id': 'mistral',
                'name': 'Mistral AI',
                'type': 'cloud',
                'model': 'mistral-large-latest',
                'available': True,
                'source': 'user' if user_api_keys.get('mistral') else 'server',
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
            if context.strip():
                messages = [
                    {"role": "system", "content": "You are a helpful assistant. Answer the user's question using the provided context from their documents. If the context doesn't contain the answer, say so rather than making one up."},
                    {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {prompt}"}
                ]
            else:
                messages = [
                    {"role": "system", "content": "You are a helpful, friendly assistant for MindVault, a document knowledge base. Chat naturally. If the user asks about their documents and none were found relevant, let them know you couldn't find anything in their uploaded files."},
                    {"role": "user", "content": prompt}
                ]

            if provider_id.startswith('ollama'):
                client = self._ollama_client()
                if not client:
                    return "Ollama is not running or not reachable. Start it and try again.", None
                model = provider_id[len('ollama-'):] if provider_id.startswith('ollama-') and provider_id != 'ollama' else self.providers['ollama']['default_model']
                response = client.chat(model=model, messages=messages)
                usage = None
                if response.get('prompt_eval_count') is not None or response.get('eval_count') is not None:
                    usage = {
                        "prompt_tokens": response.get('prompt_eval_count', 0),
                        "completion_tokens": response.get('eval_count', 0),
                    }
                return response['message']['content'], usage

            key = api_key or settings.MISTRAL_API_KEY
            if not key:
                return "No Mistral API key configured. Add one under Settings to use Mistral.", None
            from mistralai.client import MistralClient
            client = MistralClient(api_key=key)
            response = client.chat(model='mistral-large-latest', messages=messages)
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

    def generate_embedding(self, text: str, provider_id: str = "mistral", api_key: Optional[str] = None) -> tuple[List[float], Optional[Dict[str, int]]]:
        """Returns (embedding_vector, usage) where usage is {"prompt_tokens"} taken from the
        provider's own accounting, or None if unavailable (callers should estimate instead)."""
        try:
            if provider_id.startswith('ollama'):
                client = self._ollama_client()
                if not client:
                    log_error("Ollama is not running or not reachable")
                    return [], None
                embedding_model = self.providers['ollama']['embedding_model']
                response = client.embeddings(model=embedding_model, prompt=text)
                return response['embedding'], None

            key = api_key or settings.MISTRAL_API_KEY
            if not key:
                log_error("No Mistral API key configured for embeddings")
                return [], None
            from mistralai.client import MistralClient
            client = MistralClient(api_key=key)
            response = client.embeddings(model='mistral-embed', input=text)
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
