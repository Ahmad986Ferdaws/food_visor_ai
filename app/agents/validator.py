"""Agent 3 — Validator.

Validates Agent 2 output against Agent 1 intent + user preference patterns.
Updates memory/preferences after validation.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.agents.base import BaseAgent, AgentInput, AgentOutput
from app.config import get_settings
from app.models import UserPreference

settings = get_settings()


class ValidatorAgent(BaseAgent):
    name = "validator"

    def run(self, inp: AgentInput) -> AgentOutput:
        self._log(f"Validating recommendations for interaction={inp.interaction_id}")

        context = inp.context or {}
        sensitive_mode = context.get("sensitive_mode", inp.sensitive_mode)

        # ── Validation logic (stub) ─────────────────────
        # TODO: Replace with actual LLM validation using settings.AGENT3_API_KEY
        issues: list[str] = []
        adjustments: dict = {}

        items = context.get("items", [])
        original_context = context.get("original_context", {})

        # Sensitive mode: stricter checks
        if sensitive_mode:
            self._log("Sensitive mode — applying strict validation")
            for item in items:
                title = item.get("title", "").lower()
                # Placeholder: flag items that might conflict with health context
                if any(word in title for word in ["alcohol", "raw", "unpasteurized"]):
                    issues.append(f"Flagged '{item.get('title')}' — sensitive mode restriction")

        # Basic confidence threshold check
        for item in items:
            if item.get("confidence", 0) < 0.5:
                issues.append(f"Low confidence on '{item.get('title')}'")

        passed = len(issues) == 0

        # ── Memory update (preference learning) ─────────
        if passed:
            self._update_preferences(inp.user_id, items)

        self._log(f"Validation {'passed' if passed else 'failed'} with {len(issues)} issues")
        return AgentOutput(
            success=True,
            data={
                "passed": passed,
                "issues": issues,
                "adjustments": adjustments,
                "validated_items": items,
            },
        )

    def _update_preferences(self, user_id: str, items: list[dict]):
        """Learn from validated recommendations to refine user preferences."""
        engine = create_engine(settings.DATABASE_URL_SYNC)
        with Session(engine) as db:
            for item in items:
                if item.get("confidence", 0) > 0.8:
                    # Boost preference for high-confidence accepted items
                    pref = UserPreference(
                        user_id=user_id,
                        category="learned",
                        key=item.get("title", "unknown"),
                        value="positive_signal",
                        weight=item.get("confidence", 0.5),
                    )
                    db.add(pref)
            db.commit()
            self._log(f"Updated preferences for user={user_id}")
