# run this as a separate process alongside the API server: python worker.py
from rq import Worker
from app.core.queue import redis_conn

if __name__ == "__main__":
    Worker(["ingestion"], connection=redis_conn).work()
