"""Advisor Agent — the user-facing voice.

Used by:
  • The "How much do you know about me?" button on the About Me page.
  • The orchestrator's graceful-fallback path when any sub-agent fails.

The Advisor reads the user's structured profile + recent tracking history and produces
a warm, encouraging, plain-language summary that pivots toward what the user CAN have
and how to feel better — never lecturing, never shaming. This is a separate agent
from the Recommender because the persona, tone, and output shape are different.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import User, UserPreferences, MealLog
from app.models.recommendation import RecommendationRequest

settings = get_settings()
logger = logging.getLogger(__name__)


ADVISOR_SYSTEM_PROMPT = (
    "ROLE: You are the Advisor Agent — the empathetic, user-facing voice of FoodVisor. "
    "You read the user's complete About Me profile and recent food log, then produce a "
    "warm, encouraging recap that demonstrates you understand them deeply.\n\n"

    "TONE & STYLE:\n"
    "  • Conversational, second-person, warm. Never clinical, never preachy.\n"
    "  • Lead with what they CAN have and what's working. Pivot quickly off restrictions.\n"
    "  • Acknowledge medical conditions and allergies factually, without alarm.\n"
    "  • Celebrate concrete wins from their history (consistent logging, hitting macros, etc.).\n"
    "  • Sound like a knowledgeable friend, not a doctor or coach.\n\n"

    "OUTPUT: Return a SINGLE JSON object — no markdown fences, no prose outside the JSON. "
    "Required keys:\n"
    "  greeting: one warm sentence using their display name.\n"
    "  i_know: array of 4–7 short bullet strings — the specific facts you've taken on board "
    "    (e.g. 'You manage type 2 diabetes and aim to keep blood sugar under 140 postprandial').\n"
    "  recent_observations: array of 2–4 short bullets about their last 7 days "
    "    (e.g. 'You've logged every day for the past week — that's the foundation').\n"
    "  safe_favorites: array of 4–6 specific foods that are SAFE for them, ideally drawn "
    "    from their liked_items, with a one-line 'why it works' note.\n"
    "  things_to_explore: array of 3–5 NEW dish or ingredient ideas they haven't tried "
    "    recently that fit all constraints — phrased as gentle invitations.\n"
    "  encouragement: one closing sentence that's specific to their situation, never generic.\n\n"

    "HARD RULES:\n"
    "  • Never recommend any food that matches their allergies — even casually mentioned.\n"
    "  • Never contradict their dietary_constraints or medical_conditions.\n"
    "  • Don't quote raw numbers if they'd feel clinical — round and contextualize.\n"
    "  • If a field is empty, gracefully omit it from i_know rather than saying 'none'.\n"
)


def run_advisor_summary(db: Session, user: User) -> Dict[str, Any]:
    """Generate the 'How much do you know about me?' recap for `user`."""
    prefs = db.query(UserPreferences).filter_by(user_id=user.id).first()

    # Pull last 7 days of meals so the recap is grounded in reality.
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent_meals: List[MealLog] = (
        db.query(MealLog)
        .filter(MealLog.user_id == user.id, MealLog.eaten_at >= cutoff)
        .order_by(MealLog.eaten_at.desc())
        .limit(40)
        .all()
    )

    # And a peek at the last few recommendation runs.
    recent_runs: List[RecommendationRequest] = (
        db.query(RecommendationRequest)
        .filter(RecommendationRequest.user_id == user.id)
        .order_by(RecommendationRequest.created_at.desc())
        .limit(5)
        .all()
    )

    profile_payload = {
        "display_name": (prefs.display_name if prefs else None) or user.email.split("@")[0],
        "email": user.email,
        "allergies": (prefs.allergies if prefs else []) or [],
        "medical_conditions": (prefs.medical_conditions if prefs else []) or [],
        "dietary_constraints": (prefs.dietary_constraints if prefs else []) or [],
        "goals": (prefs.goals if prefs else []) or [],
        "liked_items": (prefs.liked_items if prefs else []) or [],
        "disliked_items": (prefs.disliked_items if prefs else []) or [],
        "daily_limits": (prefs.daily_limits if prefs else {}) or {},
        "recent_meals": [
            {
                "meal_name": m.meal_name,
                "meal_type": m.meal_type,
                "calories": m.calories,
                "eaten_at": m.eaten_at.date().isoformat() if m.eaten_at else None,
            }
            for m in recent_meals
        ],
        "recent_requests": [
            {"message": r.message, "status": r.status.value if hasattr(r.status, "value") else str(r.status)}
            for r in recent_runs
        ],
    }

    advisor_json = _call_advisor_llm(profile_payload)
    if advisor_json is None:
        advisor_json = _deterministic_summary(profile_payload)

    advisor_json["meta"] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "meal_log_count": len(recent_meals),
        "model": settings.AGENT2_MODEL_NAME if _has_valid_advisor_key() else "deterministic_fallback",
    }
    return advisor_json


# ─── LLM call ────────────────────────────────────────────────────────────────

def _has_valid_advisor_key() -> bool:
    key = settings.AGENT2_API_KEY  # Reuse the recommender key — same OpenAI account.
    if not key: return False
    if key.startswith("sk-CHANGE") or key.startswith("sk-ant-CHANGE"): return False
    return True


def _call_advisor_llm(profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not _has_valid_advisor_key():
        logger.info("Advisor: no valid API key — using deterministic fallback")
        return None
    try:
        from openai import OpenAI
    except ImportError:
        logger.warning("openai SDK not installed — advisor falling back")
        return None

    try:
        client = OpenAI(api_key=settings.AGENT2_API_KEY)
        user_msg = (
            "Here is the user's full About Me profile and recent activity. "
            "Generate the JSON described in your system prompt.\n\n"
            f"{json.dumps(profile, indent=2)}"
        )
        # Try modern-token kwarg first, fall back to legacy.
        try:
            resp = client.chat.completions.create(
                model=settings.AGENT2_MODEL_NAME,
                messages=[
                    {"role": "system", "content": ADVISOR_SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                response_format={"type": "json_object"},
                max_completion_tokens=1200,
            )
        except Exception as e:
            if "max_completion_tokens" not in str(e):
                raise
            resp = client.chat.completions.create(
                model=settings.AGENT2_MODEL_NAME,
                messages=[
                    {"role": "system", "content": ADVISOR_SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                response_format={"type": "json_object"},
                max_tokens=1200,
                temperature=0.7,
            )
        text = resp.choices[0].message.content or ""
        return _parse_json_loose(text)
    except Exception as e:
        logger.warning(f"Advisor LLM call failed ({e}) — using deterministic fallback")
        return None


def _parse_json_loose(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    import re
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            return None
    return None


# ─── Deterministic fallback (always works) ───────────────────────────────────

def _deterministic_summary(p: Dict[str, Any]) -> Dict[str, Any]:
    name = p.get("display_name") or "there"
    allergies = p.get("allergies", [])
    medical = p.get("medical_conditions", [])
    constraints = p.get("dietary_constraints", [])
    goals = p.get("goals", [])
    liked = p.get("liked_items", [])
    daily = p.get("daily_limits", {}) or {}
    meals = p.get("recent_meals", [])

    i_know = []
    if medical:
        i_know.append(f"You're managing {', '.join(medical[:3])} — I keep that front of mind on every meal.")
    if allergies:
        i_know.append(f"You're allergic to {', '.join(allergies[:5])}, so those are on a permanent block list.")
    if constraints:
        i_know.append(f"Your eating style is {', '.join(constraints)} — every recommendation respects that.")
    if goals:
        i_know.append(f"Your goals: {', '.join(goals[:3])}.")
    if daily.get("calories"):
        i_know.append(f"Daily target is around {daily['calories']} kcal — I balance the day, not just the meal.")
    if liked:
        i_know.append(f"Foods you've told me you love: {', '.join(liked[:5])}.")

    recent_observations = []
    if meals:
        days = {m.get("eaten_at") for m in meals if m.get("eaten_at")}
        recent_observations.append(f"You've logged {len(meals)} meals across {len(days)} days in the past week — that consistency is the foundation of everything we do.")
        avg_cal = sum(m.get("calories", 0) for m in meals) / max(len(meals), 1)
        recent_observations.append(f"Your average meal is around {int(avg_cal)} kcal — well-paced.")
    else:
        recent_observations.append("We haven't logged meals together yet — when you do, I'll spot patterns and tailor everything to them.")

    # Safe favorites — pick from liked items the things that don't conflict with allergies/constraints.
    blocked = {a.lower() for a in allergies}
    safe_favorites = []
    for item in liked[:8]:
        if not any(b in item.lower() for b in blocked):
            safe_favorites.append(f"{item} — works beautifully within your plan.")
    if not safe_favorites:
        safe_favorites = [
            "Grilled fish with roasted vegetables — clean protein, lots of fiber.",
            "Greek yogurt with berries — gentle on blood sugar, satisfying.",
            "Quinoa bowls with leafy greens — naturally gluten-free and filling.",
        ]

    things_to_explore = [
        "Mediterranean-style sheet-pan dinners (cod, peppers, olives) — minimal prep, big flavor.",
        "Overnight oats made with rolled oats labeled gluten-free — perfect slow-release breakfast." if "gluten" in [a.lower() for a in allergies] or "gluten-free" in constraints else "Steel-cut oats with cinnamon — slow-release energy.",
        "Stuffed bell peppers with lean ground turkey — covers protein and produce in one pan.",
        "Chickpea-based pasta with tomato-basil sauce — high protein, low impact on blood sugar." if "type_2_diabetes" in [m.lower().replace(' ', '_') for m in medical] else "Roasted root vegetables with tahini — earthy and bright.",
    ]

    encouragement = (
        f"You're doing the work, {name}. I'll keep watching the details so you can keep choosing the foods that make you feel good."
    )

    return {
        "greeting": f"Hey {name} — here's what I've got on you so far.",
        "i_know": i_know,
        "recent_observations": recent_observations,
        "safe_favorites": safe_favorites,
        "things_to_explore": things_to_explore,
        "encouragement": encouragement,
    }
