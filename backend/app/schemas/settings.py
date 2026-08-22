from pydantic import BaseModel

class ApiKeyUpdate(BaseModel):
    provider: str
    api_key: str

class ApiKeyStatus(BaseModel):
    provider: str
    configured: bool
    source: str  # "user" | "server" | "none"
