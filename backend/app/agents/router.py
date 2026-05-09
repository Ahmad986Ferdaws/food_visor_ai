"""Orchestrator / Router Agent.

Runs FIRST on every recommendation request. Its sole job is intent classification —
it never touches images, never writes the database, never speaks to the user. It
returns a structured `RouteDecision` that the orchestrator uses to decide which
sub-agents to invoke and which to skip.

Routes:
  • image_eat_check   — photo attached → run Vision → Recommender → Gatekeeper
  • dietary_question  — plain text request → run Recommender → Gatekeeper (skip Vision)
  • follow_up         — references a prior request → load prior context, then Recommender → Gatekeeper
  • profile_update    — user is asking to update their profile → return early, frontend should redirect
  • about_query       — user is asking 'what do you know about me' → call Advisor

The classifier is deterministic + keyword-driven so it never hallucinates a wrong
route. An LLM is NOT used here — a router that hallucinates is a footgun.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class RouteDecision:
    route: str                      # one of the routes listed above
    run_vision: bool                # call the Vision/Analyzer agent
    run_recommender: bool           # call the Recommender (Advisor synthesis)
    run_gatekeeper: bool            # call the Data/Profile Gatekeeper
    run_advisor_summary: bool       # call the standalone Advisor recap
    prior_request_id: Optional[str] = None
    reason: str = ""

    def as_dict(self) -> Dict[str, Any]:
        return {
            "route": self.route,
            "run_vision": self.run_vision,
            "run_recommender": self.run_recommender,
            "run_gatekeeper": self.run_gatekeeper,
            "run_advisor_summary": self.run_advisor_summary,
            "prior_request_id": self.prior_request_id,
            "reason": self.reason,
        }


_FOLLOWUP_PATTERNS = [
    r"\bhalf of (it|that|this)\b",
    r"\binstead\b.*\b(eat|have|try)\b",
    r"\bwhat about\b",
    r"\bcan i (still |also )?(have|eat|try)\b.*\b(it|that|this)\b",
    r"\bsame.*(thing|meal|dish)\b",
]
_PROFILE_UPDATE_PATTERNS = [
    r"\b(update|change|edit|set|add|remove)\b.*\b(my|the)\b.*(profile|allergy|allergies|condition|goal|limit|restriction)\b",
    r"\b(i'?m allergic to|i can'?t eat|i don'?t eat|i'?m on a)\b",
]
_ABOUT_QUERY_PATTERNS = [
    r"\bwhat do you know about me\b",
    r"\bhow much do you know\b",
    r"\bsummari[sz]e my (profile|history)\b",
    r"\btell me about myself\b",
]


def classify_request(
    *,
    message: str,
    has_photo: bool,
    context_override: Optional[Dict[str, Any]] = None,
) -> RouteDecision:
    """Decide which sub-agents to run for a given request."""
    msg = (message or "").strip().lower()
    ctx = context_override or {}

    prior = ctx.get("prior_request_id")
    if isinstance(prior, str) and not prior.strip():
        prior = None

    # 1. Image upload — always wins. Vision must run.
    if has_photo:
        return RouteDecision(
            route="image_eat_check",
            run_vision=True,
            run_recommender=True,
            run_gatekeeper=True,
            run_advisor_summary=False,
            prior_request_id=prior,
            reason="Photo attached — routing through Vision → Recommender → Gatekeeper.",
        )

    # 2. Explicit "what do you know about me" → Advisor recap path.
    if any(re.search(p, msg) for p in _ABOUT_QUERY_PATTERNS):
        return RouteDecision(
            route="about_query",
            run_vision=False,
            run_recommender=False,
            run_gatekeeper=False,
            run_advisor_summary=True,
            reason="User is asking for a profile recap — routing to Advisor.",
        )

    # 3. Profile-update language → frontend should redirect, but pipeline still
    #    safe-fails to a normal recommendation if it ever hits us.
    if any(re.search(p, msg) for p in _PROFILE_UPDATE_PATTERNS):
        return RouteDecision(
            route="profile_update",
            run_vision=False,
            run_recommender=True,
            run_gatekeeper=True,
            run_advisor_summary=False,
            reason="Detected profile-edit intent. Frontend should send the user to /app/about; falling through to a normal recommendation as a safety net.",
        )

    # 4. Follow-up — references a prior request via context_override or via language.
    is_followup = bool(prior) or any(re.search(p, msg) for p in _FOLLOWUP_PATTERNS)
    if is_followup:
        return RouteDecision(
            route="follow_up",
            run_vision=False,           # No new image — reuse prior analysis.
            run_recommender=True,
            run_gatekeeper=True,
            run_advisor_summary=False,
            prior_request_id=prior,
            reason="Detected follow-up to a prior request — reusing prior context.",
        )

    # 5. Default — a normal text dietary question.
    return RouteDecision(
        route="dietary_question",
        run_vision=False,
        run_recommender=True,
        run_gatekeeper=True,
        run_advisor_summary=False,
        reason="Plain text dietary question — Recommender → Gatekeeper.",
    )
