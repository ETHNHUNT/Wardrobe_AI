import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger("wardrobeai")

# CRITICAL: import all models before create_db_and_tables() so SQLModel
# registers their tables with the metadata before create_all() is called.
from models.user import UserProfile      # noqa: F401
from models.item import ClothingItem     # noqa: F401
from models.outfit import SavedOutfit    # noqa: F401

from database import create_db_and_tables, run_migrations
from routers import profile, items, outfits, shop


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure images directory exists before StaticFiles serves from it
    os.makedirs("data/images", exist_ok=True)
    create_db_and_tables()
    run_migrations()   # Safe on every restart; adds new columns without dropping data

    # Ollama health check — warning only, non-AI endpoints still work if Ollama is down
    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            if resp.status_code == 200:
                logger.info("Ollama is running and reachable ✓")
                ollama_ok = True
            else:
                logger.warning("Ollama responded with status %s — AI features may be unavailable", resp.status_code)
    except Exception:
        logger.warning(
            "Ollama is not reachable at http://localhost:11434 — "
            "AI tagging and outfit generation will fall back to Gemini or be unavailable."
        )

    # Gemini fallback status
    from services.ai_service import gemini_available
    if gemini_available():
        logger.warning("Gemini fallback is configured and ready ✓")
    elif not ollama_ok:
        logger.warning("No AI backend available — set GEMINI_API_KEY or start Ollama for AI features.")

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
# CRITICAL: StaticFiles mounts at import time (before lifespan), so ensure directory exists now.
os.makedirs("data/images", exist_ok=True)
app.mount("/images", StaticFiles(directory="data/images"), name="images")

app.include_router(profile.router)
app.include_router(items.router)
app.include_router(outfits.router)
app.include_router(shop.router)
