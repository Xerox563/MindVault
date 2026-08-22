from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    # Use SQLite by default, fallback to PostgreSQL if DATABASE_URL is set
    DATABASE_URL: str = "sqlite:///./data/mindvault.db"
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    UPLOAD_DIR: str = "data/uploads"
    # Point this at a mounted persistent disk in production (e.g. Render disk
    # mounted at /data -> CHROMA_PERSIST_DIR=/data/chroma). Left as a relative
    # local path by default so it just works in local dev.
    CHROMA_PERSIST_DIR: str = "data/chroma"
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
    ENABLE_HYBRID_LLM: bool = False  # Show both cloud and local models

    class Config:
        env_file = ".env"

settings = Settings()
