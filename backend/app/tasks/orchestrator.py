"""Celery orchestrator — Router + 3-agent pipeline.

Flow:
   Router → (Vision?) → Agent1 context build → Retrieval → Agent2 (Advisor) →
   Agent3 (Gatekeeper) → Finalize.
   Any sub-agent failure routes to the Advisor fallback so the user always
   gets a graceful, conversational reply rather than a crash.

Each step updates status in DB. Agents communicate ONLY via PostgreSQL.
"""

import time
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from celery import Celery
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models.recommendation import (
    RecommendationRequest, AgentOutput, RequestStatus,
)
from app.agents.agent1_context import run_agent1
from app.agents.agent2_recommender import run_agent2
from app.agents.agent3_validator import run_agent3
from app.agents.router import classify_request, RouteDecision
from app.services.embedding_service import embed_query
from app.services.rag_service import retrieve_documents

settings = get_settings()
logger = logging.getLogger(__name__)

celery_app = Celery(
    "foodvisor",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_time_limit=settings.TASK_TIMEOUT,
    task_soft_time_limit=settings.TASK_TIMEOUT - 10,
    task_default_retry_delay=2,
)


def _update_status(db: Session, request_id: str, status: RequestStatus, error: str | None = None):
    req = db.query(RecommendationRequest).filter_by(id=request_id).first()
    if req:
        req.status = status
        if error:
            req.error_message = error
        if status in (RequestStatus.COMPLETED, RequestStatus.FAILED):
            req.completed_at = datetime.now(timezone.utc)
        db.commit()


def _save_agent_output(db: Session, request_id: str, agent_num: int, output: dict, latency_ms: int):
    ao = AgentOutput(
        request_id=request_id,
        agent_number=agent_num,
        output=output,
        latency_ms=latency_ms,
    )
    db.add(ao)
    db.commit()


def _load_prior_context(db: Session, prior_request_id: str) -> Optional[Dict[str, Any]]:
    """Pull the photo analysis + final recommendation from a prior request so a
    follow-up question (e.g. 'can I eat half of it instead?') can reuse them
    without making the user re-upload."""
    if not prior_request_id:
        return None
    try:
        outputs = (
            db.query(AgentOutput)
            .filter_by(request_id=prior_request_id)
            .all()
        )
    except Exception:
        return None

    prior_a1 = next((o.output for o in outputs if o.agent_number == 1), None)
    prior_a3 = next((o.output for o in outputs if o.agent_number == 3), None)
    if not prior_a1 and not prior_a3:
        return None
    return {
        "uploaded_food_analysis": (prior_a1 or {}).get("uploaded_food_analysis"),
        "prior_recommendation": (prior_a3 or {}).get("final_recommendation"),
        "prior_decision": (prior_a3 or {}).get("decision"),
    }


def _advisor_fallback(reason: str, friendly_message: str) -> Dict[str, Any]:
    """Wrap any pipeline failure in the Advisor's voice — never crash, never hallucinate."""
    return {
        "decision": "try_alternative",
        "verdict_reason": friendly_message,
        "validation_result": "advisor_fallback",
        "final_recommendation": {
            "decision": "try_alternative",
            "verdict_reason": friendly_message,
            "meal_name": "Let's try this another way",
            "description": friendly_message,
            "ingredients": [],
            "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "sugar": 0},
            "preparation": "",
            "prep_time_minutes": 0,
            "tags": ["advisor_fallback"],
        },
        "changes_made": [],
        "confidence_score": 0.5,
        "fallback_reason": reason,
    }


