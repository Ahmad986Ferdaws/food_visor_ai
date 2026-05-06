"""Celery orchestrator — 3-agent pipeline.

Flow: Agent1 -> Retrieval -> Agent2 -> Agent3 -> Finalize
Each step updates status in DB. Agents communicate ONLY via PostgreSQL.
"""

import time
import logging
from datetime import datetime, timezone

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


@celery_app.task(bind=True, name="process_recommendation", max_retries=2, default_retry_delay=2)
def process_recommendation(self, request_id: str):
    """Main orchestration task — runs the full 3-agent pipeline."""
    db: Session = SessionLocal()

    try:
        # ── Stage 1: Agent 1 — Context Builder ───────
        _update_status(db, request_id, RequestStatus.RUNNING_AGENT1)

        t0 = time.time()
        agent1_output = run_agent1(db, request_id)
        _save_agent_output(db, request_id, 1, agent1_output, int((time.time() - t0) * 1000))

        # ── Stage 2: Retrieval (part of Agent 2) ─────
        try:
            query_emb = embed_query(agent1_output.get("intent", ""))
            retrieved_docs = retrieve_documents(db, query_emb, settings.RAG_TOP_K)
        except Exception as e:
            logger.warning(f"RAG retrieval failed, continuing without: {e}")
            # Rollback any broken transaction so the DB session stays usable
            try:
                db.rollback()
            except Exception:
                pass
            retrieved_docs = []

        # ── Stage 3: Agent 2 — Recommender ───────────
        _update_status(db, request_id, RequestStatus.RUNNING_AGENT2)

        t0 = time.time()
        agent2_output = run_agent2(agent1_output, retrieved_docs)
        _save_agent_output(db, request_id, 2, agent2_output, int((time.time() - t0) * 1000))

        # ── Stage 4: Agent 3 — Validator ─────────────
        _update_status(db, request_id, RequestStatus.RUNNING_AGENT3)

        t0 = time.time()
        validation_result, agent3_output = run_agent3(db, agent2_output, agent1_output)
        _save_agent_output(db, request_id, 3, agent3_output, int((time.time() - t0) * 1000))

        # ── Stage 5: Finalize ────────────────────────
        if validation_result == "rejected":
            _update_status(db, request_id, RequestStatus.FAILED, agent3_output.get("error", "Validation failed"))
        else:
            _update_status(db, request_id, RequestStatus.COMPLETED)

        logger.info(f"Pipeline complete: request={request_id}, result={validation_result}")

    except Exception as exc:
        logger.exception(f"Pipeline failed: request={request_id}")
        try:
            db.rollback()
            _update_status(db, request_id, RequestStatus.FAILED, str(exc))
        except Exception:
            logger.error("Failed to update status after pipeline error")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
    finally:
        db.close()
