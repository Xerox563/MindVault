import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis import asyncio as aioredis
from app.database import SessionLocal
from app.models.user import File
from app.utils.deps import verify_clerk_token
from app.config import settings

router = APIRouter()

@router.websocket("/ws/files/{file_id}/progress")
async def file_progress_ws(websocket: WebSocket, file_id: int, token: str):
    clerk_data = verify_clerk_token(token)
    if not clerk_data:
        await websocket.close(code=4401)
        return

    email = clerk_data.get("email") or f"{clerk_data['user_id']}@clerk.user"
    db = SessionLocal()
    try:
        from app.models.user import User
        user = db.query(User).filter(User.email == email).first()
        file = db.query(File).filter(File.id == file_id).first() if user else None
        if not user or not file or file.user_id != user.id:
            await websocket.close(code=4403)
            return

        # if it's already done by the time the client connects, just report that
        # and skip subscribing - nothing more will ever be published for this file
        if file.processing_status in ("complete", "error"):
            await websocket.accept()
            await websocket.send_json({
                "status": file.processing_status,
                "progress": file.processing_progress,
                "total": file.processing_total,
                "message": file.processing_error,
            })
            await websocket.close()
            return
    finally:
        db.close()

    await websocket.accept()
    redis_client = aioredis.from_url(settings.REDIS_URL)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(f"ingest:{file_id}")
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30)
            if message is None:
                await websocket.send_json({"status": "ping"})
                continue
            await websocket.send_text(message["data"].decode())
            data = json.loads(message["data"])
            if data.get("status") in ("complete", "error"):
                break
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        await pubsub.unsubscribe(f"ingest:{file_id}")
        await pubsub.close()
        await redis_client.close()
