import json
from app.database import SessionLocal
from app.models.user import File
from app.services.processor import process_file
from app.core.queue import redis_conn
from app.utils.logger import log_error

def _publish(file_id: int, payload: dict):
    redis_conn.publish(f"ingest:{file_id}", json.dumps(payload))

def ingest_file(file_id: int):
    """RQ job: runs in the worker process, outside the request/response cycle, so a
    large file's chunk-embed-store loop never blocks the upload request. Progress is
    pushed to Redis pub/sub so the API process's websocket can relay it to the browser."""
    db = SessionLocal()
    try:
        file = db.query(File).filter(File.id == file_id).first()
        if not file:
            return

        file.processing_status = "processing"
        file.processing_progress = 0
        db.commit()
        _publish(file_id, {"status": "processing", "progress": 0, "total": 0})

        def on_progress(done: int, total: int):
            file.processing_progress = done
            file.processing_total = total
            db.commit()
            _publish(file_id, {"status": "processing", "progress": done, "total": total})

        process_file(db, file, on_progress=on_progress)

        file.processing_status = "complete"
        db.commit()
        _publish(file_id, {"status": "complete", "progress": file.processing_progress, "total": file.processing_total})

    except Exception as e:
        log_error(f"Ingestion failed for file {file_id}: {e}")
        db.rollback()
        file = db.query(File).filter(File.id == file_id).first()
        if file:
            file.processing_status = "error"
            file.processing_error = str(e)[:500]
            db.commit()
        _publish(file_id, {"status": "error", "message": str(e)[:500]})
    finally:
        db.close()
