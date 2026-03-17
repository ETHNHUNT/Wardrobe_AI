import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models.item import ClothingItem
from models.outfit import SavedOutfit
from models.user import UserProfile
from services.ai_service import generate_outfits, generate_week_outfits, validate_outfit
from services.skin_tone_service import get_skin_tone_context_for_ai
from services.color_service import get_palette_harmony_score
from services.knowledge_service import get_shoe_pairing_context_for_ai, get_trend_context_for_ai

router = APIRouter()


def _parse_ids(raw: str) -> list[int]:
    try:
        return json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []


class GenerateRequest(BaseModel):
    occasion: str
    season: str


class WeekPlanRequest(BaseModel):
    week_context: str = "typical work week"


class SaveOutfitRequest(BaseModel):
    item_ids: list[int]
    occasion: str | None = None
    season: str | None = None
    rating: int | None = None
    name: str | None = None


class OutfitUpdate(BaseModel):
    rating: int | None = None
    name: str | None = None


@router.post("/outfits/generate")
async def generate_outfit_suggestions(
    req: GenerateRequest,
    session: Session = Depends(get_session),
):
    query = select(ClothingItem)
    if req.occasion:
        query = query.where(ClothingItem.occasions.like(f'%"{req.occasion}"%'))
    if req.season:
        query = query.where(ClothingItem.seasons.like(f'%"{req.season}"%'))
    items = session.exec(query).all()

    if len(items) < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough items in wardrobe for this occasion/season. Add more items first.",
        )

    items_as_dicts = [i.model_dump() for i in items]

    # Fetch skin tone context from user profile
    profile = session.get(UserProfile, 1)
    skin_tone_context = None
    if profile:
        skin_tone_context = get_skin_tone_context_for_ai(profile.skin_tone, profile.undertone)

    # Build color harmony hints from Sanzo Wada palette matching
    _all_colors = []
    for itm in items_as_dicts:
        try:
            _all_colors.extend(json.loads(itm.get("colors", "[]")) if isinstance(itm.get("colors"), str) else itm.get("colors", []))
        except (json.JSONDecodeError, TypeError):
            pass
    harmony_hints = list(set(_all_colors))[:10] if _all_colors else None

    # Build wear frequency map for variety
    wear_freq = {i["id"]: i.get("times_worn", 0) for i in items_as_dicts}

    # Iteration 6: pass top-rated/worn outfits as preference context
    top_outfits_query = (
        select(SavedOutfit)
        .where(SavedOutfit.rating >= 4)
        .order_by(SavedOutfit.rating.desc(), SavedOutfit.times_worn.desc())
        .limit(5)
    )
    top_outfits = [o.model_dump() for o in session.exec(top_outfits_query).all()]

    # v1.3: Build shoe pairing and trend context from fashion knowledge base
    bottom_categories = [
        i["category"] for i in items_as_dicts
        if i.get("category") in {"jeans", "chinos", "trousers", "shorts"}
    ]
    fit_types = [i.get("fit_type") for i in items_as_dicts if i.get("fit_type")]
    shoe_pairing_context = get_shoe_pairing_context_for_ai(bottom_categories, fit_types) or None
    trend_context = get_trend_context_for_ai(req.season) or None

    suggestions = await generate_outfits(
        items_as_dicts, req.occasion, req.season,
        past_outfits=top_outfits,
        skin_tone_context=skin_tone_context or None,
        color_harmony_hints=harmony_hints,
        wear_frequency=wear_freq,
        shoe_pairing_context=shoe_pairing_context,
        trend_context=trend_context,
    )

    if not suggestions:
        raise HTTPException(
            status_code=503,
            detail="AI outfit generation failed. Start Ollama or set GEMINI_API_KEY to enable AI features.",
        )

    item_map = {i.id: i.model_dump() for i in items}
    enriched = []
    for suggestion in suggestions:
        suggestion_ids = [iid for iid in suggestion.get("items", []) if iid in item_map]
        resolved_items = [item_map[iid] for iid in suggestion_ids]
        if not resolved_items:
            continue

        # Validate outfit has top + bottom; skip invalid ones
        if not validate_outfit(suggestion_ids, item_map):
            continue

        # Compute color harmony score for this outfit
        outfit_colors = []
        for itm in resolved_items:
            try:
                outfit_colors.extend(json.loads(itm.get("colors", "[]")) if isinstance(itm.get("colors"), str) else itm.get("colors", []))
            except (json.JSONDecodeError, TypeError):
                pass
        harmony_score = get_palette_harmony_score(outfit_colors) if outfit_colors else 0.0

        enriched.append(
            {
                "items": resolved_items,
                "item_ids": [i["id"] for i in resolved_items],
                "reason": suggestion.get("reason", ""),
                "harmony_score": round(harmony_score, 2),
                "shoe_recommendation": suggestion.get("shoe_recommendation") or None,
                "trend_tags": suggestion.get("trend_tags") or [],
            }
        )

    return {"occasion": req.occasion, "season": req.season, "suggestions": enriched}


