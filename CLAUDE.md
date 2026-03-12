# WardrobeAI — Claude Code Instructions

## Project Overview

A personal, locally-hosted AI wardrobe manager. The user (Vipin) runs this on his Windows PC;
his phone connects to it over the same WiFi. No cloud hosting. Zero ongoing cost. Not public. Single user only.

**Current State: v1.0 — All 4 build phases complete and running.**

-----

## Tech Stack (Non-Negotiable)

| Layer              | Choice                                    | Version / Reason                                              |
|--------------------|-------------------------------------------|---------------------------------------------------------------|
| Backend            | Python 3.10+ / FastAPI                    | Async, fast, works well with Ollama                           |
| Frontend           | React + Vite + Tailwind CSS               | Mobile-friendly, fast dev                                     |
| React              | React 19.2 / React Router DOM 7.13        | Latest React with file-based routing                          |
| Build Tool         | Vite 7.3.1                                | Fast HMR, @tailwindcss/vite plugin                            |
| Database           | SQLite via SQLModel                       | Zero setup, single file, personal use                         |
| AI Primary         | Ollama qwen3.5:2b (2.7GB)                 | Local, free, native multimodal, fits 4GB VRAM with headroom   |
| AI Fallback        | Google Gemini 2.5 Flash-Lite free tier    | Backlog — not yet implemented in code                         |
| Image Storage      | Local filesystem (backend/data/images/)   | Simple, no cloud                                              |
| Barcode Lookup     | UPCItemDB API free no auth                | https://api.upcitemdb.com/prod/trial/lookup?upc={upc}         |
| Barcode Scanning   | @zxing/library 0.21.3                     | Phone camera barcode reading in browser                       |
| Animations         | Framer Motion 12.35 + GSAP 3.14           | Page transitions + stagger entrance animations                |
| 3D Scenes          | @splinetool/react-spline 4.1.0            | Luxury splash + hero scenes                                   |
| Icons              | lucide-react 0.577 + @iconify/react       | UI icons throughout                                           |
| HTTP Client        | Axios 1.13.6                              | All frontend API calls                                        |
| Class Utilities    | clsx + tailwind-merge                     | Safe Tailwind class merging via `cn()` helper                 |

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
├── .plan.md                             # Spline 3D integration plan (historical)
├── test_ollama_tagging.py               # Standalone Ollama tagging test script
├── backend/
│   ├── main.py                          # FastAPI app entry point
│   ├── database.py                      # SQLite + SQLModel setup
│   ├── wardrobe.db                      # SQLite DB (auto-created on first run)
│   ├── models/
│   │   ├── user.py                      # UserProfile model
│   │   ├── item.py                      # ClothingItem model
│   │   └── outfit.py                    # SavedOutfit model
│   ├── routers/
│   │   ├── profile.py                   # GET/POST /profile
│   │   ├── items.py                     # CRUD /items + worn tracking + barcode + retag
│   │   ├── outfits.py                   # GET/POST /outfits + AI generation
│   │   └── shop.py                      # GET /shop/gaps, /shop/suggest (with 30s cache)
│   ├── services/
│   │   ├── ai_service.py                # Ollama calls (vision + text)
│   │   ├── barcode_service.py           # UPC lookup via UPCItemDB
│   │   └── shopping_service.py          # Gap analysis + size inference + Google Shopping URLs
│   ├── data/
│   │   └── images/                      # Stored clothing photos: {id}_{uuid}.jpg
│   └── requirements.txt
├── frontend/
│   ├── vite.config.js
│   ├── .env                             # VITE_API_URL=http://{LAN_IP}:8000
│   ├── public/
│   │   └── manifest.json               # PWA manifest (Add to Home Screen)
│   └── src/
│       ├── main.jsx                     # React entry point
│       ├── index.css                    # Tailwind + full luxury theme (CSS variables)
│       ├── App.jsx                      # Router + splash + page transitions
│       ├── lib/
│       │   ├── utils.js                 # cn() class merger, parseJson() safe parser
│       │   └── scenes.js                # Spline 3D scene URL constants
│       ├── pages/
│       │   ├── Wardrobe.jsx             # Grid view + filters + 3D hero + GSAP animations
│       │   ├── AddItem.jsx              # 6-phase upload flow (idle/camera/preview/upload/form/done)
│       │   ├── OutfitBuilder.jsx        # Generate tab + Saved tab + "Wear Today?"
│       │   ├── Profile.jsx              # Body measurements + brand sizes
│       │   └── Shop.jsx                 # Coverage rings + gap cards + shopping suggestions
│       └── components/
│           ├── Navbar.jsx               # Fixed bottom nav (5 tabs)
│           ├── ItemCard.jsx             # Grid card: image, brand, colors, worn badge, mark worn
│           ├── ItemDetailModal.jsx      # Full-screen modal: view/edit/retag/delete
│           ├── OutfitCard.jsx           # Outfit card: thumbnails, reason, rating stars
│           ├── BarcodeScanner.jsx       # @zxing/library camera barcode reader
│           ├── SplineScene.jsx          # Lazy-loaded Spline 3D wrapper with error boundary
│           ├── SplashScreen.jsx         # First-launch splash (sessionStorage gated, auto-dismiss 2.4s)
│           ├── ErrorBoundary.jsx        # React class error boundary
│           ├── TextShimmer.jsx          # Gold shimmer sweep animation on headings
│           ├── NoiseOverlay.jsx         # Grain texture overlay (pointer-events none)
│           ├── GlassCard.jsx            # Reusable glassmorphism card container
│           └── LuxSelect.jsx            # Native <select> styled with Tailwind + gold focus ring
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
    photo_path: str                          # Filename only: {id}_{uuid}.jpg in data/images/
    category: str                            # tshirt, shirt, jeans, chinos, jacket, etc.
    colors: str = "[]"                       # JSON array: ["navy", "white"]
    tags: str = "[]"                         # JSON array: ["slim-fit", "cotton", "striped"]
    brand: str | None = None
    size_label: str | None = None
    fit_type: str | None = None             # slim, regular, oversized, relaxed
    occasions: str = "[]"                    # JSON array: ["casual", "work", "formal"]
    seasons: str = "[]"                      # JSON array: ["spring", "summer", "fall", "winter"]
    date_added: datetime = Field(default_factory=datetime.utcnow)
    times_worn: int = 0                      # Incremented by POST /items/{id}/worn
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
```

### CRITICAL: Strip Thinking Tags

qwen3.5:2b outputs `<think>…</think>` blocks before answering. Always strip them:

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

### Re-tagging: preserve_existing mode

When re-tagging an existing item (`POST /items/{id}/tag`), only overwrite AI fields if the
new result is non-empty — never clobber manually edited data:

```python
def _apply_tags(item, tags, *, preserve_existing=False):
    item.category = tags.get("category", item.category if preserve_existing else "other")
    item.fit_type = tags.get("fit_type", item.fit_type if preserve_existing else None)
    for field in ("colors", "tags", "occasions", "seasons"):
        ai_val = tags.get(field)
        if ai_val or not preserve_existing:
            setattr(item, field, json.dumps(ai_val or []))
