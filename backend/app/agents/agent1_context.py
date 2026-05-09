"""Agent 1: Context Builder.

Actively queries the database on every run to build a complete context for the pipeline:
  • Allergies + dietary restrictions
  • Daily macro/water limits
  • Today's logged meals + running totals + remaining budget
  • Past 7-day meal history (to spot patterns / repetition)
  • Recent recommendation runs (last 10) for short-term memory
  • Preferences (liked / disliked / goals)

If the request includes a photo (context_override.photo_data_url), this agent calls
Claude Sonnet's multimodal API to identify food items and estimate macros.

Falls back gracefully (keyword extraction, no vision analysis) when AGENT1_API_KEY is
absent or the SDK is missing — the rest of the pipeline still runs.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List, Tuple

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import UserPreferences, MealLog
from app.models.recommendation import RecommendationRequest, AgentOutput
from app.utils.sensitive_mode import detect_sensitive_mode, sanitize_context

settings = get_settings()
logger = logging.getLogger(__name__)


DEFAULT_DAILY_LIMITS = {
    "calories": 2000,
    "protein_g": 100,
    "carbs_g": 250,
    "fat_g": 65,
    "sugar_g": 30,
    "water_l": 2.5,
}


def run_agent1(db: Session, request_id: str) -> Dict[str, Any]:
    """Build complete context from DB + (optional) image analysis."""
    request = db.query(RecommendationRequest).filter_by(id=request_id).first()
    if not request:
        raise ValueError(f"Request {request_id} not found")

    user_id = request.user_id
    prefs = db.query(UserPreferences).filter_by(user_id=user_id).first()
    sensitive_mode = detect_sensitive_mode(request.message)
    if sensitive_mode:
        request.sensitive_mode = True
        db.add(request)
        db.commit()

    # ── Active DB queries ─────────────────────────────────────
    daily_limits = _resolve_daily_limits(prefs)
    today_logs, today_totals = _todays_logs_and_totals(db, user_id)
    weekly_history = _weekly_meal_history(db, user_id)
    recent_runs = _recent_recommendation_runs(db, user_id, limit=10)
    remaining_budget = _compute_remaining(daily_limits, today_totals)

    # ── Photo (if any) ───────────────────────────────────────
    ctx_override = request.context_override or {}
    photo_data_url: Optional[str] = ctx_override.get("photo_data_url")
    photo_filename: Optional[str] = ctx_override.get("photo_filename")
    uploaded_food_analysis: Optional[Dict[str, Any]] = None
    if photo_data_url:
        uploaded_food_analysis = _analyze_food_photo(photo_data_url, request.message)
        logger.info(f"Agent1 vision analysis: {uploaded_food_analysis.get('summary') if uploaded_food_analysis else 'failed'}")

    # ── Intent extraction (text-side) ─────────────────────────
    extracted = _extract_intent_with_claude(request.message, has_photo=bool(photo_data_url))

    base_constraints = list(prefs.dietary_constraints) if prefs else []
    base_goals = list(prefs.goals) if prefs else []
    inferred_constraints = extracted.get("inferred_dietary_constraints") or []
    inferred_goals = extracted.get("inferred_goals") or []
    merged_constraints = list({*base_constraints, *inferred_constraints})
    merged_goals = list({*base_goals, *inferred_goals})

    medical_conditions = list(prefs.medical_conditions) if prefs and prefs.medical_conditions else []

    # The "About Me" snapshot — the single source of truth the downstream agents must
    # honor. Anything that contradicts this block (e.g. an allergen ingredient) is a
    # hard fail in Agent 3.
    about_me_profile = {
        "source": "about_me_page",
        "display_name": (prefs.display_name if prefs else None) or "there",
        "allergies": prefs.allergies if prefs else [],
        "medical_conditions": medical_conditions,
        "dietary_constraints": base_constraints,
        "goals": base_goals,
        "liked_items": (prefs.liked_items if prefs else [])[:10],
        "disliked_items": (prefs.disliked_items if prefs else [])[:10],
        "daily_limits": daily_limits,
    }

    context: Dict[str, Any] = {
        "user_id": str(user_id),
        "display_name": (prefs.display_name if prefs else None) or "there",
        "intent": extracted.get("intent", "general_nutrition_recommendation"),
        "dietary_constraints": merged_constraints,
        "allergies": prefs.allergies if prefs else [],
        "medical_conditions": medical_conditions,
        "goals": merged_goals,
        "recent_preferences": {
            "liked": (prefs.liked_items if prefs else [])[:10],
            "disliked": (prefs.disliked_items if prefs else [])[:10],
        },
        "about_me_profile": about_me_profile,
        "message": request.message,
        "sensitive_mode": sensitive_mode,
        "context_override": ctx_override,

        # ── Active-query data ──
        "daily_limits": daily_limits,
        "today_totals": today_totals,
        "remaining_budget": remaining_budget,
        "today_logs": today_logs,
        "weekly_history": weekly_history,
        "recent_runs": recent_runs,

        # ── Photo (if any) ──
        "has_photo": bool(photo_data_url),
        "photo_filename": photo_filename,
        "uploaded_food_analysis": uploaded_food_analysis,
    }

    if sensitive_mode:
        logger.info("Sensitive mode active — sanitizing context")
        context = sanitize_context(context)

    context["token_estimate"] = len(json.dumps(context, default=str)) // 4
    logger.info(
        f"Agent1 context built request={request_id} intent={context['intent']} "
        f"remaining_kcal={remaining_budget.get('calories')} weekly_meals={len(weekly_history)}"
    )
    return context


# ─── DB helpers ──────────────────────────────────────────────────────────────

def _resolve_daily_limits(prefs: Optional[UserPreferences]) -> Dict[str, float]:
    limits = dict(DEFAULT_DAILY_LIMITS)
    if prefs and prefs.daily_limits:
        for k, v in prefs.daily_limits.items():
            if isinstance(v, (int, float)):
                limits[k] = v
    return limits


def _todays_logs_and_totals(db: Session, user_id) -> Tuple[List[Dict[str, Any]], Dict[str, float]]:
    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = (
        db.query(MealLog)
        .filter(MealLog.user_id == user_id, MealLog.eaten_at >= start_of_day)
        .order_by(MealLog.eaten_at.asc())
        .all()
    )
    logs = [_meal_log_to_dict(r) for r in rows]
    totals = {
        "calories": sum(r.calories or 0 for r in rows),
        "protein_g": sum(r.protein_g or 0 for r in rows),
        "carbs_g": sum(r.carbs_g or 0 for r in rows),
        "fat_g": sum(r.fat_g or 0 for r in rows),
        "sugar_g": sum(r.sugar_g or 0 for r in rows),
    }
    return logs, totals


def _weekly_meal_history(db: Session, user_id) -> List[Dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    rows = (
        db.query(MealLog)
        .filter(MealLog.user_id == user_id, MealLog.eaten_at >= cutoff)
        .order_by(MealLog.eaten_at.desc())
        .limit(40)
        .all()
    )
    return [_meal_log_to_dict(r) for r in rows]


def _recent_recommendation_runs(db: Session, user_id, limit: int = 10) -> List[Dict[str, Any]]:
    rows = (
        db.query(RecommendationRequest)
        .filter(RecommendationRequest.user_id == user_id)
        .order_by(RecommendationRequest.created_at.desc())
        .limit(limit)
        .all()
    )
    runs: List[Dict[str, Any]] = []
    for r in rows:
        agent3 = (
            db.query(AgentOutput)
            .filter_by(request_id=r.id, agent_number=3)
            .first()
        )
        meal_name = None
        if agent3 and isinstance(agent3.output, dict):
            rec = agent3.output.get("final_recommendation") or {}
            meal_name = rec.get("meal_name")
        runs.append({
            "request_id": str(r.id),
            "message": r.message,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "meal_name": meal_name,
        })
    return runs


def _compute_remaining(limits: Dict[str, float], totals: Dict[str, float]) -> Dict[str, float]:
    return {k: round(limits.get(k, 0) - totals.get(k, 0), 1) for k in limits.keys() if k != "water_l"}


def _meal_log_to_dict(m: MealLog) -> Dict[str, Any]:
    return {
        "meal_name": m.meal_name,
        "meal_type": m.meal_type,
        "calories": m.calories,
        "protein_g": m.protein_g,
        "carbs_g": m.carbs_g,
        "fat_g": m.fat_g,
        "sugar_g": m.sugar_g,
        "eaten_at": m.eaten_at.isoformat() if m.eaten_at else None,
        "source": m.source,
    }


# ─── Vision (Claude multimodal) ──────────────────────────────────────────────

def _analyze_food_photo(data_url: str, user_message: str) -> Optional[Dict[str, Any]]:
    """Send a base64 image to Claude Sonnet's vision API and return structured analysis."""
    api_key = settings.AGENT1_API_KEY
    if not _has_valid_key(api_key):
        logger.info("Agent1 vision skipped — no valid API key")
        return None

    try:
        from anthropic import Anthropic
    except ImportError:
        logger.warning("anthropic SDK not installed — vision skipped")
        return None

    media_type, b64 = _parse_data_url(data_url)
    if not b64:
        logger.warning("Could not parse photo data URL")
        return None

    try:
        client = Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=settings.AGENT1_MODEL_NAME,
            max_tokens=1500,
            system=VISION_ANALYZER_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            f"User context note (may be empty): {user_message or '(no text)'}\n\n"
                            "Analyze the image per your system instructions and return the JSON object only."
                        ),
                    },
                ],
            }],
        )
        text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
        return _parse_json_loose(text)
    except Exception as e:
        logger.warning(f"Agent1 vision call failed: {e}")
        return None


