# WardrobeAI — Claude Code Instructions

## Project Overview

A personal, locally-hosted AI wardrobe manager. The user (Vipin) runs this on his Windows PC;
his phone connects to it over the same WiFi. No cloud hosting. Zero ongoing cost. Not public. Single user only.

-----

## Tech Stack (Non-Negotiable)

|Layer           |Choice                                 |Reason                                                     |
|----------------|---------------------------------------|-----------------------------------------------------------|
|Backend         |Python 3.10+ / FastAPI                 |Async, fast, works well with Ollama                        |
|Frontend        |React + Vite + Tailwind CSS            |Mobile-friendly, fast dev                                  |
|Database        |SQLite via SQLModel                    |Zero setup, single file, personal use                      |
|AI Primary      |Ollama qwen3.5:2b (2.7GB)              |Local, free, native multimodal, fits 4GB VRAM with headroom|
|AI Fallback     |Google Gemini 2.5 Flash-Lite free tier |For photos qwen3.5:2b struggles with; 1000 req/day free    |
|Image Storage   |Local filesystem (backend/data/images/)|Simple, no cloud                                           |
|Barcode Lookup  |UPCItemDB API free no auth             |https://api.upcitemdb.com/prod/trial/lookup?upc={upc}      |
|Barcode Scanning|@zxing/library npm                     |Phone camera barcode reading in browser                    |

-----

## Hardware Context

- PC: Dell Inspiron 7567 with GTX 1050Ti (4GB VRAM), 16GB RAM, Windows
- Phone: Connects to PC via same WiFi LAN
- Ollama: Runs locally on PC at http://localhost:11434
- Frontend: Served at 0.0.0.0:5173 accessible from phone
- Backend: Served at 0.0.0.0:8000 accessible from phone

-----

## Project Structure

```
wardrobeai/
├── CLAUDE.md
├── backend/
│   ├── main.py                      # FastAPI app entry point
│   ├── database.py                  # SQLite + SQLModel setup
│   ├── models/
│   │   ├── user.py                  # UserProfile model
│   │   ├── item.py                  # ClothingItem model
│   │   └── outfit.py               # SavedOutfit model
│   ├── routers/
│   │   ├── profile.py               # GET/POST /profile
│   │   ├── items.py                 # CRUD /items
│   │   ├── outfits.py               # GET/POST /outfits
│   │   └── shop.py                  # GET /shop/gaps, /shop/suggest
│   ├── services/
│   │   ├── ai_service.py            # Ollama calls (vision + text)
│   │   ├── barcode_service.py       # UPC lookup
│   │   └── shopping_service.py      # Gap analysis + suggestions
│   ├── data/
│   │   └── images/                  # Stored clothing photos
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Wardrobe.jsx
│   │   │   ├── AddItem.jsx
│   │   │   ├── OutfitBuilder.jsx
│   │   │   ├── Profile.jsx
│   │   │   └── Shop.jsx
│   │   ├── components/
│   │   │   ├── ItemCard.jsx
│   │   │   ├── OutfitCard.jsx
│   │   │   ├── BarcodeScanner.jsx
│   │   │   └── Navbar.jsx
│   │   └── App.jsx
│   ├── .env
│   └── package.json
└── README.md
```

-----

## Data Models

### UserProfile

```python
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
```

### ClothingItem

```python
class ClothingItem(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    photo_path: str                          # Relative path: data/images/{id}_{ts}.jpg
    category: str                            # tshirt, shirt, jeans, chinos, jacket, etc.
    colors: str = "[]"                       # JSON array: ["navy", "white"]
    tags: str = "[]"                         # JSON array: ["slim-fit", "cotton", "striped"]
    brand: str | None = None
    size_label: str | None = None
    fit_type: str | None = None             # slim, regular, oversized, relaxed
    occasions: str = "[]"                    # JSON array: ["casual", "work", "formal"]
    seasons: str = "[]"                      # JSON array: ["spring", "summer", "fall", "winter"]
    date_added: datetime = Field(default_factory=datetime.utcnow)
    times_worn: int = 0
    notes: str | None = None
```

