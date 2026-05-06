"""Agent 2: Recommender.

Uses Agent 1 context + RAG retrieval from vector DB to generate recommendations.
Calls NVIDIA NIM chat completions API for real LLM-powered responses.
ONLY agent that uses vector retrieval.
"""

import json
import re
import logging
from typing import Dict, Any, List

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NVIDIA_MODEL = "nvidia/nemotron-nano-12b-v2-vl"


def run_agent2(
    agent1_context: Dict[str, Any],
    retrieved_docs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Generate personalized recommendation using RAG context + NVIDIA LLM."""
    logger.info(f"Agent2 generating recommendation with {len(retrieved_docs)} docs")

    prompt = _build_prompt(agent1_context, retrieved_docs)

    # Call NVIDIA NIM LLM
    if settings.AGENT2_API_KEY and not settings.AGENT2_API_KEY.startswith("sk-CHANGE"):
        recommendation = _call_nvidia_llm(prompt)
    else:
        logger.warning("No valid AGENT2_API_KEY — using stub recommendation")
        recommendation = _stub_recommendation(agent1_context)

    recommendation["retrieval_metadata"] = {
        "documents_retrieved": len(retrieved_docs),
        "avg_similarity": _avg_similarity(retrieved_docs),
    }

    logger.info("Agent2 recommendation generated")
    return recommendation


def _call_nvidia_llm(prompt: str) -> Dict[str, Any]:
    """Call NVIDIA NIM chat completions API."""
    try:
        response = httpx.post(
            NVIDIA_CHAT_URL,
            headers={
                "Authorization": f"Bearer {settings.AGENT2_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": NVIDIA_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a world-class nutritionist and meal recommendation expert. "
                            "You MUST respond with valid JSON only — no markdown, no explanation outside JSON. "
                            "The JSON must have these exact keys: "
                            "meal_name (string), description (string), "
                            "ingredients (array of {item, quantity, unit}), "
                            "nutrition ({calories, protein, carbs, fat} as numbers), "
                            "preparation (string with numbered steps), "
                            "prep_time_minutes (number), "
                            "tags (array of strings). "
                            "CRITICAL: Never include ingredients that match the user's allergies."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 2048,
                "temperature": 0.7,
                "top_p": 0.9,
                "stream": False,
            },
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()

        raw_text = data["choices"][0]["message"]["content"]
        logger.info(f"NVIDIA LLM response received ({len(raw_text)} chars)")

        # Parse JSON from response
        return _parse_llm_response(raw_text)

    except httpx.HTTPStatusError as e:
        logger.error(f"NVIDIA LLM API error {e.response.status_code}: {e.response.text[:300]}")
        return _fallback_recommendation()
    except Exception as e:
        logger.error(f"NVIDIA LLM call failed: {e}")
        return _fallback_recommendation()


def _parse_llm_response(text: str) -> Dict[str, Any]:
    """Extract JSON from LLM response text."""
    # Try direct JSON parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting JSON from markdown code block
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding first { ... } block
    json_match = re.search(r"\{.*\}", text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    logger.warning("Failed to parse LLM response as JSON, returning raw")
    return {
        "meal_name": "AI-Generated Recommendation",
        "description": text[:500],
        "ingredients": [],
        "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0},
        "preparation": text,
        "prep_time_minutes": 0,
        "tags": ["AI Generated"],
    }


def _build_prompt(context: Dict, docs: List[Dict]) -> str:
    """Build prompt for the LLM."""
    allergies_str = ", ".join(context.get("allergies", [])) or "None"
    constraints_str = ", ".join(context.get("dietary_constraints", [])) or "None"
    goals_str = ", ".join(context.get("goals", [])) or "None"
    liked_str = ", ".join(context.get("recent_preferences", {}).get("liked", [])) or "None"
    disliked_str = ", ".join(context.get("recent_preferences", {}).get("disliked", [])) or "None"

    doc_context = "\n".join(d.get("content", "")[:500] for d in docs[:5])
    doc_section = f"\nRelevant Nutrition Knowledge:\n{doc_context}" if doc_context.strip() else ""

    return f"""Generate a personalized meal recommendation based on the user's request and preferences.

User Request: {context.get('message', 'healthy meal recommendation')}

User Profile:
- Intent: {context.get('intent', 'general')}
- Dietary constraints: {constraints_str}
- ALLERGIES (CRITICAL — NEVER include any of these ingredients): {allergies_str}
- Health goals: {goals_str}
- Foods they like: {liked_str}
- Foods they dislike: {disliked_str}
{doc_section}

Respond with a single JSON object. Do not include any text outside the JSON."""


def _fallback_recommendation() -> Dict[str, Any]:
    """Fallback when API call fails."""
    return {
        "meal_name": "Grilled Chicken & Vegetable Bowl",
        "description": "A balanced, protein-rich bowl with grilled chicken breast, roasted seasonal vegetables, and quinoa.",
        "ingredients": [
            {"item": "Chicken breast", "quantity": "180", "unit": "g"},
            {"item": "Quinoa", "quantity": "120", "unit": "g"},
            {"item": "Broccoli", "quantity": "80", "unit": "g"},
            {"item": "Bell pepper", "quantity": "1", "unit": "whole"},
            {"item": "Olive oil", "quantity": "1", "unit": "tbsp"},
        ],
        "nutrition": {"calories": 480, "protein": 42, "carbs": 38, "fat": 14},
        "preparation": "1. Cook quinoa\n2. Season and grill chicken\n3. Roast vegetables at 200C\n4. Assemble bowl",
        "prep_time_minutes": 25,
        "tags": ["High Protein", "Balanced", "Meal Prep Friendly"],
    }


def _stub_recommendation(context: Dict) -> Dict[str, Any]:
    """Stub recommendation when no API key is configured."""
    return _fallback_recommendation()


def _avg_similarity(docs: List[Dict]) -> float:
    if not docs:
        return 0.0
    return sum(d.get("similarity", 0) for d in docs) / len(docs)
