from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    # Use SQLite by default, fallback to PostgreSQL if DATABASE_URL is set
    DATABASE_URL: str = "sqlite:///./data/mindvault.db"
    MISTRAL_API_KEY: str = ""
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    UPLOAD_DIR: str = "data/uploads"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024
    ALLOWED_EXTENSIONS: list[str] = [".pdf", ".docx", ".xlsx", ".txt"]
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"

    class Config:
        env_file = ".env"

settings = Settings()
