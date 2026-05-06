"""Agent 1 — Context Builder.

Reads user input + prior user data from PostgreSQL and outputs compact structured context.
"""

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.agents.base import BaseAgent, AgentInput, AgentOutput
from app.config import get_settings
from app.models import User, UserPreference, Interaction

settings = get_settings()


class ContextBuilderAgent(BaseAgent):
    name = "context_builder"

    def run(self, inp: AgentInput) -> AgentOutput:
        self._log(f"Building context for interaction={inp.interaction_id}")

        engine = create_engine(settings.DATABASE_URL_SYNC)
        with Session(engine) as db:
            # Fetch user preferences
            prefs = db.execute(
                select(UserPreference).where(UserPreference.user_id == inp.user_id)
            ).scalars().all()

            pref_map = {}
            for p in prefs:
                pref_map.setdefault(p.category, []).append({"key": p.key, "value": p.value, "weight": p.weight})

            # Fetch recent interactions for history
            recent = db.execute(
                select(Interaction)
                .where(Interaction.user_id == inp.user_id)
                .order_by(Interaction.created_at.desc())
                .limit(5)
            ).scalars().all()

            history = [{"message": i.message, "status": i.status.value} for i in recent if str(i.id) != inp.interaction_id]

        context = {
            "user_id": inp.user_id,
            "message": inp.message if not inp.sensitive_mode else self._sanitize(inp.message),
            "preferences": pref_map,
            "recent_history": history[:3],
            "context_override": inp.context,
            "sensitive_mode": inp.sensitive_mode,
        }

        self._log(f"Context built with {len(pref_map)} pref categories")
        return AgentOutput(success=True, data={"context": context})

    @staticmethod
    def _sanitize(text: str) -> str:
        """Strip potentially sensitive details (medication names, allergies) from raw text.
        Placeholder — replace with NER-based redaction in production.
        """
        # MVP: pass-through with a flag; real impl uses NER
        return text
