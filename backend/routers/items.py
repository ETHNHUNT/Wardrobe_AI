import io
import json
import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from sqlmodel import Session, select

from database import get_session
from models.item import ClothingItem
from services.ai_service import tag_clothing_image

router = APIRouter()
IMAGES_DIR = Path("data/images")


@router.post("/items")
async def add_item(
    photo: UploadFile = File(...),
    metadata: str = Form(None),
    session: Session = Depends(get_session),
):
    """
    Upload a clothing photo (multipart/form-data).
    Optional `metadata` field: JSON string with pre-filled category/brand/etc.
    AI tagging runs automatically; caller checks `ai_tagged` field in response.
    """
    ts = int(time.time())
    tmp_path = IMAGES_DIR / f"tmp_{ts}.jpg"

    # Read and validate the uploaded image
    contents = await photo.read()
    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()  # Validates image integrity; exhausts the PIL handle after this
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Write original bytes to disk (not from exhausted img object)
    tmp_path.write_bytes(contents)

    # Insert placeholder row to obtain the DB-assigned ID
    item = ClothingItem(photo_path="tmp", category="unknown")
    session.add(item)
    session.commit()
    session.refresh(item)

    # Rename file to final name using the real ID
    filename = f"{item.id}_{ts}.jpg"
    final_path = IMAGES_DIR / filename
    tmp_path.rename(final_path)
    item.photo_path = filename

    # Run AI tagging
    tags = await tag_clothing_image(str(final_path))
    ai_tagged = bool(tags)

    if tags:
        item.category = tags.get("category", "other")
        item.colors = json.dumps(tags.get("colors", []))
        item.tags = json.dumps(tags.get("tags", []))
        item.fit_type = tags.get("fit_type")
        item.occasions = json.dumps(tags.get("occasions", []))
        item.seasons = json.dumps(tags.get("seasons", []))

    # User-provided metadata overrides AI (explicit input wins)
    if metadata:
        try:
            meta = json.loads(metadata)
            for field in ("category", "brand", "size_label", "fit_type", "notes"):
                if field in meta and meta[field]:
                    setattr(item, field, meta[field])
            for field in ("colors", "tags", "occasions", "seasons"):
                if field in meta and meta[field]:
                    setattr(item, field, json.dumps(meta[field]))
        except json.JSONDecodeError:
            pass

    session.add(item)
    session.commit()
    session.refresh(item)

    return {**item.model_dump(), "ai_tagged": ai_tagged}


@router.get("/items")
def list_items(
    category: str | None = None,
    occasion: str | None = None,
    season: str | None = None,
    session: Session = Depends(get_session),
):
    """List all clothing items with optional filters."""
    query = select(ClothingItem)
    if category:
        query = query.where(ClothingItem.category == category)
    if occasion:
        # JSON string search: occasions contains "casual" → LIKE '%"casual"%'
        query = query.where(ClothingItem.occasions.like(f'%"{occasion}"%'))
    if season:
        query = query.where(ClothingItem.seasons.like(f'%"{season}"%'))
    return session.exec(query).all()


@router.get("/items/{item_id}")
def get_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(ClothingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/items/{item_id}")
def update_item(item_id: int, data: dict, session: Session = Depends(get_session)):
    """Partial update. Protects id, photo_path, and date_added from being overwritten."""
    item = session.get(ClothingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    protected = {"id", "photo_path", "date_added"}
    for field, value in data.items():
        if field not in protected and hasattr(item, field):
            setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/items/{item_id}")
def delete_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(ClothingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Delete image file from disk
    (IMAGES_DIR / item.photo_path).unlink(missing_ok=True)

    session.delete(item)
    session.commit()
    return {"ok": True}


@router.post("/items/{item_id}/tag")
async def retag_item(item_id: int, session: Session = Depends(get_session)):
    """Re-run AI tagging on an existing item's photo."""
    item = session.get(ClothingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    full_path = IMAGES_DIR / item.photo_path
    tags = await tag_clothing_image(str(full_path))

    if tags:
        item.category = tags.get("category", item.category)
        item.colors = json.dumps(tags.get("colors", []))
        item.tags = json.dumps(tags.get("tags", []))
        item.fit_type = tags.get("fit_type", item.fit_type)
        item.occasions = json.dumps(tags.get("occasions", []))
        item.seasons = json.dumps(tags.get("seasons", []))
        session.add(item)
        session.commit()
        session.refresh(item)

    return {**item.model_dump(), "ai_tagged": bool(tags)}
