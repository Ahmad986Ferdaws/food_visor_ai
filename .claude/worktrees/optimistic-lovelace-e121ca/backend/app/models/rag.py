import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector

from app.database import Base


class RAGDocument(Base):
    __tablename__ = "rag_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content = Column(Text, nullable=False)
    metadata_ = Column("metadata", JSONB, nullable=False)  # {source, category, tags, nutrition}
    embedding = Column(Vector(1024))  # NeMo Retriever 300M v2 dimension
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
