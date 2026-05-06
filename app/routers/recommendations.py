import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Interaction, User, AgentRun
from app.schemas.schemas import (
    RecommendationRequest,
    RecommendationQueued,
    RecommendationResult,
    AgentRunOut,
)
from app.services.sensitive import detect_sensitive
from app.worker.tasks import run_pipeline

router = APIRouter(prefix="/v1/recommendations", tags=["recommendations"])


@router.post("", response_model=RecommendationQueued, status_code=202)
async def create_recommendation(body: RecommendationRequest, db: AsyncSession = Depends(get_db)):
    # Ensure user exists (auto-create for MVP)
    user = await db.get(User, body.user_id)
    if not user:
        user = User(id=body.user_id)
        db.add(user)
        await db.flush()

    sensitive = detect_sensitive(body.message)

    interaction = Interaction(
        user_id=body.user_id,
        message=body.message,
        context_override=body.context_override,
        sensitive_mode=sensitive,
    )
    db.add(interaction)
    await db.flush()

    # Enqueue pipeline
    run_pipeline.delay(str(interaction.id))

    return RecommendationQueued(request_id=interaction.id)


@router.get("/{request_id}", response_model=RecommendationResult)
async def get_recommendation(request_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Interaction)
        .where(Interaction.id == request_id)
        .options(selectinload(Interaction.agent_runs), selectinload(Interaction.recommendation))
    )
    result = await db.execute(stmt)
    interaction = result.scalar_one_or_none()

    if not interaction:
        raise HTTPException(status_code=404, detail="Request not found")

    rec = interaction.recommendation
    return RecommendationResult(
        request_id=interaction.id,
        status=interaction.status.value,
        items=rec.items if rec else None,
        reasoning=rec.reasoning if rec else None,
        error=interaction.error,
        agent_runs=[AgentRunOut.model_validate(ar) for ar in interaction.agent_runs],
        created_at=interaction.created_at,
    )
