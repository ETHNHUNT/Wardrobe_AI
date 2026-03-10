import time

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from database import get_session
from models.item import ClothingItem
from models.user import UserProfile
from services.ai_service import analyze_gaps
from services.shopping_service import compute_local_coverage, build_suggestions

router = APIRouter()

# Simple in-memory cache for analyze_gaps — avoids a second 30-60s Ollama call
# when /shop/gaps and /shop/suggest are both called on the same page load.
_gaps_cache: dict = {"result": None, "item_count": -1, "ts": 0.0}
_GAPS_CACHE_TTL = 30  # seconds


async def _get_gaps_cached(items: list[dict], *, force: bool = False) -> dict:
    now = time.monotonic()
    if (
        not force
        and _gaps_cache["item_count"] == len(items)
        and now - _gaps_cache["ts"] < _GAPS_CACHE_TTL
        and _gaps_cache["result"] is not None
    ):
        return _gaps_cache["result"]
    result = await analyze_gaps(items)
    _gaps_cache.update({"result": result, "item_count": len(items), "ts": now})
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
    ai_result = await _get_gaps_cached(items, force=force)
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

    ai_result = await _get_gaps_cached(items)  # reuses cached result from /shop/gaps if fresh
    gaps = ai_result.get("gaps", [])
    suggestions = build_suggestions(gaps, profile.model_dump(), brand, budget_cad)

    return {
        "suggestions": suggestions,
        "brand": brand,
        "budget_cad": budget_cad,
    }
