from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from database import get_session
from models.item import ClothingItem
from models.user import UserProfile
from services.ai_service import analyze_gaps
from services.shopping_service import compute_local_coverage, build_suggestions

router = APIRouter()


@router.get("/shop/gaps")
async def get_gaps(session: Session = Depends(get_session)):
    """
    Return wardrobe coverage analysis.
    - local_coverage: instant count per occasion, no AI needed
    - ai_gaps / ai_coverage_score: richer AI analysis from Ollama (may be empty if Ollama is down)
    """
    items = [i.model_dump() for i in session.exec(select(ClothingItem)).all()]
    local_coverage = compute_local_coverage(items)
    ai_result = await analyze_gaps(items)
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

    ai_result = await analyze_gaps(items)
    gaps = ai_result.get("gaps", [])
    suggestions = build_suggestions(gaps, profile.model_dump(), brand, budget_cad)

    return {
        "suggestions": suggestions,
        "brand": brand,
        "budget_cad": budget_cad,
    }
