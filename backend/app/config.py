from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    # Use SQLite by default, fallback to PostgreSQL if DATABASE_URL is set
    DATABASE_URL: str = "sqlite:///./data/mindvault.db"
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    UPLOAD_DIR: str = "data/uploads"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024
    ALLOWED_EXTENSIONS: list[str] = [".pdf", ".docx", ".xlsx", ".txt"]
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    CLERK_SECRET_KEY: str = ""
    
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
