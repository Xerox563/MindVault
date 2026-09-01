import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.user import QueryCache
from app.utils.logger import log_info, log_error

CACHE_TTL_HOURS = 24 * 7
MIN_QUERY_LENGTH = 10
MAX_CACHE_SIZE = 10000

def normalize_question(question: str) -> str:
    normalized = question.lower().strip()
    normalized = ' '.join(normalized.split())
    return normalized

def generate_query_hash(question: str) -> str:
    normalized = normalize_question(question)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

def get_cached_result(db: Session, question: str) -> Optional[Dict[str, Any]]:
    try:
        if len(question) < MIN_QUERY_LENGTH:
            return None

        query_hash = generate_query_hash(question)
        cache_entry = db.query(QueryCache).filter(
            QueryCache.query_hash == query_hash
        ).first()

        if not cache_entry:
            return None

        if cache_entry.expires_at and cache_entry.expires_at < datetime.utcnow():
            db.delete(cache_entry)
            db.commit()
            log_info(f"Cache entry expired and removed: {query_hash[:8]}...")
            return None

        cache_entry.hit_count += 1
        cache_entry.last_accessed = datetime.utcnow()
        db.commit()

        log_info(f"Cache HIT for query: {query_hash[:8]}... (hits: {cache_entry.hit_count})")

        sources = []
        if cache_entry.sources:
            try:
                sources = json.loads(cache_entry.sources)
            except json.JSONDecodeError:
                log_error("Failed to parse cached sources JSON")
        
        return {
            "answer": cache_entry.answer,
            "sources": sources,
            "cached": True,
            "hit_count": cache_entry.hit_count
        }
        
    except Exception as e:
        log_error(f"Error checking cache: {str(e)}")
        return None

def cache_result(db: Session, question: str, answer: str, sources: List[Dict[str, Any]]) -> bool:
    try:
        if len(question) < MIN_QUERY_LENGTH:
            return False

        query_hash = generate_query_hash(question)

        existing = db.query(QueryCache).filter(QueryCache.query_hash == query_hash).first()
        if existing:
            log_info(f"Cache entry already exists: {query_hash[:8]}...")
            return True

        cleanup_old_cache_entries(db)

        expires_at = datetime.utcnow() + timedelta(hours=CACHE_TTL_HOURS)
        
        cache_entry = QueryCache(
            query_hash=query_hash,
            question=question,
            answer=answer,
            sources=json.dumps(sources) if sources else None,
            expires_at=expires_at,
            created_at=datetime.utcnow(),
            last_accessed=datetime.utcnow(),
            hit_count=1
        )
        
        db.add(cache_entry)
        db.commit()
        
        log_info(f"Cached new result: {query_hash[:8]}... (expires: {expires_at})")
        return True
        
    except Exception as e:
        log_error(f"Error caching result: {str(e)}")
        db.rollback()
        return False

def cleanup_old_cache_entries(db: Session, keep_count: int = MAX_CACHE_SIZE):
    try:
        count = db.query(QueryCache).count()
        if count >= keep_count:
            to_remove = int(keep_count * 0.1)
            old_entries = db.query(QueryCache).order_by(
                QueryCache.last_accessed.asc()
            ).limit(to_remove).all()
            
            for entry in old_entries:
                db.delete(entry)
            
            db.commit()
            log_info(f"Cleaned up {len(old_entries)} old cache entries")
            
    except Exception as e:
        log_error(f"Error cleaning up cache: {str(e)}")

def clear_expired_cache(db: Session) -> int:
    try:
        expired = db.query(QueryCache).filter(
            QueryCache.expires_at < datetime.utcnow()
        ).all()
        
        count = len(expired)
        for entry in expired:
            db.delete(entry)
        
        db.commit()
        log_info(f"Cleared {count} expired cache entries")
        return count
        
    except Exception as e:
        log_error(f"Error clearing expired cache: {str(e)}")
        return 0

def get_cache_stats(db: Session) -> Dict[str, Any]:
    try:
        from sqlalchemy import func
        total_entries = db.query(QueryCache).count()
        total_hits_result = db.query(func.sum(QueryCache.hit_count)).scalar()
        total_hits = int(total_hits_result) if total_hits_result else 0

        popular = db.query(QueryCache).order_by(
            QueryCache.hit_count.desc()
        ).limit(5).all()
        
        return {
            "total_entries": total_entries,
            "total_hits": int(total_hits),
            "avg_hits_per_entry": round(total_hits / total_entries, 2) if total_entries > 0 else 0,
            "cache_size_limit": MAX_CACHE_SIZE,
            "ttl_hours": CACHE_TTL_HOURS,
            "top_queries": [
                {
                    "question": q.question[:50] + "..." if len(q.question) > 50 else q.question,
                    "hits": q.hit_count
                }
                for q in popular
            ]
        }
        
    except Exception as e:
        log_error(f"Error getting cache stats: {str(e)}")
        return {}
