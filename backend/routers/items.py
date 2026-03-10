import io
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models.item import ClothingItem
from services.ai_service import tag_clothing_image
from services.barcode_service import lookup_upc

router = APIRouter()
IMAGES_DIR = Path("data/images")


class ClothingItemUpdate(BaseModel):
    category: str | None = None
    colors: list[str] | None = None
    tags: list[str] | None = None
    brand: str | None = None
    size_label: str | None = None
    fit_type: str | None = None
    occasions: list[str] | None = None
    seasons: list[str] | None = None
    notes: str | None = None


def _apply_tags(item: ClothingItem, tags: dict, *, preserve_existing: bool = False) -> None:
    """Write AI tag fields onto a ClothingItem in place.

    When preserve_existing=True (re-tag flow), only overwrite a field if the AI
    returned a non-empty value for it; otherwise keep whatever is already stored.
    """
    item.category = tags.get("category", item.category if preserve_existing else "other")
    item.fit_type = tags.get("fit_type", item.fit_type if preserve_existing else None)
    for field in ("colors", "tags", "occasions", "seasons"):
        ai_val = tags.get(field)
        if ai_val or not preserve_existing:
            setattr(item, field, json.dumps(ai_val or []))


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
    uid = uuid.uuid4().hex
    tmp_path = IMAGES_DIR / f"tmp_{uid}.jpg"

    # Read and validate the uploaded image
    contents = await photo.read()
    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()  # Validates image integrity; exhausts the PIL handle after this
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Write original bytes to disk (not from exhausted img object)
    tmp_path.write_bytes(contents)

    final_path = None
    try:
        # Flush to get DB-assigned ID without committing the transaction
        item = ClothingItem(photo_path="tmp", category="unknown")
        session.add(item)
        session.flush()
        session.refresh(item)

        # Rename file to final name using the real ID
        filename = f"{item.id}_{uid}.jpg"
        final_path = IMAGES_DIR / filename
        tmp_path.rename(final_path)
        item.photo_path = filename

        # Run AI tagging
        tags = await tag_clothing_image(str(final_path))
        ai_tagged = bool(tags)

        if tags:
            _apply_tags(item, tags, preserve_existing=False)

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
                # Ignore invalid metadata JSON, preserving AI-derived/default values
                pass

        session.add(item)
        session.commit()
        session.refresh(item)

    except Exception:
        # Roll back DB changes and clean up any files on failure
        session.rollback()
        try:
            if final_path is not None and final_path.exists():
                final_path.unlink()
            elif tmp_path.exists():
                tmp_path.unlink()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to process uploaded item")

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


@router.get("/items/barcode/{upc}")
async def lookup_barcode(upc: str):
    """Look up a clothing item by UPC barcode via UPCItemDB."""
    result = await lookup_upc(upc)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found for this barcode")
    return result


@router.post("/items/{item_id}/worn")
def mark_worn(item_id: int, session: Session = Depends(get_session)):
    """Increment the times_worn counter for an item."""
    item = session.get(ClothingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.times_worn = (item.times_worn or 0) + 1
    session.add(item)
    session.commit()
    session.refresh(item)
    return {"id": item.id, "times_worn": item.times_worn}


@router.get("/items/{item_id}")
def get_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(ClothingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/items/{item_id}")
def update_item(item_id: int, data: ClothingItemUpdate, session: Session = Depends(get_session)):
    """Partial update. Only writable fields accepted; id, photo_path, date_added are protected by omission."""
    item = session.get(ClothingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    _LIST_FIELDS = {"colors", "tags", "occasions", "seasons"}
    for field, value in data.model_dump(exclude_none=True).items():
        if field in _LIST_FIELDS:
            setattr(item, field, json.dumps(value))
        else:
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
        _apply_tags(item, tags, preserve_existing=True)
        session.add(item)
        session.commit()
        session.refresh(item)

    return {**item.model_dump(), "ai_tagged": bool(tags)}
