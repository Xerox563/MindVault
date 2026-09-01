from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.user import SyncedFile, File
from app.utils.logger import log_info, log_error

def get_synced_file(db: Session, user_id: int, external_id: str, source: str) -> Optional[SyncedFile]:
    return db.query(SyncedFile).filter(
        and_(
            SyncedFile.user_id == user_id,
            SyncedFile.external_id == external_id,
            SyncedFile.source == source
        )
    ).first()

def needs_sync(
    db: Session, 
    user_id: int, 
    external_id: str, 
    source: str,
    remote_modified: datetime,
    remote_size: Optional[int] = None,
    remote_checksum: Optional[str] = None
) -> bool:
    synced = get_synced_file(db, user_id, external_id, source)

    if not synced:
        log_info(f"New file detected: {external_id}")
        return True

    if synced.sync_status == "deleted":
        log_info(f"Previously deleted file reappeared: {external_id}")
        return True

    if synced.sync_status == "error":
        log_info(f"Retrying previously failed file: {external_id}")
        return True

    if synced.last_modified and remote_modified:
        if remote_modified > synced.last_modified:
            log_info(f"File modified since last sync: {external_id}")
            return True

    if remote_size and synced.size and remote_size != synced.size:
        log_info(f"File size changed: {external_id} ({synced.size} -> {remote_size})")
        return True

    if remote_checksum and synced.checksum and remote_checksum != synced.checksum:
        log_info(f"File checksum changed: {external_id}")
        return True
    
    log_info(f"File unchanged, skipping download: {external_id}")
    return False

def record_sync(
    db: Session,
    user_id: int,
    external_id: str,
    source: str,
    filename: str,
    mime_type: Optional[str] = None,
    size: Optional[int] = None,
    checksum: Optional[str] = None,
    last_modified: Optional[datetime] = None,
    local_file_id: Optional[int] = None,
    status: str = "active"
) -> SyncedFile:
    try:
        synced = get_synced_file(db, user_id, external_id, source)

        if synced:
            synced.filename = filename
            synced.mime_type = mime_type
            synced.size = size
            synced.checksum = checksum
            synced.last_modified = last_modified
            synced.local_file_id = local_file_id
            synced.sync_status = status
            synced.last_synced = datetime.utcnow()
            log_info(f"Updated sync record: {external_id}")
        else:
            synced = SyncedFile(
                user_id=user_id,
                external_id=external_id,
                source=source,
                filename=filename,
                mime_type=mime_type,
                size=size,
                checksum=checksum,
                last_modified=last_modified,
                local_file_id=local_file_id,
                sync_status=status
            )
            db.add(synced)
            log_info(f"Created new sync record: {external_id}")

        db.commit()
        return synced

    except Exception as e:
        log_error(f"Error recording sync: {str(e)}")
        db.rollback()
        raise

def mark_sync_error(
    db: Session,
    user_id: int,
    external_id: str,
    source: str,
    error_message: str
) -> None:
    try:
        synced = get_synced_file(db, user_id, external_id, source)
        if synced:
            synced.sync_status = "error"
            synced.last_synced = datetime.utcnow()
            db.commit()
            log_info(f"Marked sync as error: {external_id} - {error_message}")
    except Exception as e:
        log_error(f"Error marking sync status: {str(e)}")

def get_synced_files_for_user(
    db: Session,
    user_id: int,
    source: Optional[str] = None,
    status: Optional[str] = None
) -> List[SyncedFile]:
    query = db.query(SyncedFile).filter(SyncedFile.user_id == user_id)

    if source:
        query = query.filter(SyncedFile.source == source)

    if status:
        query = query.filter(SyncedFile.sync_status == status)

    return query.order_by(SyncedFile.last_synced.desc()).all()

def delete_synced_file(
    db: Session,
    user_id: int,
    external_id: str,
    source: str
) -> bool:
    try:
        synced = get_synced_file(db, user_id, external_id, source)
        if synced:
            synced.sync_status = "deleted"
            synced.last_synced = datetime.utcnow()
            db.commit()
            log_info(f"Marked synced file as deleted: {external_id}")
            return True
        return False
    except Exception as e:
        log_error(f"Error deleting sync record: {str(e)}")
        return False

def get_sync_stats(db: Session, user_id: int) -> Dict[str, Any]:
    try:
        total = db.query(SyncedFile).filter(SyncedFile.user_id == user_id).count()
        active = db.query(SyncedFile).filter(
            and_(SyncedFile.user_id == user_id, SyncedFile.sync_status == "active")
        ).count()
        errors = db.query(SyncedFile).filter(
            and_(SyncedFile.user_id == user_id, SyncedFile.sync_status == "error")
        ).count()
        deleted = db.query(SyncedFile).filter(
            and_(SyncedFile.user_id == user_id, SyncedFile.sync_status == "deleted")
        ).count()

        sources = db.query(SyncedFile.source).filter(
            SyncedFile.user_id == user_id
        ).distinct().all()

        by_source = {}
        for (source,) in sources:
            count = db.query(SyncedFile).filter(
                and_(SyncedFile.user_id == user_id, SyncedFile.source == source)
            ).count()
            by_source[source] = count
        
        return {
            "total_synced": total,
            "active": active,
            "errors": errors,
            "deleted": deleted,
            "by_source": by_source
        }
    except Exception as e:
        log_error(f"Error getting sync stats: {str(e)}")
        return {}
