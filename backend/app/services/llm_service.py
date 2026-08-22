import os
from typing import List, Dict, Any
from app.config import settings
from app.utils.logger import log_error, log_info

class LLMService:
    """Unified LLM service supporting both Mistral and Ollama"""
    
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        self._init_client()
    
    def _init_client(self):
        """Initialize the appropriate client based on provider"""
        if self.provider == "mistral":
            from mistralai.client import MistralClient
            self.client = MistralClient(api_key=settings.MISTRAL_API_KEY) if settings.MISTRAL_API_KEY else None
            self.model = "mistral-large-latest"
            self.embedding_model = "mistral-embed"
        elif self.provider == "ollama":
            import ollama
            self.client = ollama
            self.model = settings.OLLAMA_MODEL
            self.embedding_model = settings.OLLAMA_EMBEDDING_MODEL
            # Set Ollama host if configured
            if settings.OLLAMA_HOST and settings.OLLAMA_HOST != "http://localhost:11434":
                os.environ["OLLAMA_HOST"] = settings.OLLAMA_HOST
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")
        
        log_info(f"Initialized LLM service with provider: {self.provider}, model: {self.model}")
    
    def generate_chat_response(self, prompt: str, context: str = "") -> str:
        """Generate chat response using configured LLM"""
        try:
            messages = [
                {"role": "system", "content": "You are a helpful assistant. Answer based on the provided context."},
                {"role": "user", "content": f"Context: {context}\n\nQuestion: {prompt}"}
            ]
            
            if self.provider == "mistral":
                if not self.client:
                    return "Mistral API key not configured"
                
                response = self.client.chat(
                    model=self.model,
                    messages=messages
                )
                return response.choices[0].message.content
            
            elif self.provider == "ollama":
                response = self.client.chat(
                    model=self.model,
                    messages=messages
                )
                return response['message']['content']
            
        except Exception as e:
            log_error(f"Error generating chat response: {str(e)}")
            return f"Error: {str(e)}"
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embeddings using configured provider"""
        try:
            if self.provider == "mistral":
                if not self.client:
                    log_error("Mistral API key not configured")
                    return []
                
                response = self.client.embeddings(
                    model=self.embedding_model,
                    input=text
                )
                return response.data[0].embedding
            
            elif self.provider == "ollama":
                response = self.client.embeddings(
                    model=self.embedding_model,
                    prompt=text
                )
                return response['embedding']
            
        except Exception as e:
            log_error(f"Error generating embedding: {str(e)}")
            return []
    
    def list_ollama_models(self) -> List[str]:
        """List available Ollama models (only works with Ollama)"""
        if self.provider != "ollama":
            return []
        
        try:
            models = self.client.list()
            return [model['name'] for model in models['models']]
        except Exception as e:
            log_error(f"Error listing Ollama models: {str(e)}")
            return []
    
    def pull_ollama_model(self, model_name: str) -> bool:
        """Pull an Ollama model (only works with Ollama)"""
        if self.provider != "ollama":
            return False
        
        try:
            log_info(f"Pulling Ollama model: {model_name}")
            self.client.pull(model_name)
            return True
        except Exception as e:
            log_error(f"Error pulling Ollama model: {str(e)}")
            return False
    
    def check_ollama_connection(self) -> bool:
        """Check if Ollama is running"""
        if self.provider != "ollama":
            return False
        
        try:
            self.client.list()
            return True
        except Exception:
            return False

# Create singleton instance
llm_service = LLMService()
