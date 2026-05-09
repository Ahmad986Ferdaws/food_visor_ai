"""Agent 2: Recommender.

Receives the rich Agent 1 context (preferences + daily limits + today's totals +
remaining budget + weekly history + optional photo analysis) and produces a
recommendation that fits within the remaining budget.

When a photo is attached, returns a `decision` field of `can_eat | cannot_eat |
try_alternative` along with a clear `verdict_reason`. When no photo is attached,
just returns a `try_alternative` recommendation (i.e. "here's what I'd suggest").

Falls back to a deterministic stub if AGENT2_API_KEY is absent or the SDK fails.
"""

import json
import re
import logging
from typing import Dict, Any, List

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "ROLE: You are the Advisor Agent. You are the empathetic, user-facing nutritionist "
    "who synthesizes the structured profile data and the Vision agent's analysis into a "
    "clear, kind, actionable verdict. You speak warmly and directly — never clinical, "
    "never preachy. You receive pre-validated structured data; trust it.\n\n"

    "CONTRACT WITH THE OTHER AGENTS:\n"
    "  • The 'About Me' block in the prompt is the canonical source of truth (allergies, "
    "    medical conditions, daily_limits, today's running totals). Read it first.\n"
    "  • If a 'UPLOADED PHOTO ANALYSIS' block is present, treat it as the Vision Agent's "
    "    output. Use its hidden_or_likely_items and allergen_flags as if you saw them yourself.\n"
    "  • The Data/Profile Gatekeeper will run AFTER you and may apply soft corrections — so "
    "    focus on getting the verdict right, not perfect ingredient swaps.\n\n"

    "OUTPUT: Return VALID JSON ONLY — no markdown, no prose outside the JSON. Required keys:\n"
    "  decision: one of 'can_eat' | 'cannot_eat' | 'try_alternative'.\n"
    "  verdict_reason: 1–2 warm, plain-language sentences explaining the decision and naming the "
    "    specific About Me fact that drove it (e.g. 'You're managing type 2 diabetes and this "
    "    has 60g of sugar — let's swap to something gentler.').\n"
    "  uploaded_food_summary: short description of what was on the plate, or null if no photo.\n"
    "  meal_name: string. description: string.\n"
    "  ingredients: array of {item, quantity, unit}.\n"
    "  nutrition: {calories, protein, carbs, fat, sugar} as numbers.\n"
    "  preparation: string with numbered steps. prep_time_minutes: number. tags: array of strings.\n\n"

    "RULES:\n"
    " 1. NEVER include any ingredient that matches the user's allergies — this is life-critical.\n"
    " 2. Honour all medical_conditions: diabetes → cap added sugar / refined carbs; hypertension → cap sodium; etc.\n"
    " 3. Recommendation MUST fit within remaining_budget for today (calories, protein, carbs, fat, sugar).\n"
    " 4. Photo + safe + fits budget → decision='can_eat', return the photo's meal_name and macros.\n"
    " 5. Photo + unsafe OR over-budget → decision='cannot_eat', explain in verdict_reason, AND populate the meal fields with a SAFE alternative that fits.\n"
    " 6. No photo → decision='try_alternative' and return a fresh recommendation.\n"
    " 7. Avoid recently eaten meals (today_logs + weekly_history) — variety matters.\n"
    " 8. Honour disliked items; favour liked items.\n"
    " 9. Tone is warm, second-person, encouraging — never shame, never lecture.\n"
)


