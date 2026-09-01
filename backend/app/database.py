from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # pre_ping avoids stale connection errors on managed postgres like supabase
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
                stmt = f"ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}"
                # a simple default like default="complete" also backfills onto existing rows
                if column.default is not None and getattr(column.default, "is_scalar", False):
                    default_value = column.default.arg
                    if isinstance(default_value, bool):
                        stmt += f" DEFAULT {int(default_value)}"
                    elif isinstance(default_value, (int, float)):
                        stmt += f" DEFAULT {default_value}"
                    elif isinstance(default_value, str):
                        stmt += f" DEFAULT '{default_value.replace(chr(39), chr(39) + chr(39))}'"
                conn.execute(text(stmt))

def init_db():
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