# ─── Vision/Analyzer system prompt ───────────────────────────────────────────
# This is the ONLY agent that looks at pixels. It must NOT make medical or dietary
# recommendations — that's the Advisor's job. It must NOT read the user profile —
# that's the Data agent's job. Its sole role: hyper-accurate visual identification
# with explicit hidden-ingredient flagging.
VISION_ANALYZER_SYSTEM_PROMPT = (
    "ROLE: You are the Vision/Analyzer Agent. Your sole job is hyper-accurate visual "
    "identification of food, portion estimation, macro estimation, and exhaustive allergen "
    "flagging — including HIDDEN ingredients. You do NOT give dietary advice, you do NOT "
    "judge whether the user can eat this, and you do NOT reference any user profile. Just "
    "describe what you see and what is plausibly inside.\n\n"

    "OUTPUT: A single JSON object — NO prose, NO markdown fences. Required keys:\n"
    "  summary: one-line plain description of the dish (e.g. 'Grilled chicken Caesar salad with croutons').\n"
    "  visible_items: array of {name, portion, estimated_grams, confidence} — ONLY things you can see.\n"
    "  hidden_or_likely_items: array of {name, reason, likelihood} — things almost certainly present "
    "    but not directly visible, with the reason and likelihood ('high'|'medium'|'low').\n"
    "  estimated_nutrition: {calories, protein_g, carbs_g, fat_g, sugar_g, sodium_mg} — totals for the WHOLE plate.\n"
    "  allergen_flags: array of short strings, each from this canonical list when applicable: "
    "    'gluten', 'wheat', 'dairy', 'milk', 'butter', 'eggs', 'peanuts', 'tree_nuts', 'almonds', "
    "    'cashews', 'walnuts', 'pecans', 'soy', 'sesame', 'shellfish', 'fish', 'pork', 'beef', "
    "    'cooking_oil', 'added_sugar', 'high_sodium'. Include flags from BOTH visible_items AND hidden_or_likely_items.\n"
    "  confidence: float 0..1 — your overall confidence in the identification.\n"
    "  image_quality_issues: array of short strings, e.g. ['poor lighting','partially obscured'] — "
    "    empty array if the photo is clear.\n\n"

    "HIDDEN-INGREDIENT RULES (this is critical — most allergen incidents come from hidden ingredients):\n"
    "  • Salads almost always contain dressing — flag 'dairy' if creamy, plus 'cooking_oil' as 'high'.\n"
    "  • Pesto contains pine nuts AND often tree nuts — always flag 'tree_nuts' as 'high' for pesto.\n"
    "  • Asian dishes often contain peanuts, soy sauce (soy + gluten), sesame oil — flag accordingly.\n"
    "  • Baked goods almost always contain wheat/gluten + eggs + butter (dairy) — flag all three unless clearly labeled.\n"
    "  • Restaurant/diner foods are typically cooked in shared oil — flag 'cooking_oil' and note cross-contamination risk.\n"
    "  • Sauces, gravies, and curries frequently hide dairy (cream, butter, ghee), flour (gluten), or nuts (cashew cream).\n"
    "  • Fried foods are almost always coated in flour or breadcrumbs — flag 'gluten' as 'high' unless visibly gluten-free.\n"
    "  • Energy bars, granola, and trail mixes typically contain tree nuts and added sugar.\n\n"

    "PORTION ESTIMATION:\n"
    "  • Use visual references: standard plate ~25cm, dinner fork ~20cm, palm-sized chicken breast ~150g.\n"
    "  • If portion is ambiguous, give your best estimate and lower the confidence accordingly.\n\n"

    "QUALITY CHECK:\n"
    "  • If the photo is too blurry, dark, or angled to identify items reliably, set confidence < 0.4 "
    "    and populate image_quality_issues so the downstream Advisor can ask for a retake.\n"
    "  • NEVER invent items you cannot see and cannot reasonably infer.\n"
)


