import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class RequestStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING_AGENT1 = "running_agent1"
    RUNNING_AGENT2 = "running_agent2"
    RUNNING_AGENT3 = "running_agent3"
    COMPLETED = "completed"
    FAILED = "failed"


class RecommendationRequest(Base):
    __tablename__ = "recommendation_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(SQLEnum(RequestStatus, name="request_status", create_constraint=True), nullable=False, default=RequestStatus.QUEUED)
    sensitive_mode = Column(Boolean, default=False)
    context_override = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="requests")
    agent_outputs = relationship("AgentOutput", back_populates="request", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="request", uselist=False, cascade="all, delete-orphan")


class AgentOutput(Base):
    __tablename__ = "agent_outputs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("recommendation_requests.id", ondelete="CASCADE"), nullable=False)
    agent_number = Column(Integer, nullable=False)  # 1, 2, or 3
    output = Column(JSONB, nullable=False)
    tokens_used = Column(Integer, default=0)
    latency_ms = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    request = relationship("RecommendationRequest", back_populates="agent_outputs")


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("recommendation_requests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    liked_items = Column(JSONB, default=list)
    disliked_items = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    request = relationship("RecommendationRequest", back_populates="feedback")
