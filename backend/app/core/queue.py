import redis
from rq import Queue
from app.config import settings

redis_conn = redis.Redis.from_url(settings.REDIS_URL)
ingest_queue = Queue("ingestion", connection=redis_conn)
