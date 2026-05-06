"""Agent 3: Validator.

Validates Agent 2 output against Agent 1 intent + user preference patterns.
Updates memory/preferences after validation.
ALLERGY VALIDATION IS LIFE-CRITICAL — hard fail on any match.
"""

import logging
from typing import Dict, Any, List, Tuple

from sqlalchemy.orm import Session

from app.models.user import UserPreferences

logger = logging.getLogger(__name__)


def run_agent3(
    db: Session,
    agent2_output: Dict[str, Any],
    agent1_context: Dict[str, Any],
) -> Tuple[str, Dict[str, Any]]:
    """Validate recommendation and update user memory. Returns (result_status, output)."""
    logger.info("Agent3 validating recommendation")

    # ── HARD VALIDATION (must pass) ──────────────────
    passed, error = _validate_allergies_and_constraints(agent2_output, agent1_context)

    if not passed:
        logger.warning(f"Agent3 REJECTED: {error}")
        return "rejected", {
            "validation_result": "rejected",
            "error": error,
            "recommendation": None,
        }

    # ── SOFT VALIDATION (can correct) ────────────────
    corrected, changes = _apply_soft_corrections(agent2_output, agent1_context)

    # ── SENSITIVE MODE EXTRA CHECKS ──────────────────
    if agent1_context.get("sensitive_mode"):
        logger.info("Sensitive mode — applying strict validation")
        sens_issues = _sensitive_mode_checks(corrected)
        if sens_issues:
            changes.extend(sens_issues)

    # ── MEMORY UPDATE ────────────────────────────────
    _update_user_preferences(db, agent1_context, corrected)

    confidence = _calculate_confidence(corrected, agent1_context)
    result_status = "corrected" if changes else "approved"

    result = {
        "validation_result": result_status,
        "final_recommendation": corrected,
        "changes_made": changes,
        "confidence_score": confidence,
    }

    logger.info(f"Agent3 result: {result_status}, confidence={confidence:.2f}")
    return result_status, result


def _validate_allergies_and_constraints(
    recommendation: Dict[str, Any], context: Dict[str, Any]
) -> Tuple[bool, str]:
    """CRITICAL: Hard validation for allergies and dietary constraints."""
    allergies = {a.lower() for a in context.get("allergies", [])}
    constraints = {d.lower() for d in context.get("dietary_constraints", [])}

    ingredients = recommendation.get("ingredients", [])
    ingredient_names = {ing["item"].lower() for ing in ingredients}

    # ── ALLERGY CHECK (life-critical) ────────────────
    # Check both exact match and substring match
    for allergen in allergies:
        for ing_name in ingredient_names:
            if allergen in ing_name or ing_name in allergen:
                return False, f"ALLERGY MATCH: '{allergen}' found in ingredient '{ing_name}'"

    # ── DIETARY CONSTRAINT CHECK ─────────────────────
    meat_items = {"chicken", "beef", "pork", "fish", "salmon", "tuna", "shrimp", "lamb", "turkey", "bacon", "meat"}
    animal_products = meat_items | {"egg", "milk", "cheese", "butter", "honey", "cream", "yogurt", "whey"}

    if "vegetarian" in constraints:
        matches = meat_items & ingredient_names
        if matches:
            return False, f"Contains meat (user is vegetarian): {', '.join(matches)}"

    if "vegan" in constraints:
        matches = animal_products & ingredient_names
        if matches:
            return False, f"Contains animal products (user is vegan): {', '.join(matches)}"

    if "gluten-free" in constraints:
        gluten_items = {"wheat", "bread", "pasta", "flour", "barley", "rye", "couscous"}
        matches = gluten_items & ingredient_names
        if matches:
            return False, f"Contains gluten (user is gluten-free): {', '.join(matches)}"

    return True, ""


def _apply_soft_corrections(
    recommendation: Dict[str, Any], context: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[str]]:
    """Soft corrections based on user preferences."""
    changes: List[str] = []
    corrected = recommendation.copy()
    disliked = {item.lower() for item in context.get("recent_preferences", {}).get("disliked", [])}

    ingredients = corrected.get("ingredients", [])
    replacements = {
        "tofu": "tempeh", "quinoa": "brown rice", "spinach": "kale",
        "cilantro": "parsley", "blue cheese": "feta",
    }

    change_count = 0
    for ing in ingredients:
        if change_count >= 2:
            break
        if ing["item"].lower() in disliked and ing["item"].lower() in replacements:
            old = ing["item"]
            ing["item"] = replacements[old.lower()]
            changes.append(f"Replaced '{old}' with '{ing['item']}' (user dislikes {old})")
            change_count += 1

    return corrected, changes


def _sensitive_mode_checks(recommendation: Dict[str, Any]) -> List[str]:
    """Extra checks when sensitive mode is active."""
    issues = []
    ingredients = recommendation.get("ingredients", [])
    for ing in ingredients:
        name = ing["item"].lower()
        if any(w in name for w in ["alcohol", "wine", "beer", "raw", "unpasteurized"]):
            issues.append(f"Flagged '{ing['item']}' — sensitive mode restriction")
    return issues


def _update_user_preferences(db: Session, context: Dict[str, Any], recommendation: Dict[str, Any]):
    """Learn from validated recommendation to refine user preferences."""
    try:
        user_id = context.get("user_id")
        if not user_id:
            return
        prefs = db.query(UserPreferences).filter_by(user_id=user_id).first()
        if prefs:
            # Record the meal type as a preference signal
            meal_name = recommendation.get("meal_name", "")
            if meal_name and meal_name not in (prefs.liked_items or []):
                liked = list(prefs.liked_items or [])
                liked.append(meal_name)
                prefs.liked_items = liked[-20]  # Keep last 20
                db.add(prefs)
    except Exception as e:
        logger.warning(f"Failed to update preferences: {e}")


def _calculate_confidence(recommendation: Dict[str, Any], context: Dict[str, Any]) -> float:
    """Calculate confidence score (0-1)."""
    score = 0.8
    if context.get("goals"):
        score += 0.1
    disliked = {d.lower() for d in context.get("recent_preferences", {}).get("disliked", [])}
    ingredients = recommendation.get("ingredients", [])
    if any(ing["item"].lower() in disliked for ing in ingredients):
        score -= 0.2
    return max(0.0, min(1.0, score))
