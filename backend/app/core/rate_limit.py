"""
Rate Limiting Configuration
Prevents API abuse and controls costs
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, HTTPException
from starlette.responses import JSONResponse

# Initialize limiter with Redis storage (fallback to in-memory)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],  # Default: 100 requests per minute per IP
)

def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded"""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded",
            "message": "Too many requests. Please slow down.",
            "retry_after": exc.retry_after if hasattr(exc, 'retry_after') else 60
        }
    )

# Rate limit configurations by endpoint
def get_chat_limit():
    """Chat endpoint: 30 requests per minute per user"""
    return "30/minute"

def get_upload_limit():
    """File upload: 10 per minute (expensive operation)"""
    return "10/minute"

def get_sync_limit():
    """Sync operations: 20 per minute"""
    return "20/minute"

def get_default_limit():
    """Default: 100 per minute"""
    return "100/minute"