@router.post("/outfits/generate-week")
async def generate_week_plan(
    req: WeekPlanRequest,
    session: Session = Depends(get_session),
):
    """Generate a 7-day outfit plan. Returns list of day plans with full item objects."""
    items = session.exec(select(ClothingItem)).all()
    if len(items) < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough items in wardrobe for a week plan. Add more items first.",
        )

    items_as_dicts = [i.model_dump() for i in items]

    # Fetch skin tone context
    profile = session.get(UserProfile, 1)
    skin_tone_context = None
    if profile:
        skin_tone_context = get_skin_tone_context_for_ai(profile.skin_tone, profile.undertone)

    week_suggestions = await generate_week_outfits(items_as_dicts, req.week_context, skin_tone_context=skin_tone_context or None)

    if not week_suggestions:
        raise HTTPException(
            status_code=503,
            detail="AI week plan generation failed. Start Ollama or set GEMINI_API_KEY to enable AI features.",
        )

    item_map = {i.id: i.model_dump() for i in items}
    enriched = []
    for day_plan in week_suggestions:
        resolved_items = [
            item_map[iid]
            for iid in day_plan.get("items", [])
            if iid in item_map
        ]
        enriched.append({
            "day": day_plan.get("day", ""),
            "occasion": day_plan.get("occasion", "casual"),
            "items": resolved_items,
            "item_ids": [i["id"] for i in resolved_items],
            "reason": day_plan.get("reason", ""),
        })

    return {"week_context": req.week_context, "days": enriched}


@router.get("/outfits")
def list_outfits(
    occasion: str | None = None,
    season: str | None = None,
    session: Session = Depends(get_session),
):
    query = select(SavedOutfit).order_by(SavedOutfit.created_at.desc())
    if occasion:
        query = query.where(SavedOutfit.occasion == occasion)
    if season:
        query = query.where(SavedOutfit.season == season)
    outfits = session.exec(query).all()

    # Collect all item IDs across all outfits, fetch in a single query
    all_ids = [iid for o in outfits for iid in _parse_ids(o.item_ids)]
    if all_ids:
        item_map = {
            i.id: i
            for i in session.exec(select(ClothingItem).where(ClothingItem.id.in_(all_ids))).all()
        }
    else:
        item_map = {}

    result = []
    for outfit in outfits:
        item_ids = _parse_ids(outfit.item_ids)
        items = [item_map[iid] for iid in item_ids if iid in item_map]
        missing_ids = [iid for iid in item_ids if iid not in item_map]
        result.append(
            {
                **outfit.model_dump(),
                "items": [i.model_dump() for i in items],
                "missing_items": missing_ids,  # IDs that were deleted from wardrobe
            }
        )
    return result


@router.post("/outfits")
def save_outfit(req: SaveOutfitRequest, session: Session = Depends(get_session)):
    if req.rating is not None and not (1 <= req.rating <= 5):
        raise HTTPException(status_code=422, detail="Rating must be between 1 and 5")
    outfit = SavedOutfit(
        item_ids=json.dumps(req.item_ids),
        occasion=req.occasion,
        season=req.season,
        rating=req.rating,
        name=req.name,
    )
    session.add(outfit)
    session.commit()
    session.refresh(outfit)
    return outfit


@router.put("/outfits/{outfit_id}")
def update_outfit(
    outfit_id: int, data: OutfitUpdate, session: Session = Depends(get_session)
):
    outfit = session.get(SavedOutfit, outfit_id)
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    if data.rating is not None:
        if not (1 <= data.rating <= 5):
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        outfit.rating = data.rating
    if data.name is not None:
        outfit.name = data.name or None
    session.add(outfit)
    session.commit()
    session.refresh(outfit)
    return outfit


@router.post("/outfits/{outfit_id}/worn")
def mark_outfit_worn(outfit_id: int, session: Session = Depends(get_session)):
    """
    Iteration 6: Increment times_worn on an outfit and set worn_date to now.
    Also increments times_worn on each item in the outfit.
    """
    outfit = session.get(SavedOutfit, outfit_id)
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    outfit.times_worn = (outfit.times_worn or 0) + 1
    outfit.worn_date = datetime.now(timezone.utc).isoformat()

    # Batch-increment times_worn on each item in the outfit
    try:
        item_ids = json.loads(outfit.item_ids or "[]")
    except json.JSONDecodeError:
        item_ids = []

    _now = datetime.now(timezone.utc).isoformat()
    for iid in item_ids:
        item = session.get(ClothingItem, iid)
        if item:
            item.times_worn = (item.times_worn or 0) + 1
            item.last_worn_date = _now
            session.add(item)

    session.add(outfit)
    session.commit()
    session.refresh(outfit)
    return {"id": outfit.id, "times_worn": outfit.times_worn, "worn_date": outfit.worn_date}


@router.get("/outfits/history")
def outfit_history(session: Session = Depends(get_session)):
    """
    Iteration 6: Return outfits that have been marked as worn, sorted by worn_date DESC.
    """
    query = (
        select(SavedOutfit)
        .where(SavedOutfit.times_worn > 0)
        .order_by(SavedOutfit.worn_date.desc())
    )
    outfits = session.exec(query).all()

    all_ids = [iid for o in outfits for iid in _parse_ids(o.item_ids)]
    if all_ids:
        item_map = {
            i.id: i
            for i in session.exec(select(ClothingItem).where(ClothingItem.id.in_(all_ids))).all()
        }
    else:
        item_map = {}

    result = []
    for outfit in outfits:
        item_ids = _parse_ids(outfit.item_ids)
        items = [item_map[iid].model_dump() for iid in item_ids if iid in item_map]
        result.append({**outfit.model_dump(), "items": items})
    return result


@router.delete("/outfits/{outfit_id}")
def delete_outfit(outfit_id: int, session: Session = Depends(get_session)):
    outfit = session.get(SavedOutfit, outfit_id)
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    session.delete(outfit)
    session.commit()
    return {"ok": True}
