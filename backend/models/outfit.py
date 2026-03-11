from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class SavedOutfit(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    item_ids: str              # JSON array of ClothingItem IDs: [1, 3, 7]
    occasion: str | None = None
    season: str | None = None
    rating: int | None = None  # 1-5 stars
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Iteration 6 — worn tracking + naming
    worn_date: str | None = None    # ISO-8601 string of last worn date
    times_worn: int = 0             # how many times this outfit was worn
    name: str | None = None         # optional user-given name: "Work Monday Look"
