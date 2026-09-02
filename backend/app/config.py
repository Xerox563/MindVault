from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/mindvault.db"
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    UPLOAD_DIR: str = "data/uploads"
    # render's disk is ephemeral so chroma data goes to /tmp there instead (only used when CHROMA_API_KEY is unset)
    CHROMA_PERSIST_DIR: str = "/tmp/chroma" if os.environ.get("RENDER") else "data/chroma"
    # Chroma Cloud - when set, vectordb.py uses CloudClient instead of local PersistentClient
    CHROMA_API_KEY: str = ""
    CHROMA_TENANT: str = ""
    CHROMA_DATABASE: str = ""
    MAX_FILE_SIZE: int = 50 * 1024 * 1024
    ALLOWED_EXTENSIONS: list[str] = [".pdf", ".docx", ".xlsx", ".txt"]
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    CLERK_SECRET_KEY: str = ""

    # comma separated extra origins for CORS, local dev origin is always included
    ALLOWED_ORIGINS: str = ""

    @property
    def CORS_ORIGINS(self) -> list[str]:
        extra = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        return list(dict.fromkeys(["http://localhost:3000"] + extra))

    LLM_PROVIDER: str = "mistral"
    MISTRAL_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_EMBEDDING_MODEL: str = "nomic-embed-text"
    ENABLE_HYBRID_LLM: bool = False
    SLACK_CLIENT_ID: str = ""
    SLACK_CLIENT_SECRET: str = ""
    SLACK_REDIRECT_URI: str = "http://localhost:8000/api/integrations/slack/callback"
    NOTION_CLIENT_ID: str = ""
    NOTION_CLIENT_SECRET: str = ""
    NOTION_REDIRECT_URI: str = "http://localhost:8000/api/integrations/notion/callback"

    REDIS_URL: str = "redis://localhost:6379/0"

    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "noreply@mindvault.app"
    BREVO_SENDER_NAME: str = "MindVault"
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()
