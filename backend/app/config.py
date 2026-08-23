from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    # Use SQLite by default, fallback to PostgreSQL if DATABASE_URL is set
    DATABASE_URL: str = "sqlite:///./data/mindvault.db"
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    UPLOAD_DIR: str = "data/uploads"
    # ChromaDB persistence directory
    # In production (Render), use /tmp for ephemeral storage or mount a disk
    # For local dev, use relative path
    CHROMA_PERSIST_DIR: str = "/tmp/chroma" if os.environ.get("RENDER") else "data/chroma"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024
    ALLOWED_EXTENSIONS: list[str] = [".pdf", ".docx", ".xlsx", ".txt"]
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    CLERK_SECRET_KEY: str = ""

    # Comma-separated list of allowed frontend origins for CORS. Local dev origin
    # is always included so this never breaks `npm run dev`, even if unset/misset
    # in production. Add your Vercel URL here in prod, e.g.:
    # ALLOWED_ORIGINS=https://mindvault.vercel.app,https://mindvault-git-main.vercel.app
    ALLOWED_ORIGINS: str = ""

    @property
    def CORS_ORIGINS(self) -> list[str]:
        extra = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        return list(dict.fromkeys(["http://localhost:3000"] + extra))
    
    # LLM Configuration - supports both Mistral and Ollama
    LLM_PROVIDER: str = "mistral"  # Default provider
    MISTRAL_API_KEY: str = ""  # Mistral API key
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

    class Config:
        env_file = ".env"

settings = Settings()
