from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # Supabase (and most managed Postgres) drop idle connections; pre_ping
    # avoids "server closed the connection unexpectedly" on the next request.
    pool_pre_ping=not _is_sqlite,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _add_missing_columns():
    """Lightweight migration: add any model columns missing from existing tables (SQLite dev DB, no Alembic)."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.tables.values():
            if table.name not in inspector.get_table_names():
                continue
            existing_columns = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                col_type = column.type.compile(engine.dialect)
                conn.execute(text(f"ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}"))

def init_db():
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
