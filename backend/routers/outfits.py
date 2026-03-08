import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models.item import ClothingItem
from models.outfit import SavedOutfit
from services.ai_service import generate_outfits

router = APIRouter()


class GenerateRequest(BaseModel):
    occasion: str
    season: str


class SaveOutfitRequest(BaseModel):
    item_ids: list[int]
    occasion: str | None = None
    season: str | None = None
    rating: int | None = None


class RatingUpdate(BaseModel):
    rating: int


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
    suggestions = await generate_outfits(items_as_dicts, req.occasion, req.season)

    if not suggestions:
        raise HTTPException(
            status_code=503,
            detail="AI outfit generation failed. Make sure Ollama is running.",
        )

    item_map = {i.id: i.model_dump() for i in items}
    enriched = []
    for suggestion in suggestions:
        resolved_items = [
            item_map[iid]
            for iid in suggestion.get("items", [])
            if iid in item_map
        ]
        if resolved_items:
            enriched.append(
                {
                    "items": resolved_items,
                    "item_ids": [i["id"] for i in resolved_items],
                    "reason": suggestion.get("reason", ""),
                }
            )

    return {"occasion": req.occasion, "season": req.season, "suggestions": enriched}


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
    all_ids = [iid for o in outfits for iid in json.loads(o.item_ids)]
    if all_ids:
        item_map = {
            i.id: i
            for i in session.exec(select(ClothingItem).where(ClothingItem.id.in_(all_ids))).all()
        }
    else:
        item_map = {}

    result = []
    for outfit in outfits:
        item_ids = json.loads(outfit.item_ids)
        items = [item_map[iid] for iid in item_ids if iid in item_map]
        result.append(
            {
                **outfit.model_dump(),
                "items": [i.model_dump() for i in items],
            }
        )
    return result


@router.post("/outfits")
def save_outfit(req: SaveOutfitRequest, session: Session = Depends(get_session)):
    outfit = SavedOutfit(
        item_ids=json.dumps(req.item_ids),
        occasion=req.occasion,
        season=req.season,
        rating=req.rating,
    )
    session.add(outfit)
    session.commit()
    session.refresh(outfit)
    return outfit


@router.put("/outfits/{outfit_id}")
def update_outfit(
    outfit_id: int, data: RatingUpdate, session: Session = Depends(get_session)
):
    outfit = session.get(SavedOutfit, outfit_id)
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    if not (1 <= data.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    outfit.rating = data.rating
    session.add(outfit)
    session.commit()
    session.refresh(outfit)
    return outfit


@router.delete("/outfits/{outfit_id}")
def delete_outfit(outfit_id: int, session: Session = Depends(get_session)):
    outfit = session.get(SavedOutfit, outfit_id)
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    session.delete(outfit)
    session.commit()
    return {"ok": True}
