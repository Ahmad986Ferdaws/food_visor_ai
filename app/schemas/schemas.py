import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Recommendations ─────────────────────────────────────
class RecommendationRequest(BaseModel):
    user_id: uuid.UUID
    message: str = Field(..., min_length=1, max_length=2000)
    context_override: dict | None = None


class RecommendationQueued(BaseModel):
    request_id: uuid.UUID
    status: str = "queued"


class AgentRunOut(BaseModel):
    agent_role: str
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None

    class Config:
        from_attributes = True


class RecommendationResult(BaseModel):
    request_id: uuid.UUID
    status: str
    items: list | None = None
    reasoning: str | None = None
    error: str | None = None
    agent_runs: list[AgentRunOut] = []
    created_at: datetime | None = None


# ── Feedback ────────────────────────────────────────────
class FeedbackRequest(BaseModel):
    user_id: uuid.UUID
    rating: int = Field(..., ge=1, le=5)
    liked: list[str] | None = None
    disliked: list[str] | None = None
    comment: str | None = None


class FeedbackResponse(BaseModel):
    id: uuid.UUID
    status: str = "recorded"


# ── RAG Ingest ──────────────────────────────────────────
class IngestItem(BaseModel):
    title: str | None = None
    content: str
    metadata: dict | None = None


class IngestRequest(BaseModel):
    source: str
    items: list[IngestItem] = Field(..., min_length=1)


class IngestResponse(BaseModel):
    ingested_count: int
    document_ids: list[uuid.UUID]


# ── Health ──────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "ok"
    env: str = ""
    db: str = "unknown"
    redis: str = "unknown"
