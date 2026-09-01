from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, HTTPException
from starlette.responses import JSONResponse

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
)

def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded",
            "message": "Too many requests. Please slow down.",
            "retry_after": exc.retry_after if hasattr(exc, 'retry_after') else 60
        }
    )

def get_chat_limit():
    return "30/minute"

def get_upload_limit():
    return "10/minute"

def get_sync_limit():
    return "20/minute"

def get_default_limit():
    return "100/minute"
