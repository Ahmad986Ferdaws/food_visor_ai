"""Agent 3: Data/Profile Gatekeeper.

Strict, deterministic cross-check between (a) the proposed meal / vision-detected
ingredients and (b) the user's About Me profile (allergies, medical conditions,
dietary constraints, daily limits, today's running totals).

Hard validation is pure Python — NEVER delegated to an LLM. Soft corrections
(preference swaps, gentle tweaks) are routed to Anthropic Claude when
AGENT3_API_KEY is set, with a deterministic fallback.

Final verdict is one of: 'can_eat' | 'cannot_eat' | 'try_alternative'.
"""

import json
import logging
from typing import Dict, Any, List, Tuple, Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import UserPreferences

settings = get_settings()
logger = logging.getLogger(__name__)


# Per-macro tolerance — Agent 3 won't reject a recommendation that pushes calories
# slightly past the remaining budget so long as it's within this fraction.
BUDGET_TOLERANCE = 0.10  # 10%


# ─── Data/Profile Gatekeeper system prompt ───────────────────────────────────
# This agent reads STRUCTURED DATA only — never an image. Its job is to compare a
# proposed meal against the user's About Me profile and reject or correct it. Hard
# checks (allergens, budget) are already done in Python before this prompt runs;
# this prompt only handles SOFT corrections (preference swaps, mild constraint
# alignment, goal nudges).
DATA_GATEKEEPER_SYSTEM_PROMPT = (
    "ROLE: You are the Data/Profile Gatekeeper. Your sole job is to compare a "
    "proposed meal against the user's structured profile data and apply soft "
    "corrections. You do NOT look at images. You do NOT generate brand-new "
    "recommendations from scratch. You do NOT speak directly to the user.\n\n"

    "CONTRACT: The hard allergen + budget checks have ALREADY passed in pure Python "
    "before you run. Do NOT re-check those — trust them. Apply only SOFT corrections:\n"
    "  • Swap any ingredient that appears in disliked_items for a similar acceptable one (max 2 swaps).\n"
    "  • Tighten alignment with dietary_constraints (e.g. swap white rice → brown rice if 'whole-grain' goal).\n"
    "  • Nudge macros toward the user's goals when there is room within the remaining budget.\n"
    "  • Preserve meal_name, decision, verdict_reason, and the overall structure.\n\n"

    "OUTPUT: Return a SINGLE JSON object — NO prose, NO markdown fences. Required keys:\n"
    "  corrected_recommendation: full meal object preserving the input schema "
    "    (decision, verdict_reason, meal_name, description, "
    "    ingredients[{item, quantity, unit}], nutrition{calories, protein, carbs, fat, sugar}, "
    "    preparation, prep_time_minutes, tags).\n"
    "  changes_made: array of short strings describing every change you applied. Empty array if none.\n"
    "  confidence_score: float 0..1 — how confident you are that the corrected meal serves the user well.\n\n"

    "RULES:\n"
    "  • Never weaken safety. Never re-introduce a removed allergen.\n"
    "  • Never invent macros — adjust them only if you actually changed an ingredient.\n"
    "  • If no changes are needed, return the input verbatim with changes_made = [].\n"
)


