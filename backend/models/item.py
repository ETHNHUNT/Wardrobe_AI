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
