"""Defensive JSON parsing of LLM output (handles markdown fences + trailing text)."""
import json
import re
from typing import Any


def extract_json(text: str) -> dict[str, Any]:
    """Parse a JSON object out of an LLM response.

    Handles: ```json fences, leading/trailing prose, and stray commas.
    Raises ValueError if no valid JSON object can be found.
    """
    cleaned = text.strip()

    # Strip code fences
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Fall back to finding the first {...} block
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        candidate = cleaned[start : end + 1]
        # Try to repair trailing commas before closing braces
        candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from LLM output: {text[:200]!r}")


def clamp_score(value: float) -> int:
    """Clamp a score to the 0-100 integer range."""
    return max(0, min(100, int(round(float(value)))))


def split_bullets(text: str) -> list[str]:
    """Split LLM bullet output into a clean list of strings."""
    if isinstance(text, list):
        return [str(b).strip(" -•*") for b in text if str(b).strip()]
    lines = [ln.strip(" -•*\t") for ln in text.splitlines() if ln.strip()]
    return [ln for ln in lines if ln]