def run_agent3(
    db: Session,
    agent2_output: Dict[str, Any],
    agent1_context: Dict[str, Any],
) -> Tuple[str, Dict[str, Any]]:
    """Validate recommendation, return (status, output)."""
    logger.info("Agent3 validating recommendation")

    # ── HARD VALIDATION ─────────────────────────────────────────
    passed_allergy, allergy_err = _validate_allergies_and_constraints(agent2_output, agent1_context)
    fits_budget, budget_msg = _validate_against_remaining_budget(agent2_output, agent1_context)

    if not passed_allergy:
        logger.warning(f"Agent3 HARD REJECTED (allergen/constraint): {allergy_err}")
        return "rejected", _verdict(
            decision="cannot_eat",
            reason=allergy_err,
            recommendation=agent2_output,
            confidence=0.99,
            changes=[allergy_err],
            validation_result="rejected",
            error=allergy_err,
        )

    if not fits_budget:
        logger.warning(f"Agent3 BUDGET FAIL: {budget_msg}")
        # Don't fail the whole pipeline — still surface the recommendation as 'try_alternative'
        # since Agent 2 may already have provided one. The verdict tells the user clearly.
        return "corrected", _verdict(
            decision="try_alternative",
            reason=budget_msg,
            recommendation=agent2_output,
            confidence=0.7,
            changes=[budget_msg],
            validation_result="corrected",
        )

    # ── SOFT VALIDATION ─────────────────────────────────────────
    corrected, soft_changes, llm_confidence = _soft_correct_with_claude(agent2_output, agent1_context)

    # ── SENSITIVE-MODE EXTRA CHECKS ─────────────────────────────
    if agent1_context.get("sensitive_mode"):
        logger.info("Sensitive mode — applying strict validation")
        sens_issues = _sensitive_mode_checks(corrected)
        if sens_issues:
            soft_changes.extend(sens_issues)

    # ── MEMORY UPDATE ───────────────────────────────────────────
    _update_user_preferences(db, agent1_context, corrected)

    confidence = llm_confidence if llm_confidence is not None else _calculate_confidence(corrected, agent1_context)

    # Decision propagation:
    # - If Agent 2 already returned a decision (can_eat / cannot_eat / try_alternative), preserve it.
    # - Otherwise default based on whether soft changes were made.
    decision = corrected.get("decision") or agent2_output.get("decision")
    if not decision:
        decision = "try_alternative"

    reason = corrected.get("verdict_reason") or agent2_output.get("verdict_reason") or ""
    if not reason and decision == "can_eat":
        reason = "Looks good — fits within your remaining limits and contains no allergens."
    elif not reason:
        reason = "Here's a suggestion that fits your day."

    result_status = "corrected" if soft_changes else "approved"
    return result_status, _verdict(
        decision=decision,
        reason=reason,
        recommendation=corrected,
        confidence=confidence,
        changes=soft_changes,
        validation_result=result_status,
    )


# ─── Verdict shaping ─────────────────────────────────────────────────────────

