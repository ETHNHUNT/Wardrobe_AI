import time

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from database import get_session
from models.item import ClothingItem
from models.user import UserProfile
from services.ai_service import analyze_gaps
from services.shopping_service import compute_local_coverage, build_suggestions
from services.color_service import get_palette_summary, suggest_complementary_colors
from services.skin_tone_service import get_skin_tone_context_for_ai, get_flattering_colors

router = APIRouter()

# Simple in-memory cache for analyze_gaps — avoids a second 30-60s Ollama call
# when /shop/gaps and /shop/suggest are both called on the same page load.
_gaps_cache: dict = {"result": None, "item_count": -1, "ts": 0.0, "skin_key": ""}
_GAPS_CACHE_TTL = 300  # seconds (AI call takes 30–60s; cache for 5 min to avoid double-call)


def invalidate_gaps_cache():
    _gaps_cache.update({"result": None, "item_count": -1, "ts": 0.0, "skin_key": ""})


async def _get_gaps_cached(items: list[dict], *, force: bool = False, skin_tone_context: str | None = None) -> dict:
    skin_key = skin_tone_context or ""
    now = time.monotonic()
    if (
        not force
        and _gaps_cache["item_count"] == len(items)
        and _gaps_cache["skin_key"] == skin_key
        and now - _gaps_cache["ts"] < _GAPS_CACHE_TTL
        and _gaps_cache["result"] is not None
    ):
        return _gaps_cache["result"]
    result = await analyze_gaps(items, skin_tone_context=skin_tone_context)
    _gaps_cache.update({"result": result, "item_count": len(items), "ts": now, "skin_key": skin_key})
    return result


@router.get("/shop/gaps")
async def get_gaps(force: bool = False, session: Session = Depends(get_session)):
    """
    Return wardrobe coverage analysis.
    - local_coverage: instant count per occasion, no AI needed
    - ai_gaps / ai_coverage_score: richer AI analysis from Ollama (may be empty if Ollama is down)
    """
    items = [i.model_dump() for i in session.exec(select(ClothingItem)).all()]
    local_coverage = compute_local_coverage(items)

    # Build skin tone context for AI gap analysis
    profile = session.get(UserProfile, 1)
    skin_tone_context = None
    if profile:
        skin_tone_context = get_skin_tone_context_for_ai(profile.skin_tone, profile.undertone)

    ai_result = await _get_gaps_cached(items, force=force, skin_tone_context=skin_tone_context or None)
    return {
        "total_items": len(items),
        "local_coverage": local_coverage,
        "ai_gaps": ai_result.get("gaps", []),
        "ai_coverage_score": ai_result.get("coverage_score", {}),
    }


@router.get("/shop/suggest")
async def get_suggestions(
    brand: str | None = None,
    budget_cad: float | None = None,
    session: Session = Depends(get_session),
):
    """
    Return shopping suggestions based on wardrobe gaps and user profile.
    Optional query params: brand (e.g. "zara"), budget_cad (e.g. 100).
    Size recommendations come from profile body measurements and brand_sizes.
    """
    items = [i.model_dump() for i in session.exec(select(ClothingItem)).all()]
    profile = session.get(UserProfile, 1) or UserProfile()
    profile_dict = profile.model_dump()

    # Build skin tone context for cache consistency
    skin_tone_context = get_skin_tone_context_for_ai(profile.skin_tone, profile.undertone) or None
    ai_result = await _get_gaps_cached(items, skin_tone_context=skin_tone_context)
    gaps = ai_result.get("gaps", [])
    suggestions = build_suggestions(
        gaps, profile_dict, brand, budget_cad,
        wardrobe_items=items,
        skin_tone=profile.skin_tone,
        undertone=profile.undertone,
    )

    return {
        "suggestions": suggestions,
        "brand": brand,
        "budget_cad": budget_cad,
    }


@router.get("/shop/palette")
def get_palette(session: Session = Depends(get_session)):
    """
    Iteration 3: Return color palette analysis of the wardrobe.
    Instant — no Ollama call, pure Python color grouping.

    Response:
    {
        "by_group": {"neutrals": 12, "cool": 8, ...},
        "dominant_group": "neutrals",
        "underrepresented": ["warm", "bright"],
        "complementary_suggestions": ["burgundy", "rust", "camel"],
        "all_colors": ["navy", "white", "grey", ...]
    }
    """
    items = [i.model_dump() for i in session.exec(select(ClothingItem)).all()]
    summary = get_palette_summary(items)

    # Pass skin profile so complementary suggestions avoid bad skin tone colors
    profile = session.get(UserProfile, 1)
    skin_profile = None
    if profile and profile.skin_tone and profile.undertone:
        skin_profile = {"skin_tone": profile.skin_tone, "undertone": profile.undertone}
    complementary = suggest_complementary_colors(summary.get("all_colors", []), skin_profile=skin_profile)

    # Also return flattering colors for the user
    flattering = {}
    if profile and profile.skin_tone and profile.undertone:
        flattering = get_flattering_colors(profile.skin_tone, profile.undertone)

    return {**summary, "complementary_suggestions": complementary, "flattering_colors": flattering}