```

### Gap Analysis Cache

`/shop/gaps` and `/shop/suggest` share a 30-second in-memory cache to avoid a second
30–60s Ollama call when both are hit on the same page load:

```python
_gaps_cache: dict = {"result": None, "item_count": -1, "ts": 0.0}
_GAPS_CACHE_TTL = 30  # seconds
```

Force-refresh via `GET /shop/gaps?force=true`.

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
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
        raw = resp.json()["message"]["content"]
    return parse_ai_json(raw)   # Empty dict = caller shows manual form
```

### Outfit Generation Prompt

```python
async def generate_outfits(items: list[dict], occasion: str, season: str) -> list[dict]:
    # Sends only essential item fields: id, category, colors, occasions, seasons, fit_type
    # Temperature 0.3 for variety
    # Returns: [{"items": [1, 3], "reason": "brief note"}, ...]
    # Outfits endpoint enriches IDs to full item objects before returning to frontend
```

### Gap Analysis Prompt

```python
async def analyze_gaps(items: list[dict]) -> dict:
    # Temperature 0.1 for consistency
    # Returns: {"gaps": [...], "coverage_score": {...}}
    # Each gap: {"occasion": "formal", "missing_items": [...], "priority": "high", "reason": "..."}
```

-----

## API Endpoints