@celery_app.task(bind=True, name="process_recommendation", max_retries=2, default_retry_delay=2)
def process_recommendation(self, request_id: str):
    """Main orchestration task — runs the Router, then the appropriate sub-agents."""
    db: Session = SessionLocal()

    try:
        request = db.query(RecommendationRequest).filter_by(id=request_id).first()
        if not request:
            logger.error(f"Request {request_id} not found")
            return

        ctx_override = request.context_override or {}
        has_photo = bool(ctx_override.get("photo_data_url"))

        # ── Stage 0: Router — decide the route ────────────
        route: RouteDecision = classify_request(
            message=request.message or "",
            has_photo=has_photo,
            context_override=ctx_override,
        )
        logger.info(f"Router decision for {request_id}: {route.route} — {route.reason}")

        # If the user is asking for follow-up advice, fold prior context into the override
        # so Agent 1 picks it up exactly like a fresh upload.
        prior_context: Optional[Dict[str, Any]] = None
        if route.prior_request_id:
            prior_context = _load_prior_context(db, route.prior_request_id)
            if prior_context and prior_context.get("uploaded_food_analysis"):
                # Make the prior vision analysis available to Agent 1 without re-running Vision.
                ctx_override = {**ctx_override, "prior_uploaded_food_analysis": prior_context["uploaded_food_analysis"]}
                # Persist for Agent 1 to read.
                request.context_override = ctx_override
                db.add(request)
                db.commit()

        # ── Stage 1: Agent 1 — Context Builder (+ Vision when route allows) ─────
        _update_status(db, request_id, RequestStatus.RUNNING_AGENT1)

        # If the router said "no vision", strip the photo before Agent 1 looks at it.
        if not route.run_vision and has_photo:
            ctx_override = {k: v for k, v in ctx_override.items() if k != "photo_data_url"}
            request.context_override = ctx_override
            db.add(request)
            db.commit()

        t0 = time.time()
        try:
            agent1_output = run_agent1(db, request_id)
            agent1_output["_route"] = route.as_dict()
            # Stitch in prior analysis so downstream agents see it as if Vision had run.
            if prior_context and prior_context.get("uploaded_food_analysis") and not agent1_output.get("uploaded_food_analysis"):
                agent1_output["uploaded_food_analysis"] = prior_context["uploaded_food_analysis"]
                agent1_output["has_photo"] = True  # virtual photo via prior context
            _save_agent_output(db, request_id, 1, agent1_output, int((time.time() - t0) * 1000))
        except Exception as exc:
            logger.exception(f"Agent 1 failed for {request_id}: {exc}")
            fallback = _advisor_fallback(
                f"Agent 1 failed: {exc}",
                "I'm having trouble loading your profile right now. Please try again in a moment — and if the photo is hard to read, a brighter retake usually does the trick.",
            )
            _save_agent_output(db, request_id, 3, fallback, 0)
            _update_status(db, request_id, RequestStatus.COMPLETED)
            return

        if not route.run_recommender:
            # Pure router-only routes (about_query) shouldn't actually reach here since the
            # frontend hits /about-summary directly, but in case they do, finalize cleanly.
            _update_status(db, request_id, RequestStatus.COMPLETED)
            return

        # ── Stage 2: Retrieval ─────────────────────────
        try:
            query_emb = embed_query(agent1_output.get("intent", ""))
            retrieved_docs = retrieve_documents(db, query_emb, settings.RAG_TOP_K)
        except Exception as e:
            logger.warning(f"RAG retrieval failed, continuing without: {e}")
            try: db.rollback()
            except Exception: pass
            retrieved_docs = []

        # ── Stage 3: Agent 2 — Advisor/Recommender ─────
        _update_status(db, request_id, RequestStatus.RUNNING_AGENT2)

        t0 = time.time()
        try:
            agent2_output = run_agent2(agent1_output, retrieved_docs)
            _save_agent_output(db, request_id, 2, agent2_output, int((time.time() - t0) * 1000))
        except Exception as exc:
            logger.exception(f"Agent 2 failed for {request_id}: {exc}")
            fallback = _advisor_fallback(
                f"Agent 2 failed: {exc}",
                "I couldn't put together a recommendation just now. Could you share a bit more — what kind of meal you're after, or how hungry you are?",
            )
            _save_agent_output(db, request_id, 3, fallback, 0)
            _update_status(db, request_id, RequestStatus.COMPLETED)
            return

        # ── Stage 4: Agent 3 — Data/Profile Gatekeeper ─
        if not route.run_gatekeeper:
            _save_agent_output(db, request_id, 3, agent2_output, 0)
            _update_status(db, request_id, RequestStatus.COMPLETED)
            return

        _update_status(db, request_id, RequestStatus.RUNNING_AGENT3)

        t0 = time.time()
        try:
            validation_result, agent3_output = run_agent3(db, agent2_output, agent1_output)
            _save_agent_output(db, request_id, 3, agent3_output, int((time.time() - t0) * 1000))
        except Exception as exc:
            logger.exception(f"Agent 3 failed for {request_id}: {exc}")
            fallback = _advisor_fallback(
                f"Agent 3 failed: {exc}",
                "I have a recommendation but couldn't finish the safety check. Out of caution, treat this as a draft until you've double-checked it against your allergies.",
            )
            _save_agent_output(db, request_id, 3, fallback, 0)
            _update_status(db, request_id, RequestStatus.COMPLETED)
            return

        # ── Stage 5: Finalize ────────────────────────
        if validation_result == "rejected":
            # 'Cannot eat' is still a successful, useful answer — not a failure.
            _update_status(db, request_id, RequestStatus.COMPLETED)
        else:
            _update_status(db, request_id, RequestStatus.COMPLETED)

        logger.info(f"Pipeline complete: request={request_id}, route={route.route}, result={validation_result}")

    except Exception as exc:
        logger.exception(f"Pipeline failed: request={request_id}")
        try:
            db.rollback()
            # Last-ditch advisor fallback — never leave the user with a raw failure.
            fallback = _advisor_fallback(
                f"Orchestrator crashed: {exc}",
                "Something went sideways on my end. Please try once more — and if it keeps happening, let me know what you were asking and I'll dig in.",
            )
            _save_agent_output(db, request_id, 3, fallback, 0)
            _update_status(db, request_id, RequestStatus.COMPLETED)
        except Exception:
            logger.error("Failed to write advisor fallback after pipeline error")
            try:
                _update_status(db, request_id, RequestStatus.FAILED, str(exc))
            except Exception:
                pass
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
    finally:
        db.close()
