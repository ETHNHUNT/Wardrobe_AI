from fastapi import APIRouter, Depends
from sqlmodel import Session
from pydantic import BaseModel

from database import get_session
from models.user import UserProfile

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

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile
