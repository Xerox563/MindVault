from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.database import init_db

app = FastAPI(title="MindVault API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/")
async def root():
    return {"message": "MindVault API is running"}
