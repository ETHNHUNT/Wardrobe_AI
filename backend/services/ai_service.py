import logging
import re
import json
import base64
import os

import httpx

logger = logging.getLogger("wardrobeai.ai")

# ── Ollama config ──────────────────────────────────────────────────────────────
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3.5:2b"

# ── Gemini fallback config (REST API via httpx — no extra dependencies) ────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash-lite"
_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def gemini_available() -> bool:
    return bool(GEMINI_API_KEY)


# ── Prompts ────────────────────────────────────────────────────────────────────
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

# ── JSON helpers ───────────────────────────────────────────────────────────────

def parse_ai_json(raw: str) -> dict:
    """Strip think tags and markdown fences, then parse JSON. Returns {} on failure."""
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


# ── Gemini REST helpers ────────────────────────────────────────────────────────

def _gemini_image_part(image_path: str) -> dict:
    """Build a Gemini inline_data part from a local image file."""
    with open(image_path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    # Detect mime type from extension
    ext = image_path.rsplit(".", 1)[-1].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")
    return {"inline_data": {"mime_type": mime, "data": data}}


async def _gemini_vision(image_path: str, prompt: str) -> str:
    """Call Gemini REST API with an image + text prompt. Returns raw text or ''."""
    url = f"{_GEMINI_BASE}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                _gemini_image_part(image_path),
            ]
        }],
        "generationConfig": {"temperature": 0.1},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, json=payload)
    if resp.status_code != 200:
        logger.warning("Gemini vision returned HTTP %s: %s", resp.status_code, resp.text[:200])
        return ""
    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        logger.warning("Gemini vision: unexpected response structure: %s", str(data)[:200])
        return ""


async def _gemini_text(prompt: str, temperature: float = 0.1) -> str:
    """Call Gemini REST API with a text-only prompt. Returns raw text or ''."""
    url = f"{_GEMINI_BASE}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, json=payload)
    if resp.status_code != 200:
        logger.warning("Gemini text returned HTTP %s: %s", resp.status_code, resp.text[:200])
        return ""
    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        logger.warning("Gemini text: unexpected response structure: %s", str(data)[:200])
        return ""


# ── Ollama helpers ─────────────────────────────────────────────────────────────

async def _ollama_vision(image_path: str, prompt: str, temperature: float = 0.1) -> str:
    """Call Ollama vision. Returns raw text or raises on failure."""
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode()
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt, "images": [image_data]}],
        "stream": False,
        "options": {"temperature": temperature},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
    return resp.json()["message"]["content"]


async def _ollama_text(prompt: str, temperature: float = 0.1) -> str:
    """Call Ollama text. Returns raw text or raises on failure."""
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": temperature},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
    return resp.json()["message"]["content"]


# ── Public AI functions ────────────────────────────────────────────────────────

async def tag_clothing_image(image_path: str) -> dict:
    """
    Tag a clothing image via Ollama (primary) or Gemini (fallback).
    Returns parsed dict on success, empty dict on total failure.
    Caller shows manual tag form when empty dict is returned.
    """
    # Try Ollama first
    try:
        raw = await _ollama_vision(image_path, TAGGING_PROMPT, temperature=0.1)
        result = parse_ai_json(raw)
        if result:
            return result
    except Exception:
        pass

    # Gemini fallback
    if gemini_available():
        logger.info("Ollama tagging failed — falling back to Gemini")
        try:
            raw = await _gemini_vision(image_path, TAGGING_PROMPT)
            result = parse_ai_json(raw)
            if result:
                return result
        except Exception as e:
            logger.warning("Gemini tagging fallback failed: %s", e)

    return {}


async def infer_garment_measurements(image_path: str, category: str) -> dict:
    """
    Estimate garment dimensions from a photo via Ollama or Gemini fallback.
    Returns dict with non-null numeric measurement fields, or {} on failure.
    Never blocks upload — always called after item is already saved.
    """
    prompt = f"Category: {category}\n\n{_GARMENT_MEASUREMENT_PROMPT}"

    raw = ""
    # Try Ollama first
    try:
        raw = await _ollama_vision(image_path, prompt, temperature=0.2)
    except Exception:
        pass

    # Gemini fallback
    if not raw and gemini_available():
        try:
            raw = await _gemini_vision(image_path, prompt)
        except Exception:
            pass

    if not raw:
        return {}

    result = parse_ai_json(raw)
    if not isinstance(result, dict):
        return {}
    return {k: v for k, v in result.items() if isinstance(v, (int, float))}


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
    skin_tone_context: str | None = None,
    color_harmony_hints: list[str] | None = None,
    wear_frequency: dict[int, int] | None = None,
    shoe_pairing_context: str | None = None,
    trend_context: str | None = None,
    style_rules_context: str | None = None,
) -> list[dict]:
    """
    Generate 3 outfit suggestions via Ollama (primary) or Gemini (fallback).
    Returns list of {"items": [...], "reason": "...", "styling_tips": [...],
    "color_reason": "...", "shoe_recommendation": "...", "trend_tags": [...]} dicts,
    or [] on failure.
    """
    past_context = ""
    if past_outfits:
        slim_past = [{"item_ids": o.get("item_ids"), "rating": o.get("rating"), "name": o.get("name")} for o in past_outfits]
        past_context = f"\nUser's highly-rated past outfits (style reference — do not duplicate): {json.dumps(slim_past)}\n"

    skin_section = ""
    if skin_tone_context:
        skin_section = f"\n{skin_tone_context}\n"

    harmony_section = ""
    if color_harmony_hints:
        harmony_section = f"\nColor harmony hints (items that form curated palettes): {json.dumps(color_harmony_hints[:5])}\n"

    wear_section = ""
    if wear_frequency:
        least_worn = sorted(wear_frequency, key=wear_frequency.get)[:6]
        wear_section = f"\nItems worn least (prefer these for variety): {least_worn}\n"

    shoe_section = ""
    if shoe_pairing_context:
        shoe_section = f"\n{shoe_pairing_context}\n"

    trend_section = ""
    if trend_context:
        trend_section = f"\nFashion context for {season}: {trend_context}\n"

    style_rules_section = ""
    if style_rules_context:
        style_rules_section = f"\n{style_rules_context}\n"

    prompt = f"""You are a personal stylist for an Indian man. Suggest exactly 3 outfits for occasion: {occasion}, season: {season}.
{skin_section}{past_context}{harmony_section}{wear_section}{shoe_section}{trend_section}{style_rules_section}
Wardrobe: {json.dumps(_slim_items(items))}

Rules:
1. Each outfit MUST have at least 1 top (tshirt/shirt/polo/jacket/hoodie/sweater) + 1 bottom (jeans/chinos/trousers/shorts).
2. Each outfit 2-4 items total. Shoes optional but recommended.
3. Color-coordinate using harmony hints when possible.
4. Match the requested occasion and season.
5. {"Prioritize colors that flatter the user's skin tone." if skin_tone_context else "Choose colors that create good contrast."}
6. Avoid duplicating past outfits exactly.
7. Vary item usage — prefer least-worn items.
8. Include shoe_recommendation per outfit: specific shoe type to complete the look (not an item ID from the wardrobe).
9. Add trend_tags: 1-3 current style trends or keywords this outfit incorporates.
10. Add styling_tips: 2-3 specific how-to-wear instructions (e.g. "Tuck the shirt for a cleaner silhouette", "Roll up sleeves to show cuff detail", "Leave jacket unbuttoned for a relaxed layer").
11. Add color_reason: 1 sentence explaining why the color combination works (e.g. "Navy and white follow the 60-30-10 rule — navy grounds the look, white shirt is the focal point").

Return ONLY JSON array:
[
  {{"items": [1, 3], "reason": "brief note explaining why this works", "styling_tips": ["Tuck the shirt for a clean silhouette", "Roll sleeves to the elbow"], "color_reason": "Navy and white create a classic high-contrast pairing.", "shoe_recommendation": "white chunky sneakers", "trend_tags": ["relaxed fit", "earth tones"]}},
  {{"items": [2, 5, 7], "reason": "brief note explaining why this works", "styling_tips": ["Leave top button undone for a relaxed feel"], "color_reason": "Earth tones create a monochromatic depth.", "shoe_recommendation": "loafers", "trend_tags": ["quiet luxury"]}},
  {{"items": [1, 4, 6], "reason": "brief note explaining why this works", "styling_tips": ["Pair fitted top with relaxed bottom for proportion balance"], "color_reason": "Olive and black follow a neutral foundation with subtle contrast.", "shoe_recommendation": "chelsea boots", "trend_tags": ["straight-leg", "monochromatic"]}}
]"""

    raw = ""
    # Try Ollama first
    try:
        raw = await _ollama_text(prompt, temperature=0.3)
    except Exception:
        pass

    # Gemini fallback
    if not raw and gemini_available():
        try:
            raw = await _gemini_text(prompt, temperature=0.3)
        except Exception:
            pass

    if not raw:
        return []

    result = parse_ai_json(raw)
    return result if isinstance(result, list) else []


async def generate_week_outfits(
    items: list[dict],
    week_context: str = "typical work week",
    skin_tone_context: str | None = None,
) -> list[dict]:
    """
    Generate a 7-day outfit plan via Ollama (primary) or Gemini (fallback).
    Returns list of {"day": "Monday", "occasion": "...", "items": [...], "reason": "..."} or [].
    """
    skin_section = f"\n{skin_tone_context}\n" if skin_tone_context else ""

    prompt = f"""You are a personal stylist for an Indian man. Plan 7 daily outfits for a {week_context}.
Monday–Friday: work/casual rotation. Saturday–Sunday: relaxed/casual.
{skin_section}
Wardrobe: {json.dumps(_slim_items(items))}

Rules:
1. Each outfit MUST have at least 1 top + 1 bottom. 2-4 items per outfit.
2. Color-coordinate. {"Prioritize flattering colors for the user's skin tone." if skin_tone_context else ""}
3. No identical outfits. Vary looks across the week.
Return ONLY a JSON array with exactly 7 objects:
[
  {{"day": "Monday",    "occasion": "work",   "items": [1, 3],    "reason": "brief note"}},
  {{"day": "Tuesday",   "occasion": "casual", "items": [2, 5],    "reason": "brief note"}},
  {{"day": "Wednesday", "occasion": "work",   "items": [1, 4, 6], "reason": "brief note"}},
  {{"day": "Thursday",  "occasion": "casual", "items": [3, 7],    "reason": "brief note"}},
  {{"day": "Friday",    "occasion": "work",   "items": [2, 4],    "reason": "brief note"}},
  {{"day": "Saturday",  "occasion": "casual", "items": [5, 8],    "reason": "brief note"}},
  {{"day": "Sunday",    "occasion": "casual", "items": [1, 6],    "reason": "brief note"}}
]"""

    raw = ""
    try:
        raw = await _ollama_text(prompt, temperature=0.4)
    except Exception:
        pass

    if not raw and gemini_available():
        try:
            raw = await _gemini_text(prompt, temperature=0.4)
        except Exception:
            pass

    if not raw:
        return []

    result = parse_ai_json(raw)
    return result if isinstance(result, list) else []


async def analyze_gaps(items: list[dict], skin_tone_context: str | None = None) -> dict:
    """
    Analyze wardrobe gaps by occasion and season via Ollama or Gemini fallback.
    Returns {"gaps": [...], "coverage_score": {...}} on success,
    or {"gaps": [], "coverage_score": {}} on failure.
    """
    slimmed = _slim_items(items, keep=_GAPS_FIELDS)
    skin_section = f"\n{skin_tone_context}\nWhen suggesting missing items, recommend colors that flatter the user's skin tone.\n" if skin_tone_context else ""

    prompt = f"""Analyze this wardrobe for gaps by occasion and season.
{skin_section}
Wardrobe: {json.dumps(slimmed)}

Return ONLY JSON:
{{
  "gaps": [
    {{"occasion": "formal", "missing_items": ["dress shirt", "formal trousers"], "priority": "high", "reason": "0 formal outfits possible"}}
  ],
  "coverage_score": {{"casual": 8, "work": 4, "formal": 0, "sport": 2}}
}}"""

    raw = ""
    # Try Ollama first
    try:
        raw = await _ollama_text(prompt, temperature=0.1)
    except Exception:
        pass

    # Gemini fallback
    if not raw and gemini_available():
        try:
            raw = await _gemini_text(prompt, temperature=0.1)
        except Exception:
            pass

    if raw:
        result = parse_ai_json(raw)
        if isinstance(result, dict) and "gaps" in result:
            return result

    return {"gaps": [], "coverage_score": {}}


# ── Category sets (shared with shopping_service) ─────────────────────────────

TOPS_CATEGORIES: frozenset[str] = frozenset({"tshirt", "shirt", "polo", "jacket", "hoodie", "sweater", "blazer", "coat", "top"})
BOTTOMS_CATEGORIES: frozenset[str] = frozenset({"jeans", "chinos", "trousers", "shorts"})
SHOES_CATEGORIES: frozenset[str] = frozenset({"shoes", "sneakers", "boots", "formal_shoes"})


# ── Outfit validation ────────────────────────────────────────────────────────

def validate_outfit(item_ids: list[int], item_map: dict[int, dict]) -> bool:
    """Ensure outfit has at least one top and one bottom."""
    categories = {item_map[iid].get("category", "other") for iid in item_ids if iid in item_map}
    return bool(categories & TOPS_CATEGORIES) and bool(categories & BOTTOMS_CATEGORIES)