def _parse_data_url(data_url: str) -> Tuple[str, Optional[str]]:
    """Split 'data:image/jpeg;base64,XXXX' into ('image/jpeg', 'XXXX'). Defaults to image/jpeg."""
    try:
        if not data_url.startswith("data:"):
            return "image/jpeg", None
        header, b64 = data_url.split(",", 1)
        # header: 'data:image/jpeg;base64'
        media_type = "image/jpeg"
        if ";" in header:
            mt = header[5:].split(";", 1)[0]
            if mt:
                media_type = mt
        if media_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
            media_type = "image/jpeg"
        return media_type, b64
    except Exception:
        return "image/jpeg", None


# ─── Intent extraction ───────────────────────────────────────────────────────

def _extract_intent_with_claude(message: str, has_photo: bool = False) -> Dict[str, Any]:
    """Extract intent + inferred constraints/goals via Claude. Falls back to keywords."""
    api_key = settings.AGENT1_API_KEY
    if not _has_valid_key(api_key):
        logger.info("Agent1 — no valid API key, using keyword fallback")
        return {"intent": _extract_intent_keyword(message, has_photo), "inferred_dietary_constraints": [], "inferred_goals": []}

    try:
        from anthropic import Anthropic
    except ImportError:
        logger.warning("anthropic SDK not installed — using keyword fallback")
        return {"intent": _extract_intent_keyword(message, has_photo), "inferred_dietary_constraints": [], "inferred_goals": []}

    try:
        client = Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=settings.AGENT1_MODEL_NAME,
            max_tokens=512,
            system=(
                "You analyze nutrition requests and return a single JSON object — no prose. "
                "Required keys: "
                'intent (one of: "breakfast_recommendation", "lunch_recommendation", '
                '"dinner_recommendation", "snack_recommendation", "meal_plan_recommendation", '
                '"high_protein_recommendation", "low_calorie_recommendation", '
                '"photo_eat_check", "general_nutrition_recommendation"), '
                "inferred_dietary_constraints (array of strings), "
                "inferred_goals (array of strings). "
                "If has_photo is true, prefer photo_eat_check."
            ),
            messages=[{"role": "user", "content": f"has_photo: {has_photo}\nUser request: {message or '(no text — photo only)'}"}],
        )
        text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
        parsed = _parse_json_loose(text) or {}
        intent = parsed.get("intent") or _extract_intent_keyword(message, has_photo)
        constraints = parsed.get("inferred_dietary_constraints") or []
        goals = parsed.get("inferred_goals") or []
        if not isinstance(constraints, list): constraints = []
        if not isinstance(goals, list): goals = []
        logger.info(f"Agent1 Claude extraction: intent={intent}")
        return {
            "intent": intent,
            "inferred_dietary_constraints": [str(c) for c in constraints],
            "inferred_goals": [str(g) for g in goals],
        }
    except Exception as e:
        logger.warning(f"Agent1 Claude call failed ({e}) — using keyword fallback")
        return {"intent": _extract_intent_keyword(message, has_photo), "inferred_dietary_constraints": [], "inferred_goals": []}


def _extract_intent_keyword(message: str, has_photo: bool = False) -> str:
    if has_photo:
        return "photo_eat_check"
    msg = (message or "").lower()
    if any(w in msg for w in ["breakfast", "morning"]): return "breakfast_recommendation"
    if any(w in msg for w in ["lunch", "midday"]): return "lunch_recommendation"
    if any(w in msg for w in ["dinner", "evening", "supper"]): return "dinner_recommendation"
    if "snack" in msg: return "snack_recommendation"
    if "meal plan" in msg: return "meal_plan_recommendation"
    if any(w in msg for w in ["high protein", "protein"]): return "high_protein_recommendation"
    if any(w in msg for w in ["low calorie", "diet", "weight"]): return "low_calorie_recommendation"
    return "general_nutrition_recommendation"


def _has_valid_key(key: str) -> bool:
    if not key: return False
    if key.startswith("sk-CHANGE") or key.startswith("sk-ant-CHANGE"): return False
    return True


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
