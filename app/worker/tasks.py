"""Celery tasks — orchestration pipeline.

Flow: Agent1 -> Retrieval -> Agent2 -> Agent3 -> Finalize
Each step updates status in DB. Agents do NOT call each other.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.worker.celery_app import celery
from app.config import get_settings
from app.models.models import (
    Interaction, AgentRun, Recommendation, ValidationEvent,
    PipelineStatus, AgentRole, AgentRunStatus,
)
from app.agents.base import AgentInput, AgentOutput
from app.agents.context_builder import ContextBuilderAgent
from app.agents.recommender import RecommenderAgent
from app.agents.validator import ValidatorAgent
from app.services.sensitive import sanitize_for_logging

settings = get_settings()
logger = logging.getLogger(__name__)


def _get_sync_session() -> Session:
    engine = create_engine(settings.DATABASE_URL_SYNC)
    return Session(engine)


def _update_status(db: Session, interaction_id: str, status: PipelineStatus, error: str | None = None):
    interaction = db.get(Interaction, interaction_id)
    if interaction:
        interaction.status = status
        if error:
            interaction.error = error
        interaction.updated_at = datetime.now(timezone.utc)
        db.commit()


def _create_agent_run(db: Session, interaction_id: str, role: AgentRole) -> AgentRun:
    run = AgentRun(
        interaction_id=interaction_id,
        agent_role=role,
        status=AgentRunStatus.running,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _finish_agent_run(db: Session, run: AgentRun, output: AgentOutput):
    now = datetime.now(timezone.utc)
    run.status = AgentRunStatus.completed if output.success else AgentRunStatus.failed
    run.output_snapshot = output.data
    run.error = output.error
    run.finished_at = now
    if run.started_at:
        run.duration_ms = int((now - run.started_at).total_seconds() * 1000)
    db.commit()


@celery.task(bind=True, name="run_pipeline", max_retries=2, soft_time_limit=120)
def run_pipeline(self, interaction_id: str):
    """Main orchestration task — runs the full 3-agent pipeline sequentially."""
    db = _get_sync_session()

    try:
        interaction = db.get(Interaction, interaction_id)
        if not interaction:
            logger.error(f"Interaction {interaction_id} not found")
            return

        user_id = str(interaction.user_id)
        message = interaction.message
        sensitive = interaction.sensitive_mode

        log_msg = sanitize_for_logging(message, sensitive)
        logger.info(f"Pipeline start: interaction={interaction_id}, message={log_msg[:80]}")

        # ── Step 1: Agent 1 — Context Builder ───────────
        _update_status(db, interaction_id, PipelineStatus.running_agent1)
        agent1_run = _create_agent_run(db, interaction_id, AgentRole.context_builder)

        agent1 = ContextBuilderAgent()
        agent1_input = AgentInput(
            interaction_id=interaction_id,
            user_id=user_id,
            message=message,
            context=interaction.context_override,
            sensitive_mode=sensitive,
        )
        agent1_output = agent1.run(agent1_input)
        _finish_agent_run(db, agent1_run, agent1_output)

        if not agent1_output.success:
            _update_status(db, interaction_id, PipelineStatus.failed, agent1_output.error)
            return

        built_context = agent1_output.data.get("context", {})

        # ── Step 2 + 3: Agent 2 — Recommender (includes retrieval) ──
        _update_status(db, interaction_id, PipelineStatus.running_agent2)
        agent2_run = _create_agent_run(db, interaction_id, AgentRole.recommender)

        agent2 = RecommenderAgent()
        agent2_input = AgentInput(
            interaction_id=interaction_id,
            user_id=user_id,
            message=message,
            context=built_context,
            sensitive_mode=sensitive,
        )
        agent2_output = agent2.run(agent2_input)
        _finish_agent_run(db, agent2_run, agent2_output)

        if not agent2_output.success:
            _update_status(db, interaction_id, PipelineStatus.failed, agent2_output.error)
            return

        # Persist recommendation
        rec = Recommendation(
            interaction_id=interaction_id,
            items=agent2_output.data.get("items", []),
            reasoning=agent2_output.data.get("reasoning"),
            metadata_={"retrieval_count": agent2_output.data.get("retrieval_count", 0)},
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

        # ── Step 4: Agent 3 — Validator ─────────────────
        _update_status(db, interaction_id, PipelineStatus.running_agent3)
        agent3_run = _create_agent_run(db, interaction_id, AgentRole.validator)

        agent3 = ValidatorAgent()
        agent3_input = AgentInput(
            interaction_id=interaction_id,
            user_id=user_id,
            message=message,
            context={
                "items": agent2_output.data.get("items", []),
                "original_context": built_context,
                "sensitive_mode": sensitive,
            },
            sensitive_mode=sensitive,
        )
        agent3_output = agent3.run(agent3_input)
        _finish_agent_run(db, agent3_run, agent3_output)

        # Persist validation event
        validation = ValidationEvent(
            recommendation_id=rec.id,
            passed=agent3_output.data.get("passed", False),
            issues=agent3_output.data.get("issues"),
            adjustments=agent3_output.data.get("adjustments"),
        )
        db.add(validation)
        db.commit()

        # ── Step 5: Finalize ────────────────────────────
        if agent3_output.data.get("passed"):
            _update_status(db, interaction_id, PipelineStatus.completed)
        else:
            # Still complete, but with validation issues noted
            _update_status(db, interaction_id, PipelineStatus.completed)

        logger.info(f"Pipeline complete: interaction={interaction_id}")

    except Exception as exc:
        logger.exception(f"Pipeline failed: interaction={interaction_id}")
        _update_status(db, interaction_id, PipelineStatus.failed, str(exc))
        raise self.retry(exc=exc)
    finally:
        db.close()