```
GET    /profile
POST   /profile

GET    /items                          # ?category= &occasion= &season=
POST   /items                          # multipart/form-data: photo file + optional metadata JSON string
GET    /items/{id}
PUT    /items/{id}                      # Partial update (id, photo_path, date_added are protected)
DELETE /items/{id}                      # Deletes DB row + image file from disk
POST   /items/{id}/worn                 # Increment times_worn counter — returns {id, times_worn}
POST   /items/{id}/tag                  # Re-run AI tagging (preserve_existing=True)
GET    /items/barcode/{upc}             # UPCItemDB lookup — returns pre-fill data

GET    /outfits                         # ?occasion= &season=
POST   /outfits/generate                # body: {"occasion": "work", "season": "winter"}
POST   /outfits
PUT    /outfits/{id}                    # e.g. update rating
DELETE /outfits/{id}

GET    /shop/gaps                       # ?force=true to bypass 30s cache
GET    /shop/suggest                    # ?brand=zara&budget_cad=100
```

-----

## Frontend Theme & Design

The app uses a dark luxury theme defined as CSS custom properties in `frontend/src/index.css`.
All color usage throughout components must reference these variables — never hard-code hex values.

| Variable           | Value                        | Usage                             |
|--------------------|------------------------------|-----------------------------------|
| `--bg-primary`     | `#0C0C0C`                   | Main background                   |
| `--bg-surface`     | `#161616`                   | Cards, panels                     |
| `--bg-elevated`    | `#1E1E1E`                   | Inputs, modals, dropdowns         |
| `--text-primary`   | `#F0EDE8`                   | Main readable text                |
| `--text-muted`     | `#6B6560`                   | Secondary / placeholder text      |
| `--accent`         | `#C8A97E`                   | Gold — CTAs, active states, focus |
| `--accent-soft`    | `rgba(200,169,126,0.10)`    | Subtle gold tint backgrounds      |
| `--success`        | `#4ADE80`                   | Coverage rings ≥2, success toast  |
| `--warning`        | `#FBB846`                   | Coverage rings =1, medium priority|
| `--danger`         | `#F87171`                   | Coverage rings =0, high priority  |

**Typography:**
- Body: System stack — `Inter, SF Pro Text, -apple-system, sans-serif`
- Display headings: `Cormorant Garamond` (Google Fonts), letter-spacing 0.2–0.3em

**Animation libraries in use:**
- `framer-motion`: AnimatePresence for page transitions and modal entrance
- `gsap`: Stagger entrance animations on wardrobe grid items (fromTo opacity + y)
- Tailwind keyframes: shimmer skeleton, text-shimmer gold sweep, ring-pulse, pulsing dots

**3D Scenes (Spline):**
- `SplineScene.jsx` wraps `@splinetool/react-spline` with `React.lazy` + error boundary
- Respects `prefers-reduced-motion` — returns null if user opts out
- Three placements: SplashScreen (full-screen), Wardrobe hero (180px), AddItem idle phase (200px)
- Scene URLs stored in `frontend/src/lib/scenes.js`
- Failed/offline scenes silently hide (no crash)

**Glassmorphism pattern** (`GlassCard.jsx`):
```css
background: rgba(22,22,22,0.7);
backdrop-filter: blur(12px);
border: 1px solid rgba(200,169,126,0.12);
```

-----

## Frontend Rules

- Mobile-first layout. Phone is the primary input device.
- Tailwind CSS only — no separate CSS files except `index.css` (variables + keyframes).
- Never hard-code color values — use CSS variables (e.g. `text-[var(--accent)]`).
- Bottom nav bar on mobile: Wardrobe, Add, Outfits, Shop, Profile.
- Wardrobe grid: 2 columns on mobile, 4 on desktop.
- Camera: `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` for rear camera.
- Barcode scanner: `@zxing/library` npm package.
- All API calls use: `import.meta.env.VITE_API_URL`.
- Show loading spinner/pulsing dots during AI tagging (can take 10–30 seconds on first run).
- If AI tagging returns empty dict: show manual tag form with dropdowns, never crash.
- Use `cn()` from `lib/utils.js` for all conditional class merging.
- Use native `<select>` elements (via `LuxSelect`) for all dropdowns — best iOS/Android UX.
- Respect safe area insets: `env(safe-area-inset-bottom)` on bottom-nav padding.

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
pip install fastapi uvicorn[standard] sqlmodel httpx python-multipart pillow python-dotenv
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 3. Frontend (all deps already in package.json — just npm install)
cd wardrobeai/frontend
npm install
npm run dev -- --host 0.0.0.0

