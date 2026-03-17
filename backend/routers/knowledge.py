"""
knowledge.py — Fashion knowledge base endpoints.

Provides:
  GET  /knowledge/trends               — current + seasonal fashion trends
  GET  /knowledge/style-guide          — style rules + shoe pairings + occasion rules
  GET  /knowledge/fabric/{material}    — fabric properties lookup
  GET  /knowledge/size-chart/{brand}   — size chart + personalised recommendation
  POST /knowledge/size-chart/{brand}/fetch — AI-powered size chart fetch (best-effort)
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from database import get_session
from models.user import UserProfile
from services.ai_service import _ollama_text, _gemini_text, parse_ai_json, gemini_available
from services.knowledge_service import (
    get_trends,
    get_style_rules,
    get_shoe_pairings,
    get_all_shoe_pairings_for_category,
    get_occasion_rules,
    get_fabric_properties,
)
from services.size_chart_service import (
    get_size_chart,
    recommend_size,
    get_available_brands,
    _CHARTS,
    _DATA,
    _DATA_PATH,
)

logger = logging.getLogger("wardrobeai.knowledge")
router = APIRouter()


@router.get("/knowledge/trends")
def knowledge_trends(season: str | None = None):
    """Return current and seasonal fashion trends.

    ?season=spring  → returns spring_2026 seasonal data + current 2026 trends
    (no param)      → returns all seasonal data + current 2026 trends
    """
    data = get_trends(season)
    return {
        "season_filter": season,
        "current_trends": data.get("current", {}),
        "seasonal": data.get("seasonal", {}),
    }


@router.get("/knowledge/style-guide")
def knowledge_style_guide(
    category: str | None = None,
    occasion: str | None = None,
):
    """Return style rules, shoe pairings, and optional occasion guidance.

    ?category=jeans   → filter rules relevant to jeans
    ?occasion=casual  → include casual occasion rules
    """
    categories = [category] if category else None
    rules = get_style_rules(categories)

    shoe_data = get_all_shoe_pairings_for_category(category) if category else {}

    occasion_data = get_occasion_rules(occasion) if occasion else None

    return {
        "style_rules": rules,
        "shoe_pairings": shoe_data,
        "occasion_rules": occasion_data,
    }


@router.get("/knowledge/fabric/{material}")
def knowledge_fabric(material: str):
    """Return fabric properties for a given material string.

    Fuzzy matches: '100% cotton blend' → cotton properties.
    """
    if not material or len(material) < 2:
        raise HTTPException(status_code=400, detail="Material name too short")

    props = get_fabric_properties(material)
    if not props:
        raise HTTPException(
            status_code=404,
            detail=f"No fabric data found for '{material}'. Try: cotton, linen, wool, polyester, denim, silk.",
        )
    return {"material_input": material, "properties": props}


@router.get("/knowledge/size-chart/{brand}")
def knowledge_size_chart(
    brand: str,
    garment_type: str = "tops",
    session: Session = Depends(get_session),
):
    """Return size chart for a brand + personalised size recommendation.

    Uses stored UserProfile body measurements for the recommendation.
    ?garment_type=tops|bottoms  (default: tops)

    Returns:
    {
        "brand": str,
        "chart": dict | None,
        "recommendation": dict | None,
        "available_brands": list[str],
    }
    """
    if garment_type not in ("tops", "bottoms"):
        garment_type = "tops"

    chart = get_size_chart(brand)
    available = get_available_brands()

    profile = session.get(UserProfile, 1)
    recommendation = None

    if profile:
        profile_dict = profile.model_dump()
        recommendation = recommend_size(brand, garment_type, profile_dict)

    return {
        "brand": brand,
        "chart": chart,
        "recommendation": recommendation,
        "available_brands": available,
    }


@router.post("/knowledge/size-chart/{brand}/fetch")
async def fetch_brand_size_chart(brand: str):
    """Best-effort: use Ollama/Gemini to generate a size chart for a new brand.

    The AI is asked to produce a size chart based on its training knowledge of the brand.
    If successful, the chart is merged into the in-memory store and written to size_charts.json.
    Returns the newly generated chart or a 503 if AI is unavailable.

    This is best-effort — AI size data should be verified against the brand's official site.
    """
    if not brand or len(brand) < 2:
        raise HTTPException(status_code=400, detail="Brand name too short")

    # Check if brand already exists
    existing = get_size_chart(brand)
    if existing:
        return {
            "status": "already_exists",
            "brand": brand,
            "chart": existing,
            "available_brands": get_available_brands(),
        }

    prompt = f"""You are a fashion sizing expert. Provide the men's size chart for {brand} clothing brand.
Return ONLY valid JSON in this exact format (no markdown, no explanation):
{{
  "source_url": "official size guide URL if known, otherwise null",
  "last_updated": "2026-03-17",
  "region": "US (men)",
  "tops": {{
    "XS":  {{"chest_cm": [84, 88],  "waist_cm": [68, 72]}},
    "S":   {{"chest_cm": [88, 92],  "waist_cm": [72, 76]}},
    "M":   {{"chest_cm": [92, 96],  "waist_cm": [76, 80]}},
    "L":   {{"chest_cm": [96, 104], "waist_cm": [80, 88]}},
    "XL":  {{"chest_cm": [104, 112],"waist_cm": [88, 96]}},
    "XXL": {{"chest_cm": [112, 120],"waist_cm": [96, 104]}}
  }},
  "bottoms": {{
    "XS":  {{"waist_cm": [68, 72],  "hips_cm": [90, 94]}},
    "S":   {{"waist_cm": [72, 76],  "hips_cm": [94, 98]}},
    "M":   {{"waist_cm": [76, 80],  "hips_cm": [98, 102]}},
    "L":   {{"waist_cm": [80, 88],  "hips_cm": [102, 110]}},
    "XL":  {{"waist_cm": [88, 96],  "hips_cm": [110, 118]}},
    "XXL": {{"waist_cm": [96, 104], "hips_cm": [118, 126]}}
  }},
  "notes": "Any sizing notes for this brand (e.g. runs small/large)"
}}

Use your knowledge of {brand}'s typical sizing. If you don't know this brand, return an approximate standard EU/US chart."""

    raw = ""
    try:
        raw = await _ollama_text(prompt, temperature=0.1)
    except Exception:
        pass

    if not raw and gemini_available():
        try:
            raw = await _gemini_text(prompt, temperature=0.1)
        except Exception:
            pass

    if not raw:
        raise HTTPException(
            status_code=503,
            detail="AI unavailable — start Ollama or set GEMINI_API_KEY to fetch size charts.",
        )

    chart_data = parse_ai_json(raw)
    if not isinstance(chart_data, dict) or "tops" not in chart_data:
        raise HTTPException(
            status_code=500,
            detail=f"AI returned invalid size chart data for {brand}.",
        )

    # Merge into in-memory store
    brand_key = brand.strip().title()
    _CHARTS[brand_key] = chart_data

    # Persist to size_charts.json
    try:
        _DATA["brands"][brand_key] = chart_data
        with open(_DATA_PATH, "w") as f:
            json.dump(_DATA, f, indent=2)
        logger.info("Size chart for %s saved to disk", brand_key)
    except Exception as e:
        logger.warning("Could not persist size chart to disk: %s", e)

    return {
        "status": "created",
        "brand": brand_key,
        "chart": {"brand": brand_key, **chart_data},
        "available_brands": get_available_brands(),
        "note": "AI-generated size data — verify against official brand size guide.",
    }
