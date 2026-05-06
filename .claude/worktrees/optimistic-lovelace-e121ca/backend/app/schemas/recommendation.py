from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class RecommendationCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    context_override: Optional[Dict[str, Any]] = None


class RecommendationResponse(BaseModel):
    request_id: str
    status: str
    created_at: datetime


class AgentOutputOut(BaseModel):
    agent: int
    output: Dict[str, Any]
    tokens_used: int
    latency_ms: int


class RecommendationDetail(BaseModel):
    request_id: str
    status: str
    message: str
    result: Optional[Dict[str, Any]] = None
    agent_outputs: Optional[List[AgentOutputOut]] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    liked_items: List[str] = Field(default_factory=list)
    disliked_items: List[str] = Field(default_factory=list)


class HistoryItem(BaseModel):
    request_id: str
    message: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
