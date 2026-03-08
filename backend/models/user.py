from sqlmodel import SQLModel, Field


class UserProfile(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)  # Single user, always ID=1
    name: str = "Vipin"
    height_cm: float = 0
    weight_kg: float = 0
    chest_cm: float = 0
    waist_cm: float = 0
    hips_cm: float = 0
    inseam_cm: float = 0
    shoulder_cm: float = 0
    arm_length_cm: float = 0
    neck_cm: float = 0
    brand_sizes: str = "{}"  # JSON string: {"Zara": "M", "H&M": "L"}
