from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class ClothingItem(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    photo_path: str                          # filename only: "42_1709900000.jpg"
    category: str                            # tshirt, shirt, jeans, chinos, jacket, etc.
    colors: str = "[]"                       # JSON array: ["navy", "white"]
    tags: str = "[]"                         # JSON array: ["slim-fit", "cotton", "striped"]
    brand: str | None = None
    size_label: str | None = None
    fit_type: str | None = None              # slim, regular, oversized, relaxed
    occasions: str = "[]"                    # JSON array: ["casual", "work", "formal"]
    seasons: str = "[]"                      # JSON array: ["spring", "summer", "fall", "winter"]
    date_added: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    times_worn: int = 0
    notes: str | None = None
    # Iteration 1: garment physical specs (actual garment dimensions, not body measurements)
    garment_measurements: str = "{}"  # JSON: {"chest_width_cm": 54, "body_length_cm": 72, "sleeve_cm": 62, "waist_cm": 82}
    material: str | None = None       # e.g. "100% cotton" or "98% cotton 2% elastane"
    # Iteration 7: track when item was last worn (ISO-8601 string)
    last_worn_date: str | None = None
    # Iteration 9: online product lookup result
    product_url: str | None = None
    source_description: str | None = None
