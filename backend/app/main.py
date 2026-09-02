from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.api.auth import router as auth_router
from app.api.files import router as files_router
from app.api.chat import router as chat_router
from app.api.drive import router as drive_router
from app.api.settings import router as settings_router
from app.api.cost import router as cost_router
from app.api.integrations import router as integrations_router
from app.api.workspaces import router as workspaces_router
from app.api.spaces import router as spaces_router
from app.api.ws import router as ws_router
from app.database import init_db
from app.config import settings
from app.core.rate_limit import limiter, rate_limit_exceeded_handler

app = FastAPI(title="MindVault API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(files_router)
app.include_router(chat_router)
app.include_router(drive_router)
app.include_router(settings_router)
app.include_router(cost_router)
app.include_router(integrations_router)
app.include_router(workspaces_router)
app.include_router(spaces_router)
app.include_router(ws_router)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/")
async def root():
    return {"message": "MindVault API is running"}
