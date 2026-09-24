import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy import Integer, Text, DateTime, ForeignKey, Index, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base, sync_engine, check_and_init_vector_extension
from app.core.config import settings

logger = logging.getLogger(__name__)

is_vector_ready = check_and_init_vector_extension()

if is_vector_ready:
    try:
        from pgvector.sqlalchemy import Vector
        EmbeddingColumnType = Vector(settings.EMBEDDING_DIM)
    except Exception:
        EmbeddingColumnType = ARRAY(Float)
else:
    EmbeddingColumnType = ARRAY(Float)

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Store embedding: supports both native pgvector Vector and PostgreSQL ARRAY(Float)
    embedding = mapped_column(EmbeddingColumnType, nullable=True)
    embedding_json: Mapped[list[float] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="chunks")
    document = relationship("Document", back_populates="chunks")

    __table_args__ = (
        Index("idx_document_chunks_tenant_doc", "tenant_id", "document_id"),
        Index("idx_document_chunks_tenant_idx", "tenant_id", "chunk_index"),
    )
