"""Run this as a separate process alongside the API server:

    python worker.py

It pulls jobs off the "ingestion" queue (file chunking/embedding) and runs them
outside the request/response cycle. Requires Redis running at REDIS_URL.
"""
from rq import Worker
from app.core.queue import redis_conn

if __name__ == "__main__":
    Worker(["ingestion"], connection=redis_conn).work()
