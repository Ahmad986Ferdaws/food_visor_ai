import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.recommendation import RecommendationRequest, AgentOutput, Feedback
from app.schemas.recommendation import (
    RecommendationCreate, RecommendationResponse, RecommendationDetail,
    FeedbackCreate, HistoryItem, AgentOutputOut,
)
from app.tasks.orchestrator import process_recommendation
from app.utils.sensitive_mode import detect_sensitive_mode

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("/", response_model=RecommendationResponse, status_code=status.HTTP_201_CREATED)
def create_recommendation(
    body: RecommendationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create new recommendation request and enqueue pipeline."""
    sensitive = detect_sensitive_mode(body.message)

    request = RecommendationRequest(
        user_id=current_user.id,
        message=body.message,
        context_override=body.context_override,
        sensitive_mode=sensitive,
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    # Enqueue Celery task
    process_recommendation.delay(str(request.id))

    return RecommendationResponse(
        request_id=str(request.id),
        status=request.status.value,
        created_at=request.created_at,
    )


@router.get("/{request_id}", response_model=RecommendationDetail)
def get_recommendation(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get recommendation status and result."""
    request = db.query(RecommendationRequest).filter_by(id=request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if str(request.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    response = RecommendationDetail(
        request_id=str(request.id),
        status=request.status.value,
        message=request.message,
        created_at=request.created_at,
        completed_at=request.completed_at,
        error_message=request.error_message,
    )

    # Add agent outputs if terminal state
    if request.status.value in ("completed", "failed"):
        outputs = db.query(AgentOutput).filter_by(request_id=request_id).order_by(AgentOutput.agent_number).all()
        response.agent_outputs = [
            AgentOutputOut(agent=ao.agent_number, output=ao.output, tokens_used=ao.tokens_used, latency_ms=ao.latency_ms)
            for ao in outputs
        ]
        agent3 = next((ao for ao in outputs if ao.agent_number == 3), None)
        if agent3:
            response.result = agent3.output

    return response


@router.post("/{request_id}/feedback", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    request_id: uuid.UUID,
    body: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit feedback on a recommendation."""
    request = db.query(RecommendationRequest).filter_by(id=request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if str(request.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    feedback = Feedback(
        request_id=request_id,
        user_id=current_user.id,
        rating=body.rating,
        liked_items=body.liked_items,
        disliked_items=body.disliked_items,
    )
    db.add(feedback)
    db.commit()

    return {"success": True, "message": "Feedback recorded"}


@router.get("/", response_model=List[HistoryItem])
def list_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's recommendation history."""
    requests = (
        db.query(RecommendationRequest)
        .filter_by(user_id=current_user.id)
        .order_by(RecommendationRequest.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        HistoryItem(
            request_id=str(r.id),
            message=r.message,
            status=r.status.value,
            created_at=r.created_at,
            completed_at=r.completed_at,
        )
        for r in requests
    ]
