"""Sensitive mode detection and sanitization for health data."""

import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

SENSITIVE_KEYWORDS = [
    r"\ballerg(y|ies|ic)\b",
    r"\bmedication\b",
    r"\bprescription\b",
    r"\bdiabet(es|ic)\b",
    r"\binsulin\b",
    r"\bblood\s*(sugar|pressure)\b",
    r"\bheart\s*condition\b",
    r"\bkidney\b",
    r"\bliver\b",
    r"\bpregnancy\b",
    r"\bpregnant\b",
    r"\bbreastfeeding\b",
    r"\bmedical\s*condition\b",
    r"\bceliac\b",
    r"\banaphyla\w+\b",
    r"\bepipen\b",
]

_compiled = [re.compile(p, re.IGNORECASE) for p in SENSITIVE_KEYWORDS]


def detect_sensitive_mode(text: str, extra_keywords: List[str] | None = None) -> bool:
    """Return True if text contains health-sensitive content."""
    for pattern in _compiled:
        if pattern.search(text):
            logger.info("Sensitive content detected — enabling sensitive_mode")
            return True
    if extra_keywords:
        text_lower = text.lower()
        for kw in extra_keywords:
            if kw.lower() in text_lower:
                return True
    return False


def sanitize_context(context: Dict[str, Any]) -> Dict[str, Any]:
    """Redact sensitive details from context before model calls."""
    sanitized = context.copy()

    # Don't log raw allergies in full
    if "allergies" in sanitized and sanitized["allergies"]:
        sanitized["allergies_count"] = len(sanitized["allergies"])
        # Keep allergy names (needed for safety) but mark as sensitive
        sanitized["_sensitive_fields"] = ["allergies"]

    # Redact free-text that might contain medical info
    if "message" in sanitized:
        for pattern in _compiled:
            sanitized["message"] = pattern.sub("[REDACTED]", sanitized.get("message", ""))

    return sanitized


def sanitize_for_logging(text: str, sensitive_mode: bool) -> str:
    """Redact sensitive content for log output."""
    if not sensitive_mode:
        return text
    result = text
    for pattern in _compiled:
        result = pattern.sub("[REDACTED]", result)
    return result
