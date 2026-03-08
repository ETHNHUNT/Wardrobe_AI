import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# CRITICAL: import all models before create_db_and_tables() so SQLModel
# registers their tables with the metadata before create_all() is called.
from models.user import UserProfile      # noqa: F401
from models.item import ClothingItem     # noqa: F401
from models.outfit import SavedOutfit    # noqa: F401

from database import create_db_and_tables
from routers import profile, items


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure images directory exists before StaticFiles serves from it
    os.makedirs("data/images", exist_ok=True)
    create_db_and_tables()
    yield


app = FastAPI(title="WardrobeAI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Phone on same WiFi needs access
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve clothing photos at /images/{filename}
# e.g. http://192.168.1.105:8000/images/1_1709900000.jpg
app.mount("/images", StaticFiles(directory="data/images"), name="images")

app.include_router(profile.router)
app.include_router(items.router)
