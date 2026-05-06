"""Sensitive mode detection and sanitization.

Detects medication, allergy, and health-sensitive content.
When triggered: minimizes context, applies stricter validation, avoids logging raw content.
"""

import re
import logging

logger = logging.getLogger(__name__)

# Keywords that trigger sensitive mode (expandable)
SENSITIVE_PATTERNS = [
    r"\ballerg(y|ies|ic)\b",
    r"\bmedication\b",
    r"\bprescription\b",
    r"\bdiabet(es|ic)\b",
    r"\binsulin\b",
    r"\bblood\s*pressure\b",
    r"\bceliac\b",
    r"\bgluten[\s-]*free\b",
    r"\blactose\b",
    r"\bpregnant\b",
    r"\bpregnancy\b",
    r"\banaphyla\w+\b",
    r"\bepipen\b",
    r"\bwarfarin\b",
    r"\bmetformin\b",
    r"\bstatin\b",
]

_compiled = [re.compile(p, re.IGNORECASE) for p in SENSITIVE_PATTERNS]


def detect_sensitive(text: str) -> bool:
    """Return True if text contains health-sensitive content."""
    for pattern in _compiled:
        if pattern.search(text):
            logger.info("Sensitive content detected — enabling sensitive_mode")
            return True
    return False


def sanitize_for_logging(text: str, sensitive_mode: bool) -> str:
    """Redact sensitive content before logging. Returns full text if not sensitive."""
    if not sensitive_mode:
        return text
    # Replace matched patterns with [REDACTED]
    result = text
    for pattern in _compiled:
        result = pattern.sub("[REDACTED]", result)
    return result