def _verdict(
    *,
    decision: str,
    reason: str,
    recommendation: Dict[str, Any],
    confidence: float,
    changes: List[str],
    validation_result: str,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    out = {
        "decision": decision,
        "verdict_reason": reason,
        "validation_result": validation_result,
        "final_recommendation": recommendation,
        "changes_made": changes,
        "confidence_score": confidence,
    }
    if error:
        out["error"] = error
    return out


# ─── Hard checks ─────────────────────────────────────────────────────────────

def _validate_allergies_and_constraints(
    recommendation: Dict[str, Any], context: Dict[str, Any]
) -> Tuple[bool, str]:
    """Pure-Python allergen + dietary constraint check. NEVER delegated to an LLM."""
    allergies = {a.lower() for a in context.get("allergies", []) if isinstance(a, str)}
    constraints = {d.lower() for d in context.get("dietary_constraints", []) if isinstance(d, str)}

    ingredients = recommendation.get("ingredients", []) or []
    ingredient_names = {ing.get("item", "").lower() for ing in ingredients if isinstance(ing, dict)}

    # Allergen substring match in either direction.
    for allergen in allergies:
        if not allergen:
            continue
        for ing_name in ingredient_names:
            if allergen in ing_name or ing_name in allergen:
                return False, f"Contains '{ing_name}' which conflicts with your '{allergen}' allergy."

    # Vision-flagged ingredients (visible + HIDDEN/likely) also count as allergens.
    photo = context.get("uploaded_food_analysis") or {}
    flags: List[str] = []
    flags.extend([str(x) for x in (photo.get("allergen_flags") or [])])
    # Backwards-compat: older payloads used 'concerns'.
    flags.extend([str(x) for x in (photo.get("concerns") or [])])
    for item in (photo.get("visible_items") or []):
        if isinstance(item, dict) and item.get("name"):
            flags.append(str(item["name"]))
    # Hidden/likely items are the highest-risk source — always include them.
    for item in (photo.get("hidden_or_likely_items") or []):
        if isinstance(item, dict) and item.get("name"):
            flags.append(f"{item['name']} (likely hidden)")

    for flag in flags:
        f = flag.lower()
        for allergen in allergies:
            if allergen and (allergen in f or f in allergen):
                return False, (
                    f"The photo contains '{flag}' which conflicts with your '{allergen}' allergy. "
                    f"Do not eat this."
                )

    meat_items = {"chicken", "beef", "pork", "fish", "salmon", "tuna", "shrimp", "lamb", "turkey", "bacon", "meat"}
    animal_products = meat_items | {"egg", "milk", "cheese", "butter", "honey", "cream", "yogurt", "whey"}

    if "vegetarian" in constraints:
        m = meat_items & ingredient_names
        if m: return False, f"Contains meat ({', '.join(m)}) but you're vegetarian."
    if "vegan" in constraints:
        m = animal_products & ingredient_names
        if m: return False, f"Contains animal products ({', '.join(m)}) but you're vegan."
    if "gluten-free" in constraints:
        gluten_items = {"wheat", "bread", "pasta", "flour", "barley", "rye", "couscous"}
        m = gluten_items & ingredient_names
        if m: return False, f"Contains gluten ({', '.join(m)}) but you're gluten-free."

    return True, ""


def _validate_against_remaining_budget(
    recommendation: Dict[str, Any], context: Dict[str, Any]
) -> Tuple[bool, str]:
    """Reject if the recommendation pushes any macro past the remaining daily budget (with tolerance)."""
    remaining = context.get("remaining_budget") or {}
    if not remaining:
        return True, ""
    nutrition = recommendation.get("nutrition") or {}
    if not nutrition:
        return True, ""

    checks = [
        ("calories",  "calories",  "kcal"),
        ("protein",   "protein_g", "g of protein"),
        ("carbs",     "carbs_g",   "g of carbs"),
        ("fat",       "fat_g",     "g of fat"),
        ("sugar",     "sugar_g",   "g of sugar"),
    ]
    for src_key, budget_key, label in checks:
        value = nutrition.get(src_key)
        budget = remaining.get(budget_key)
        if value is None or budget is None:
            continue
        try:
            value = float(value)
            budget = float(budget)
        except (TypeError, ValueError):
            continue
        # Allow a small tolerance — eating slightly past is fine, busting is not.
        if value > budget + abs(budget) * BUDGET_TOLERANCE:
            return False, (
                f"This would add {value:.0f} {label}, but you only have "
                f"{max(budget, 0):.0f} {label} left for today."
            )
    return True, ""


# ─── Soft corrections (Claude with deterministic fallback) ───────────────────

def _has_valid_key(key: str) -> bool:
    if not key: return False
    if key.startswith("sk-CHANGE") or key.startswith("sk-ant-CHANGE"): return False
    return True


def _soft_correct_with_claude(
    recommendation: Dict[str, Any], context: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[str], float | None]:
    api_key = settings.AGENT3_API_KEY
    if not _has_valid_key(api_key):
        corrected, changes = _apply_soft_corrections(recommendation, context)
        return corrected, changes, None
    try:
        from anthropic import Anthropic
    except ImportError:
        logger.warning("anthropic SDK not installed — using deterministic soft corrections")
        corrected, changes = _apply_soft_corrections(recommendation, context)
        return corrected, changes, None

    try:
        client = Anthropic(api_key=api_key)
        user_payload = {
            "recommendation": recommendation,
            "user_profile": {
                "dietary_constraints": context.get("dietary_constraints", []),
                "goals": context.get("goals", []),
                "liked": context.get("recent_preferences", {}).get("liked", []),
                "disliked": context.get("recent_preferences", {}).get("disliked", []),
                "remaining_budget": context.get("remaining_budget", {}),
            },
        }
        resp = client.messages.create(
            model=settings.AGENT3_MODEL_NAME,
            max_tokens=2048,
            system=DATA_GATEKEEPER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(user_payload, default=str)}],
        )
        text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{.*\}", text, re.DOTALL)
            if not m: raise
            parsed = json.loads(m.group())

        corrected = parsed.get("corrected_recommendation") or recommendation
        # Preserve photo verdict fields if Claude dropped them
        for k in ("decision", "verdict_reason", "uploaded_food_summary", "retrieval_metadata"):
            if k in recommendation and k not in corrected:
                corrected[k] = recommendation[k]
        changes = parsed.get("changes_made") or []
        if not isinstance(changes, list): changes = []
        confidence = parsed.get("confidence_score")
        if isinstance(confidence, (int, float)):
            confidence = max(0.0, min(1.0, float(confidence)))
        else:
            confidence = None
        logger.info(f"Agent3 Claude soft corrections: {len(changes)} changes, confidence={confidence}")
        return corrected, [str(c) for c in changes], confidence
    except Exception as e:
        logger.warning(f"Agent3 Claude call failed ({e}) — using deterministic soft corrections")
        corrected, changes = _apply_soft_corrections(recommendation, context)
        return corrected, changes, None


