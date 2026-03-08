import re
import json
import base64

import httpx

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3.5:2b"

# NOTE: These configuration flags are placeholders for a future Gemini-based
# fallback implementation. They are intentionally unused in the current phase.
USE_LOCAL_AI = True
GEMINI_API_KEY = ""   # Optional: set in .env if using Gemini fallback
GEMINI_MODEL = "gemini-2.5-flash-lite"

TAGGING_PROMPT = """You are a fashion assistant. Analyze this clothing item photo and return ONLY valid JSON with no markdown, no explanation.

{
  "category": "one of: tshirt, shirt, polo, jacket, hoodie, sweater, jeans, chinos, trousers, shorts, shoes, sneakers, boots, formal_shoes, accessory, other",
  "colors": ["primary color", "secondary color if present"],
  "tags": ["fit-type", "material-if-visible", "pattern-if-any"],
  "fit_type": "one of: slim, regular, oversized, relaxed",
  "occasions": ["one or more of: casual, work, formal, sport, outdoor"],
  "seasons": ["one or more of: spring, summer, fall, winter"]
}"""


def parse_ai_json(raw: str) -> dict:
    """Strip think tags and markdown fences, then parse JSON. Returns {} on failure."""
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


async def tag_clothing_image(image_path: str) -> dict:
    """
    Call Ollama qwen3.5:2b to tag a clothing image.
    Returns parsed dict on success, empty dict on any failure.
    Caller should show manual tag form when empty dict is returned.
    """
    try:
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode()

        payload = {
            "model": MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": TAGGING_PROMPT,
                    "images": [image_data],
                }
            ],
            "stream": False,
            "options": {"temperature": 0.1},
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)

        raw = resp.json()["message"]["content"]
        return parse_ai_json(raw)

    except httpx.ConnectError:
        # Ollama is not running — caller shows manual form
        return {}
    except Exception:
        # Malformed response, timeout, or any other error
        return {}


def _slim_items(items: list[dict]) -> list[dict]:
    """Trim item dicts to only the fields relevant for outfit generation."""
    keep = {"id", "category", "colors", "occasions", "seasons", "fit_type"}
    return [{k: v for k, v in item.items() if k in keep} for item in items]


async def generate_outfits(items: list[dict], occasion: str, season: str) -> list[dict]:
    """
    Call Ollama to generate 3 outfit suggestions.
    Returns a list of {"items": [...], "reason": "..."} dicts.
    Returns [] on any failure (Ollama down, malformed JSON, etc).
    """
    prompt = f"""You are a personal stylist. Suggest exactly 3 outfits for occasion: {occasion}, season: {season}.

Wardrobe: {json.dumps(_slim_items(items))}

Rules: each outfit 2-4 items, color-coordinate, match occasion and season.
Return ONLY JSON array:
[
  {{"items": [1, 3], "reason": "brief note"}},
  {{"items": [2, 5, 7], "reason": "brief note"}},
  {{"items": [1, 4, 6], "reason": "brief note"}}
]"""

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.3},
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)
        raw = resp.json()["message"]["content"]
        result = parse_ai_json(raw)
        return result if isinstance(result, list) else []
    except Exception:
        return []


def _slim_items_for_gaps(items: list[dict]) -> list[dict]:
    """Trim item dicts to only the fields relevant for gap analysis."""
    keep = {"id", "category", "occasions", "seasons", "colors"}
    return [{k: v for k, v in item.items() if k in keep} for item in items]


async def analyze_gaps(items: list[dict]) -> dict:
    """
    Call Ollama to analyze wardrobe gaps by occasion and season.
    Returns {"gaps": [...], "coverage_score": {...}} on success.
    Returns {"gaps": [], "coverage_score": {}} on any failure (Ollama down, malformed JSON, etc).
    """
    slimmed = _slim_items_for_gaps(items)
    prompt = f"""Analyze this wardrobe for gaps by occasion and season.

Wardrobe: {json.dumps(slimmed)}

Return ONLY JSON:
{{
  "gaps": [
    {{"occasion": "formal", "missing_items": ["dress shirt", "formal trousers"], "priority": "high", "reason": "0 formal outfits possible"}}
  ],
  "coverage_score": {{"casual": 8, "work": 4, "formal": 0, "sport": 2}}
}}"""

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.1},
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)
        raw = resp.json()["message"]["content"]
        result = parse_ai_json(raw)
        if isinstance(result, dict) and "gaps" in result:
            return result
        return {"gaps": [], "coverage_score": {}}
    except Exception:
        return {"gaps": [], "coverage_score": {}}