# 4. Find PC LAN IP (Command Prompt)
ipconfig
# Look for IPv4 Address under Wireless LAN adapter Wi-Fi
# Example: 192.168.1.105
# Set in frontend/.env:
# VITE_API_URL=http://192.168.1.105:8000
```

**Full frontend npm install if starting from scratch:**
```bash
npm create vite@latest . -- --template react
npm install tailwindcss @tailwindcss/vite @zxing/library axios \
  framer-motion gsap @splinetool/react-spline \
  lucide-react @iconify/react \
  clsx tailwind-merge react-router-dom
```

-----

## Implementation Status

All 4 build phases are complete. This section records what was built.

### Phase 1 — Core Foundation ✅

- FastAPI + SQLite + all 3 models (UserProfile, ClothingItem, SavedOutfit)
- `/profile` endpoint + Profile page UI (measurements + brand sizes)
- `/items` POST (photo upload + AI tagging + manual fallback form)
- Ollama qwen3.5:2b vision tagging with `<think>` tag stripping
- Wardrobe grid view (2-col mobile / 4-col desktop)

### Phase 2 — Intelligence ✅

- `/outfits/generate` endpoint (AI suggests 3 outfits, enriched with full item objects)
- Outfit Builder UI — Generate tab + Saved tab
- Filters by occasion + season on wardrobe and outfits
- "Wear Today?" quick suggestion (casual + current season)
- Star rating on saved outfits (1–5)

### Phase 3 — Shopping Intelligence ✅

- Wardrobe gap analysis engine (`analyze_gaps` via Ollama)
- Instant local coverage scoring (`compute_local_coverage` — no AI, no delay)
- 30s gap analysis cache to avoid double Ollama calls
- Shopping page: coverage rings + gap cards + suggestion cards with Google Shopping links
- Size inference engine: brand preference → body measurements → category fallback

### Phase 4 — Polish ✅

- Barcode scanning via `@zxing/library` (phone camera, pre-fills add form)
- Times worn tracking: badge on ItemCard + `POST /items/{id}/worn` endpoint
- PWA manifest (`public/manifest.json`) — Add to Home Screen on iOS/Android
- Dark luxury theme with full CSS variable system
- 3D Spline scenes: splash screen, wardrobe hero, AddItem idle phase
- Framer Motion page transitions + GSAP stagger entrance animations
- ItemDetailModal: in-place edit, re-tag, delete without leaving wardrobe grid
- SplashScreen: sessionStorage-gated, auto-dismiss at 2.4s
- ErrorBoundary component protecting all pages
- NoiseOverlay grain texture for depth

### Backlog (Not Yet Implemented)

- Gemini 2.5 Flash-Lite fallback — referenced in config but no actual code path exists (tracked: ISSUES.md E2)
- Versatility score per shopping suggestion — "this chino matches 7 of your tops" (tracked: ISSUES.md E3)

### Moved from Backlog — Now Implemented ✅

- Color palette gap detection — implemented in `Shop.jsx` palette rings + `/shop/palette` endpoint
- Dedicated outfit history view — implemented in `OutfitBuilder.jsx` History tab + `/outfits/history` endpoint

-----

## Critical Notes

- Always start Ollama and backend BEFORE frontend
- Test Ollama tagging with a real clothing photo FIRST — verify valid JSON returned
- Image naming: `{item_id}_{uuid}.jpg` in `backend/data/images/`
- JSON fields in SQLite: store as strings, parse with `json.loads()` in service layer
- No auth needed — single user, local network only
- Ollama first inference: 15–30 seconds while model loads into VRAM — show clear loading state
- If AI returns malformed JSON: fall back to manual tag form, NEVER crash the app
- Handle Ollama connection error: `httpx.ConnectError` if Ollama is not running
- VRAM: do not run GPU-intensive apps while using wardrobe AI (GTX 1050Ti 4GB is shared)
- `preserve_existing=True` on retag: AI result never clobbers manually edited fields
- **`projectstructure.md` must be kept in sync**: After ANY code change — new file, new endpoint, new model field, component added/removed, logic change — update `projectstructure.md` in the same commit. Never leave it stale.