def _apply_soft_corrections(
    recommendation: Dict[str, Any], context: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[str]]:
    changes: List[str] = []
    corrected = json.loads(json.dumps(recommendation, default=str))  # deep copy
    disliked = {item.lower() for item in context.get("recent_preferences", {}).get("disliked", [])}
    ingredients = corrected.get("ingredients", []) or []
    replacements = {
        "tofu": "tempeh", "quinoa": "brown rice", "spinach": "kale",
        "cilantro": "parsley", "blue cheese": "feta",
    }
    swaps = 0
    for ing in ingredients:
        if swaps >= 2: break
        name = (ing.get("item") or "").lower()
        if name in disliked and name in replacements:
            old = ing["item"]
            ing["item"] = replacements[name]
            changes.append(f"Replaced '{old}' with '{ing['item']}' (you've disliked {old}).")
            swaps += 1
    return corrected, changes


def _sensitive_mode_checks(recommendation: Dict[str, Any]) -> List[str]:
    issues = []
    for ing in recommendation.get("ingredients", []) or []:
        name = (ing.get("item") or "").lower()
        if any(w in name for w in ["alcohol", "wine", "beer", "raw", "unpasteurized"]):
            issues.append(f"Flagged '{ing.get('item')}' under sensitive-mode restriction.")
    return issues


def _update_user_preferences(db: Session, context: Dict[str, Any], recommendation: Dict[str, Any]):
    try:
        user_id = context.get("user_id")
        if not user_id: return
        prefs = db.query(UserPreferences).filter_by(user_id=user_id).first()
        if not prefs: return
        meal_name = recommendation.get("meal_name", "")
        if meal_name:
            liked = list(prefs.liked_items or [])
            if meal_name not in liked:
                liked.append(meal_name)
                prefs.liked_items = liked[-20:]  # keep last 20 (slice, not single index)
                db.add(prefs)
                db.commit()
    except Exception as e:
        logger.warning(f"Failed to update preferences: {e}")
        try: db.rollback()
        except Exception: pass


def _calculate_confidence(recommendation: Dict[str, Any], context: Dict[str, Any]) -> float:
    score = 0.8
    if context.get("goals"): score += 0.05
    if context.get("remaining_budget"): score += 0.05
    disliked = {d.lower() for d in context.get("recent_preferences", {}).get("disliked", [])}
    ingredients = recommendation.get("ingredients", []) or []
    if any((ing.get("item") or "").lower() in disliked for ing in ingredients):
        score -= 0.2
    return max(0.0, min(1.0, score))
