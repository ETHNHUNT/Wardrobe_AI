import re
import json
import base64

import httpx

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3.5:2b"
# Gemini fallback not yet implemented.
# When needed: GEMINI_MODEL = "gemini-2.5-flash-lite", GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

TAGGING_PROMPT = """You are a fashion assistant. Analyze this clothing item photo and return ONLY valid JSON with no markdown, no explanation.

{
  "category": "one of: tshirt, shirt, polo, jacket, hoodie, sweater, jeans, chinos, trousers, shorts, shoes, sneakers, boots, formal_shoes, accessory, other",
  "colors": ["primary color", "secondary color if present"],
  "tags": ["pattern-if-any", "notable-detail-if-any"],
  "fit_type": "one of: slim, regular, oversized, relaxed",
  "occasions": ["one or more of: casual, work, formal, sport, outdoor"],
  "seasons": ["one or more of: spring, summer, fall, winter"],
  "material": "fabric composition if visible on label or clearly inferrable (e.g. 100% cotton, polyester blend). Use null if completely unknown."
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

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)

        raw = resp.json()["message"]["content"]
        return parse_ai_json(raw)

    except httpx.ConnectError:
        # Ollama is not running — caller shows manual form
        return {}
    except Exception:
        # Malformed response, timeout, or any other error
        return {}


_GARMENT_MEASUREMENT_PROMPT = """You are a garment sizing expert. Look at this clothing item photo.
Estimate typical garment measurements for this specific item based on what's visible (size tag, proportions, style).
Return ONLY valid JSON with numeric values in centimeters. Use null for any measurement you cannot reasonably estimate.

For tops (tshirt, shirt, polo, jacket, hoodie, sweater): estimate chest_width_cm (measured flat, half circumference), body_length_cm, sleeve_cm
For bottoms (jeans, chinos, trousers, shorts): estimate waist_cm (garment waist, flat x2), inseam_cm, rise_cm
For shoes/boots: estimate us_size (numeric), uk_size (numeric)
For other items: estimate the most relevant 2-3 dimensions.

Return format:
{
  "chest_width_cm": null_or_number,
  "body_length_cm": null_or_number,
  "sleeve_cm": null_or_number,
  "waist_cm": null_or_number,
  "inseam_cm": null_or_number
}
Only include fields relevant to the category. Omit fields that are clearly not applicable."""


async def infer_garment_measurements(image_path: str, category: str) -> dict:
    """
    Call Ollama vision to estimate garment dimensions from a photo.
    Returns dict with non-null measurement fields, or {} on failure/uncertainty.
    Never blocks upload — always called after item is already saved.
    """
    try:
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode()

        prompt = f"Category: {category}\n\n{_GARMENT_MEASUREMENT_PROMPT}"
        payload = {
            "model": MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [image_data],
                }
            ],
            "stream": False,
            "options": {"temperature": 0.2},
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)

        raw = resp.json()["message"]["content"]
        result = parse_ai_json(raw)
        if not isinstance(result, dict):
            return {}
        # Keep only numeric (non-null) measurements
        return {k: v for k, v in result.items() if isinstance(v, (int, float))}

    except Exception:
        return {}


_OUTFIT_FIELDS = {"id", "category", "colors", "occasions", "seasons", "fit_type"}
_GAPS_FIELDS   = {"id", "category", "occasions", "seasons", "colors"}


def _slim_items(items: list[dict], keep: set = _OUTFIT_FIELDS) -> list[dict]:
    """Trim item dicts to only the specified fields."""
    return [{k: v for k, v in item.items() if k in keep} for item in items]


async def generate_outfits(
    items: list[dict],
    occasion: str,
    season: str,
    past_outfits: list[dict] | None = None,
) -> list[dict]:
    """
    Call Ollama to generate 3 outfit suggestions.
    Returns a list of {"items": [...], "reason": "..."} dicts.
    Returns [] on any failure (Ollama down, malformed JSON, etc).
    Iteration 6: accepts past_outfits as preference context.
    """
    past_context = ""
    if past_outfits:
        slim_past = [{"item_ids": o.get("item_ids"), "rating": o.get("rating"), "name": o.get("name")} for o in past_outfits]
        past_context = f"\nUser's highly-rated past outfits (style reference — do not duplicate): {json.dumps(slim_past)}\n"

    prompt = f"""You are a personal stylist. Suggest exactly 3 outfits for occasion: {occasion}, season: {season}.
{past_context}
Wardrobe: {json.dumps(_slim_items(items))}

Rules: each outfit 2-4 items, color-coordinate, match occasion and season. Avoid duplicating past outfits exactly.
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
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)
        raw = resp.json()["message"]["content"]
        result = parse_ai_json(raw)
        return result if isinstance(result, list) else []
    except Exception:
        return []


async def analyze_gaps(items: list[dict]) -> dict:
    """
    Call Ollama to analyze wardrobe gaps by occasion and season.
    Returns {"gaps": [...], "coverage_score": {...}} on success.
    Returns {"gaps": [], "coverage_score": {}} on any failure (Ollama down, malformed JSON, etc).
    """
    slimmed = _slim_items(items, keep=_GAPS_FIELDS)
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
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)
        raw = resp.json()["message"]["content"]
        result = parse_ai_json(raw)
        if isinstance(result, dict) and "gaps" in result:
            return result
        return {"gaps": [], "coverage_score": {}}
    except Exception:
        return {"gaps": [], "coverage_score": {}}