### SavedOutfit

```python
class SavedOutfit(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    item_ids: str              # JSON array of ClothingItem IDs: [1, 3, 7]
    occasion: str | None = None
    season: str | None = None
    rating: int | None = None  # 1-5 stars
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

-----

## AI Service

### Model Config

```python
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3.5:2b"       # Local, 2.7GB, vision-capable, fits GTX 1050Ti 4GB VRAM
USE_LOCAL_AI = True         # Set False to fallback to Gemini Flash-Lite

GEMINI_API_KEY = ""         # Optional: set in .env if using fallback
GEMINI_MODEL = "gemini-2.5-flash-lite"
```

### CRITICAL: Strip Thinking Tags

qwen3.5:2b outputs <think>…</think> blocks before answering. Always strip them:

```python
import re, json

def parse_ai_json(raw: str) -> dict:
    # Remove thinking block
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    # Remove markdown fences
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}
```

### Vision Tagging Prompt

```python
TAGGING_PROMPT = """You are a fashion assistant. Analyze this clothing item photo and return ONLY valid JSON with no markdown, no explanation.

{
  "category": "one of: tshirt, shirt, polo, jacket, hoodie, sweater, jeans, chinos, trousers, shorts, shoes, sneakers, boots, formal_shoes, accessory, other",
  "colors": ["primary color", "secondary color if present"],
  "tags": ["fit-type", "material-if-visible", "pattern-if-any"],
  "fit_type": "one of: slim, regular, oversized, relaxed",
  "occasions": ["one or more of: casual, work, formal, sport, outdoor"],
  "seasons": ["one or more of: spring, summer, fall, winter"]
}"""
```

### Tagging API Call

```python
async def tag_clothing_image(image_path: str) -> dict:
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode()

    payload = {
        "model": MODEL,
        "messages": [{
            "role": "user",
            "content": TAGGING_PROMPT,
            "images": [image_data]
        }],
        "stream": False,
        "options": {"temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
        raw = resp.json()["message"]["content"]
    return parse_ai_json(raw)   # Empty dict = caller shows manual form
```

### Outfit Generation Prompt

```python
async def generate_outfits(items: list[dict], occasion: str, season: str) -> list[dict]:
    prompt = f"""You are a personal stylist. Suggest exactly 3 outfits for occasion: {occasion}, season: {season}.

Wardrobe: {json.dumps(items)}

Rules: each outfit 2-4 items, color-coordinate, match occasion and season.
Return ONLY JSON array:
[
  {{"items": [1, 3], "reason": "brief note"}},
  {{"items": [2, 5, 7], "reason": "brief note"}},
  {{"items": [1, 4, 6], "reason": "brief note"}}
]"""

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.3}
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
        raw = resp.json()["message"]["content"]
    result = parse_ai_json(raw)
    return result if isinstance(result, list) else []
```

### Gap Analysis Prompt

```python
async def analyze_gaps(items: list[dict]) -> dict:
    prompt = f"""Analyze this wardrobe for gaps by occasion and season.

Wardrobe: {json.dumps(items)}

Return ONLY JSON:
{{
  "gaps": [
    {{"occasion": "formal", "missing_items": ["dress shirt", "formal trousers"], "priority": "high", "reason": "0 formal outfits possible"}}
  ],
  "coverage_score": {{"casual": 8, "work": 4, "formal": 0, "sport": 2}}
}}"""

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
        raw = resp.json()["message"]["content"]
    result = parse_ai_json(raw)
    return result if result else {"gaps": [], "coverage_score": {}}
```

-----

## API Endpoints

```
GET    /profile
POST   /profile

GET    /items                         # ?category= &occasion= &season=
POST   /items                         # multipart/form-data: photo + optional JSON metadata
GET    /items/{id}
PUT    /items/{id}
DELETE /items/{id}
POST   /items/barcode/{upc}           # Auto-fill from barcode
POST   /items/{id}/tag                # Re-run AI tagging

GET    /outfits                       # ?occasion= &season=
POST   /outfits/generate              # body: {"occasion": "work", "season": "winter"}
POST   /outfits
PUT    /outfits/{id}                  # e.g. update rating
DELETE /outfits/{id}

GET    /shop/gaps
GET    /shop/suggest                  # ?brand=zara&budget_cad=100
```

-----

## Frontend Rules

- Mobile-first layout. Phone is the primary input device.
- Tailwind CSS only, no separate CSS files.
- Bottom nav bar on mobile: Wardrobe, Add, Outfits, Shop, Profile
- Wardrobe grid: 2 columns on mobile, 4 on desktop
- Camera: navigator.mediaDevices.getUserMedia({ video: { facingMode: “environment” } }) for rear camera
- Barcode scanner: @zxing/library npm package
- All API calls use: import.meta.env.VITE_API_URL
- Show loading spinner during AI tagging (can take 10-30 seconds on first run)
- If AI tagging returns empty dict: show manual tag form with dropdowns, never crash

-----

## CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Phone on same WiFi needs access
    allow_methods=["*"],
    allow_headers=["*"]
)
```

-----

## Static File Serving

```python
from fastapi.staticfiles import StaticFiles
app.mount("/images", StaticFiles(directory="data/images"), name="images")
# Photos accessible at: http://{PC_LAN_IP}:8000/images/{filename}
```

-----

## Environment Setup (Windows PC)

```bash
# 1. Pull AI model (one-time, 2.7GB download)
ollama pull qwen3.5:2b

# 2. Backend
cd wardrobeai/backend
pip install fastapi uvicorn sqlmodel httpx python-multipart pillow
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 3. Frontend
cd wardrobeai/frontend
npm create vite@latest . -- --template react
npm install tailwindcss @tailwindcss/vite @zxing/library axios
npm run dev -- --host 0.0.0.0

# 4. Find PC LAN IP (Command Prompt)
ipconfig
# Look for IPv4 Address under Wireless LAN adapter Wi-Fi
# Example: 192.168.1.105
# Set in frontend/.env:
# VITE_API_URL=http://192.168.1.105:8000
```

-----

## Build Phase Order

### Phase 1: Core Foundation (Days 1-3)

1. FastAPI + SQLite + all 3 models
1. /profile endpoint + Profile page UI
1. /items POST endpoint (photo upload + manual tag form)
1. Ollama qwen3.5:2b tagging — TEST WITH REAL PHOTO FIRST before building UI
1. Wardrobe grid view

### Phase 2: Intelligence (Days 4-6)

1. /outfits/generate endpoint
1. Outfit Builder UI (view AI suggestions, save and rate)
1. Filters by occasion + season
1. “What to wear today?” quick suggestion

### Phase 3: Shopping Intelligence (Days 7-8)

1. Wardrobe gap analysis engine
1. Occasion coverage scoring (flag if less than 2 outfits per occasion)
1. Shopping page with Google Shopping search links
1. Size recommendations from body measurements

### Phase 4: Polish (Days 9-10)

1. Barcode scanning via phone camera
1. Times worn tracking
1. PWA manifest for Add to Home Screen on phone

-----

## Critical Notes

- Always start Ollama and backend BEFORE frontend
- Test Ollama tagging with a real clothing photo FIRST — verify valid JSON returned
- Image naming: {item_id}_{unix_timestamp}.jpg in backend/data/images/
- JSON fields in SQLite: store as strings, parse with json.loads() in service layer
- No auth needed — single user, local network only
- Ollama first inference: 15-30 seconds while model loads into VRAM — show clear loading state
- If AI returns malformed JSON: fall back to manual tag form, NEVER crash the app
- Handle Ollama connection error: httpx.ConnectError if Ollama is not running
- VRAM: do not run GPU-intensive apps while using wardrobe AI