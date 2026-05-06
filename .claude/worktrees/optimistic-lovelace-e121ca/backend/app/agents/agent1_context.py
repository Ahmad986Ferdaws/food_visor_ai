"""Agent 1: Context Builder.

Reads user input + prior user data from PostgreSQL and outputs compact structured context.
Agents communicate ONLY via DB — no direct calls.
"""

import json
import logging
from typing import Dict, Any

from sqlalchemy.orm import Session

from app.models.user import UserPreferences
from app.models.recommendation import RecommendationRequest
from app.utils.sensitive_mode import detect_sensitive_mode, sanitize_context

logger = logging.getLogger(__name__)


def run_agent1(db: Session, request_id: str) -> Dict[str, Any]:
    """Build structured context from user data + request message."""
    request = db.query(RecommendationRequest).filter_by(id=request_id).first()
    if not request:
        raise ValueError(f"Request {request_id} not found")

    prefs = db.query(UserPreferences).filter_by(user_id=request.user_id).first()

    # Detect sensitive mode
    sensitive_mode = detect_sensitive_mode(request.message)

    # Update request
    if sensitive_mode:
        request.sensitive_mode = True
        db.add(request)
        db.commit()

    context: Dict[str, Any] = {
        "user_id": str(request.user_id),
        "intent": _extract_intent(request.message),
        "dietary_constraints": prefs.dietary_constraints if prefs else [],
        "allergies": prefs.allergies if prefs else [],
        "goals": prefs.goals if prefs else [],
        "recent_preferences": {
            "liked": (prefs.liked_items if prefs else [])[:10],
            "disliked": (prefs.disliked_items if prefs else [])[:10],
        },
        "message": request.message,
        "sensitive_mode": sensitive_mode,
        "context_override": request.context_override,
    }

    # Sanitize if sensitive
    if sensitive_mode:
        logger.info("Sensitive mode active — sanitizing context")
        context = sanitize_context(context)

    context["token_estimate"] = len(json.dumps(context)) // 4
    logger.info(f"Agent1 context built for request={request_id}, tokens~{context['token_estimate']}")

    return context


def _extract_intent(message: str) -> str:
    """Extract user intent from message (keyword matching for MVP)."""
    msg = message.lower()
    if any(w in msg for w in ["breakfast", "morning"]):
        return "breakfast_recommendation"
    elif any(w in msg for w in ["lunch", "midday"]):
        return "lunch_recommendation"
    elif any(w in msg for w in ["dinner", "evening", "supper"]):
        return "dinner_recommendation"
    elif "snack" in msg:
        return "snack_recommendation"
    elif "meal plan" in msg:
        return "meal_plan_recommendation"
    elif any(w in msg for w in ["high protein", "protein"]):
        return "high_protein_recommendation"
    elif any(w in msg for w in ["low calorie", "diet", "weight"]):
        return "low_calorie_recommendation"
    return "general_nutrition_recommendation"