def run_agent2(
    agent1_context: Dict[str, Any],
    retrieved_docs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Generate a recommendation honouring all of Agent 1's collected context."""
    logger.info(
        f"Agent2 generating recommendation (docs={len(retrieved_docs)}, "
        f"has_photo={agent1_context.get('has_photo')}, "
        f"remaining_kcal={(agent1_context.get('remaining_budget') or {}).get('calories')})"
    )

    prompt = _build_prompt(agent1_context, retrieved_docs)

    if _has_valid_key(settings.AGENT2_API_KEY):
        recommendation = _call_openai_llm(prompt, agent1_context)
    else:
        logger.warning("No valid AGENT2_API_KEY — using stub recommendation")
        recommendation = _stub_recommendation(agent1_context)

    recommendation["retrieval_metadata"] = {
        "documents_retrieved": len(retrieved_docs),
        "avg_similarity": _avg_similarity(retrieved_docs),
    }
    # Always include the decision (default to try_alternative if model omitted it)
    recommendation.setdefault("decision", "try_alternative")
    recommendation.setdefault("verdict_reason", "")

    logger.info(f"Agent2 decision={recommendation.get('decision')}")
    return recommendation


# ─── LLM call ────────────────────────────────────────────────────────────────

def _has_valid_key(key: str) -> bool:
    if not key: return False
    if key.startswith("sk-CHANGE") or key.startswith("sk-ant-CHANGE"): return False
    return True


def _call_openai_llm(prompt: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    try:
        from openai import OpenAI
    except ImportError:
        logger.error("openai SDK not installed")
        return _fallback_recommendation(ctx)

    client = OpenAI(api_key=settings.AGENT2_API_KEY)
    base_kwargs = {
        "model": settings.AGENT2_MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }

    # Modern signature first; fall back to legacy max_tokens if model rejects max_completion_tokens.
    try:
        completion = client.chat.completions.create(**base_kwargs, max_completion_tokens=2048)
    except Exception as modern_err:
        msg = str(modern_err).lower()
        if "max_completion_tokens" in msg or "unsupported_parameter" in msg:
            logger.info("Agent2 — falling back to legacy max_tokens + sampling params")
            try:
                completion = client.chat.completions.create(
                    **base_kwargs, max_tokens=2048, temperature=0.7, top_p=0.9,
                )
            except Exception as legacy_err:
                logger.error(f"Agent2 legacy call failed: {legacy_err}")
                return _fallback_recommendation(ctx)
        else:
            logger.error(f"Agent2 LLM call failed: {modern_err}")
            return _fallback_recommendation(ctx)

    try:
        raw_text = completion.choices[0].message.content or ""
        logger.info(f"Agent2 LLM response received ({len(raw_text)} chars)")
        return _parse_llm_response(raw_text, ctx)
    except Exception as e:
        logger.error(f"Agent2 response parse failed: {e}")
        return _fallback_recommendation(ctx)


def _parse_llm_response(text: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try: return json.loads(m.group(1))
        except json.JSONDecodeError: pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try: return json.loads(m.group())
        except json.JSONDecodeError: pass
    logger.warning("Agent2 — failed to parse LLM response as JSON")
    return _fallback_recommendation(ctx)


# ─── Prompt building ─────────────────────────────────────────────────────────

def _build_prompt(ctx: Dict, docs: List[Dict]) -> str:
    allergies = ", ".join(ctx.get("allergies", [])) or "None"
    constraints = ", ".join(ctx.get("dietary_constraints", [])) or "None"
    medical = ", ".join(ctx.get("medical_conditions", [])) or "None"
    goals = ", ".join(ctx.get("goals", [])) or "None"
    liked = ", ".join(ctx.get("recent_preferences", {}).get("liked", [])) or "None"
    disliked = ", ".join(ctx.get("recent_preferences", {}).get("disliked", [])) or "None"
    about_me = ctx.get("about_me_profile") or {}

    daily_limits = ctx.get("daily_limits", {}) or {}
    today_totals = ctx.get("today_totals", {}) or {}
    remaining = ctx.get("remaining_budget", {}) or {}

    today_logs = ctx.get("today_logs", []) or []
    today_str = "\n".join(
        f"  • {m.get('meal_type','meal')}: {m.get('meal_name')} — "
        f"{m.get('calories', 0)} kcal, P{m.get('protein_g', 0)}/C{m.get('carbs_g', 0)}/F{m.get('fat_g', 0)}/S{m.get('sugar_g', 0)}"
        for m in today_logs
    ) or "  (none yet today)"

    weekly = ctx.get("weekly_history", []) or []
    weekly_str = ", ".join({m.get("meal_name") for m in weekly[:20] if m.get("meal_name")}) or "None"

    photo = ctx.get("uploaded_food_analysis")
    photo_section = ""
    if ctx.get("has_photo"):
        if photo:
            photo_section = (
                "\n\nUPLOADED PHOTO ANALYSIS (the user is asking 'can I eat this?'):\n"
                f"  Summary: {photo.get('summary', 'unknown')}\n"
                f"  Items: {json.dumps(photo.get('items', []))}\n"
                f"  Estimated nutrition: {json.dumps(photo.get('estimated_nutrition', {}))}\n"
                f"  Allergen concerns flagged by vision: {', '.join(photo.get('concerns', [])) or 'none'}\n"
                f"  Vision confidence: {photo.get('confidence', 'unknown')}"
            )
        else:
            photo_section = "\n\nUPLOADED PHOTO: A photo was attached but could not be analyzed. Treat the request as text-only."

    doc_context = "\n".join(d.get("content", "")[:500] for d in docs[:5])
    doc_section = f"\n\nRELEVANT NUTRITION KNOWLEDGE:\n{doc_context}" if doc_context.strip() else ""

    return f"""USER REQUEST: {ctx.get('message') or '(no text — photo only)'}

ABOUT ME (PRIMARY SOURCE OF TRUTH — drawn directly from the user's editable About Me profile):
{json.dumps(about_me, indent=2)}

USER PROFILE (denormalized for quick reference):
- Display name: {ctx.get('display_name', 'there')}
- Intent: {ctx.get('intent', 'general')}
- Dietary constraints: {constraints}
- ALLERGIES (CRITICAL — NEVER include): {allergies}
- Medical conditions: {medical}
- Health goals: {goals}
- Likes: {liked}
- Dislikes: {disliked}

DAILY LIMITS: {json.dumps(daily_limits)}
EATEN TODAY (running totals): {json.dumps(today_totals)}
REMAINING BUDGET FOR THE DAY: {json.dumps(remaining)}

TODAY'S MEALS SO FAR:
{today_str}

PAST WEEK'S MEALS (avoid repeating these often): {weekly_str}{photo_section}{doc_section}

Return a single JSON object as described in the system prompt. Make the verdict_reason warm and human."""


# ─── Stub / fallback ─────────────────────────────────────────────────────────

def _fallback_recommendation(ctx: Dict[str, Any] | None = None) -> Dict[str, Any]:
    has_photo = bool((ctx or {}).get("has_photo"))
    decision = "cannot_eat" if has_photo else "try_alternative"
    return {
        "decision": decision,
        "verdict_reason": "Agent 2 was unavailable — falling back to a safe default suggestion that fits your day.",
        "uploaded_food_summary": None,
        "meal_name": "Mediterranean Lentil & Quinoa Bowl",
        "description": "A vegetarian, high-fibre bowl with lentils, quinoa, roasted vegetables, and tahini.",
        "ingredients": [
            {"item": "Cooked lentils", "quantity": "150", "unit": "g"},
            {"item": "Quinoa", "quantity": "120", "unit": "g"},
            {"item": "Roasted zucchini", "quantity": "100", "unit": "g"},
            {"item": "Cherry tomatoes", "quantity": "80", "unit": "g"},
            {"item": "Tahini", "quantity": "1", "unit": "tbsp"},
            {"item": "Olive oil", "quantity": "1", "unit": "tsp"},
        ],
        "nutrition": {"calories": 480, "protein": 22, "carbs": 70, "fat": 14, "sugar": 7},
        "preparation": "1. Cook quinoa\n2. Warm lentils\n3. Roast zucchini at 200C\n4. Assemble bowl with tahini drizzle",
        "prep_time_minutes": 25,
        "tags": ["Vegetarian", "High Fibre", "Balanced"],
    }


def _stub_recommendation(ctx: Dict[str, Any]) -> Dict[str, Any]:
    return _fallback_recommendation(ctx)


def _avg_similarity(docs: List[Dict]) -> float:
    if not docs: return 0.0
    return sum(d.get("similarity", 0) for d in docs) / len(docs)
