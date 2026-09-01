from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    google_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    slack_bot_token = Column(String, nullable=True)
    notion_api_key = Column(String, nullable=True)
    preferred_provider = Column(String, nullable=True)
    api_keys_encrypted = Column(Text, nullable=True)
    current_workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    files = relationship("File", back_populates="owner")
    chat_history = relationship("ChatHistory", back_populates="user")

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("WorkspaceMember", back_populates="workspace")

class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null until the invited email signs up
    invited_email = Column(String, nullable=False)
    role = Column(String, default="viewer")  # owner, editor, viewer
    status = Column(String, default="active")  # active, invited
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User")

class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)  # null = personal file, not shared
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    extracted_text = Column(Text, nullable=True)
    source = Column(String, default="local")
    source_type = Column(String, default="local")
    external_id = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="files")
    chunks = relationship("Chunk", back_populates="file")

class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("File", back_populates="chunks")
    embedding = relationship("Embedding", back_populates="chunk", uselist=False)

class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(Integer, primary_key=True, index=True)
    chunk_id = Column(Integer, ForeignKey("chunks.id"), unique=True, nullable=False)
    embedding_vector = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    chunk = relationship("Chunk", back_populates="embedding")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_history")
    citations = relationship("Citation", back_populates="chat")

class Citation(Base):
    __tablename__ = "citations"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chat_history.id"), nullable=False)
    chunk_id = Column(Integer, ForeignKey("chunks.id"), nullable=False)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    source_type = Column(String, default="local")
    confidence_score = Column(Float, nullable=True)

    chat = relationship("ChatHistory", back_populates="citations")

class QueryCache(Base):
    """Cache for query results to reduce LLM costs and improve response time"""
    __tablename__ = "query_cache"

    id = Column(Integer, primary_key=True, index=True)
    query_hash = Column(String(64), unique=True, index=True, nullable=False)  # SHA-256 hash of normalized question
    question = Column(Text, nullable=False)  # Original question text
    answer = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # JSON string of sources
    hit_count = Column(Integer, default=1)  # Number of times this cache entry was used
    last_accessed = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # Optional expiration

class SyncedFile(Base):
    """Track synced files from external sources (Google Drive, etc.)"""
    __tablename__ = "synced_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    external_id = Column(String, nullable=False)  # Google Drive file ID, etc.
    source = Column(String, nullable=False)  # 'google_drive', 'dropbox', etc.
    filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    size = Column(Integer, nullable=True)  # File size in bytes
    checksum = Column(String, nullable=True)  # MD5 or SHA hash for change detection
    last_modified = Column(DateTime, nullable=True)  # Last modified time from source
    local_file_id = Column(Integer, ForeignKey("files.id"), nullable=True)  # Reference to local File
    sync_status = Column(String, default="active")  # active, error, deleted
    last_synced = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Unique constraint: one external file per user per source
    # This is enforced at the database level
    # Can be added via Alembic migration: UniqueConstraint('user_id', 'external_id', 'source', name='uix_synced_file')"

class CostTracking(Base):
    """Track LLM API usage and costs per user"""
    __tablename__ = "cost_tracking"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)  # 'mistral', 'ollama', etc.
    operation = Column(String, nullable=False)  # 'chat', 'embedding', 'token_usage'
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_usd = Column(Numeric(10, 6), default=0.0)  # Cost in USD with 6 decimal places
    request_count = Column(Integer, default=1)
    extra_data = Column(Text, nullable=True)  # JSON string for additional data
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="cost_tracking")

class BudgetSetting(Base):
    """User budget settings and alerts"""
    __tablename__ = "budget_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    monthly_budget = Column(Numeric(10, 2), default=50.00)  # Monthly budget in USD
    alert_threshold = Column(Numeric(5, 2), default=0.80)  # Alert at 80% of budget
    alert_email = Column(String, nullable=True)
    last_alert_sent = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="budget_setting", uselist=False)
