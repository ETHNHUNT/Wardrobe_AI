from fastapi import APIRouter, Depends
from sqlmodel import Session
from pydantic import BaseModel

from database import get_session
from models.user import UserProfile
from routers.shop import invalidate_gaps_cache

router = APIRouter()


class ProfileUpdate(BaseModel):
    name: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    chest_cm: float | None = None
    waist_cm: float | None = None
    hips_cm: float | None = None
    inseam_cm: float | None = None
    shoulder_cm: float | None = None
    arm_length_cm: float | None = None
    neck_cm: float | None = None
    brand_sizes: str | None = None
    skin_tone: str | None = None       # fair | light-medium | medium | olive | deep
    undertone: str | None = None       # warm | cool | neutral


@router.get("/profile")
def get_profile(session: Session = Depends(get_session)):
    """Return the single user profile. Auto-creates default on first call."""
    profile = session.get(UserProfile, 1)
    if not profile:
        profile = UserProfile()
        session.add(profile)
        session.commit()
        session.refresh(profile)
    return profile


@router.post("/profile")
def update_profile(data: ProfileUpdate, session: Session = Depends(get_session)):
    """Update user profile fields. Only provided fields are updated."""
    profile = session.get(UserProfile, 1)
    if not profile:
        profile = UserProfile()

    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    # Invalidate gaps cache when skin tone changes (affects AI gap analysis)
    if "skin_tone" in update_data or "undertone" in update_data:
        invalidate_gaps_cache()

    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile
