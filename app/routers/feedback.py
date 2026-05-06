import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Interaction, FeedbackEvent
from app.schemas.schemas import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/v1/recommendations", tags=["feedback"])


@router.post("/{request_id}/feedback", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    request_id: uuid.UUID,
    body: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    interaction = await db.get(Interaction, request_id)
    if not interaction:
        raise HTTPException(status_code=404, detail="Request not found")

    event = FeedbackEvent(
        interaction_id=request_id,
        user_id=body.user_id,
        rating=body.rating,
        liked=body.liked,
        disliked=body.disliked,
        comment=body.comment,
    )
    db.add(event)
    await db.flush()

    return FeedbackResponse(id=event.id)
