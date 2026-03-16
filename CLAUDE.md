# WardrobeAI — Claude Code Instructions

## Project Overview

A personal, locally-hosted AI wardrobe manager. The user (Vipin) runs this on his Windows PC;
his phone connects to it over the same WiFi. No cloud hosting. Zero ongoing cost. Not public. Single user only.

**Current State: v1.2 — All 4 build phases + v1.1 bug-fix pass + v1.2 outfit intelligence redesign (Sanzo Wada color palettes, skin tone intelligence, enriched AI prompts, outfit validation).**

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
| AI Fallback        | Google Gemini 2.5 Flash-Lite free tier    | REST API fallback via GEMINI_API_KEY env var                  |
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
├── scripts/
│   └── verify.sh                        # Full 4-loop verification (starts backend, runs all tests, cleans up)
├── backend/
│   ├── main.py                          # FastAPI app entry point
│   ├── test_api.py                      # Baseline API test suite (62 tests, no pytest required)
│   ├── test_adversarial.py              # Adversarial edge-case suite (139 tests, no pytest required)
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
│   │   └── shop.py                      # GET /shop/gaps, /shop/suggest (with 300s cache)
│   ├── services/
│   │   ├── ai_service.py                # Ollama calls (vision + text) — enriched prompts with skin tone + harmony hints
│   │   ├── barcode_service.py           # UPC lookup via UPCItemDB (legacy, wrapped by product_lookup_service)
│   │   ├── shopping_service.py          # Gap analysis + size inference + Google Shopping URLs + recommended_colors
│   │   ├── color_service.py             # Sanzo Wada palette-based color harmony scoring (159 colors, 348 palettes)
│   │   ├── sanzo_wada_data.json         # 159 Sanzo Wada colors with LAB values + 348 palette combination IDs
│   │   ├── skin_tone_service.py         # Skin tone × undertone → flattering/avoid color rules for Indian skin tones
│   │   ├── fit_service.py               # Garment vs body measurement fit verification
│   │   ├── compatibility_service.py     # Shopping suggestion compatibility scoring (0–1) with skin tone bonus
│   │   └── product_lookup_service.py    # 4-source barcode lookup chain + label OCR
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
│       │   ├── utils.js                 # cn() class merger, parseJson() safe parser, parseColorString()
│       │   ├── scenes.js                # Spline 3D scene URL constants
│       │   ├── constants.js             # Shared enums + SKIN_TONES/UNDERTONES/LABELS, INPUT_STYLE, toggleArr(), isPhotoValid()
│       │   └── colors.js                # COLOR_MAP + getColorCSS() — maps color names to CSS values
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
│           ├── LuxSelect.jsx            # Native <select> styled with Tailwind + gold focus ring
│           ├── Toast.jsx                # Context-based toast notifications (max 4 on screen, auto-dismiss)
│           ├── OutfitGallery.jsx        # THREE.js WebGL carousel with elastic drag + momentum
│           └── PhaseIndicator.jsx       # Step progress bar for AddItem 6-phase upload flow
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
    skin_tone: str | None = None      # "fair", "light-medium", "medium", "olive", "deep"
    undertone: str | None = None      # "warm", "cool", "neutral"
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
    # Added via migration (Iteration 1):
    garment_measurements: str | None = None  # JSON: {"chest_width_cm": 54, "body_length_cm": 72, ...}
    material: str | None = None              # e.g. "100% cotton" — from AI or label OCR
```

### SavedOutfit

```python
class SavedOutfit(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    item_ids: str              # JSON array of ClothingItem IDs: [1, 3, 7]
    occasion: str | None = None
    season: str | None = None
    rating: int | None = None  # 1-5 stars; validated 1–5 on POST and PUT
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # Added via migration (Iteration 6):
    worn_date: str | None = None             # ISO-8601 timestamp of last wear
    times_worn: int = 0                      # Incremented by POST /outfits/{id}/worn
    name: str | None = None                  # Optional user-defined outfit name
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

### Color Service (Sanzo Wada palette-based, v1.2)

The color service was rewritten in v1.2 to use Sanzo Wada's "A Dictionary of Color Combinations"
(159 named colors, 348 expert-curated palettes) instead of the previous 5-group compatibility matrix.

```python
# Core flow:
# 1. Map clothing color name → hex via _CLOTHING_COLOR_HEX dict
# 2. Convert hex → RGB → LAB (CIE L*a*b*, D50 illuminant)
# 3. Find nearest Sanzo Wada color by CIE76 Delta-E distance
# 4. Score compatibility by counting shared palette IDs between two colors

find_nearest_sanzo_color(color_name: str) -> dict | None      # @lru_cache(512)
are_colors_compatible(color_a: str, color_b: str) -> float     # 0.0–1.0
get_palette_harmony_score(colors: list[str]) -> float          # Full outfit harmony
get_palette_summary(items: list[dict]) -> dict                 # Wardrobe color breakdown
suggest_complementary_colors(wardrobe_colors, skin_profile) -> list[dict]  # v1.2: skin-tone filtered
```

### Skin Tone Service (v1.2)

Static lookup tables for 8 skin tone × undertone combinations focused on Indian complexions.
No AI calls — instant.

```python
get_flattering_colors(skin_tone: str, undertone: str) -> dict   # {best, good, avoid}
score_color_for_skin(color_name: str, skin_tone, undertone) -> float  # 0.1 (avoid) – 1.0 (best)
get_skin_tone_context_for_ai(skin_tone, undertone) -> str       # Natural language for AI prompts
get_skin_tone_color_guidance_for_ai(skin_tone, undertone) -> str  # Rules section for prompts
```

### Gap Analysis Cache

`/shop/gaps` and `/shop/suggest` share a 300-second in-memory cache to avoid a second
30–60s Ollama call when both are hit on the same page load:

```python
_gaps_cache: dict = {"result": None, "item_count": -1, "ts": 0.0, "skin_key": ""}
_GAPS_CACHE_TTL = 300  # seconds (5 min — AI call takes 30–60s, cache must outlast it)
```

Force-refresh via `GET /shop/gaps?force=true`.
Deleting any ClothingItem calls `invalidate_gaps_cache()` automatically.
**v1.2**: Cache key now includes `skin_key` (skin tone context string). Changing skin tone
in profile calls `invalidate_gaps_cache()` to force fresh AI analysis with new skin guidance.

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
async def generate_outfits(
    items: list[dict],
    occasion: str,
    season: str,
    past_outfits: list[dict] | None = None,
    skin_tone_context: str | None = None,        # v1.2: injected from skin_tone_service
    color_harmony_hints: list[str] | None = None, # v1.2: wardrobe colors for Sanzo palette matching
    wear_frequency: dict[int, int] | None = None, # v1.2: prefer least-worn items
) -> list[dict]:
    # Sends only essential item fields: id, category, colors, occasions, seasons, fit_type
    # Temperature 0.3 for variety
    # Prompt now instructs AI: "personal stylist for an Indian man" + skin tone guidance
    # Returns: [{"items": [1, 3], "reason": "brief note"}, ...]
    # Outfits endpoint enriches IDs to full item objects + validates top+bottom + computes harmony_score
```

### Outfit Validation (v1.2)

```python
def validate_outfit(item_ids: list[int], item_map: dict[int, dict]) -> bool:
    """Ensure outfit has at least one top and one bottom."""
    # _TOPS_SET = {"tshirt", "shirt", "polo", "jacket", "hoodie", "sweater", "blazer", "coat", "top"}
    # _BOTTOMS_SET = {"jeans", "chinos", "trousers", "shorts"}
    # Invalid outfits (e.g., just shoes + accessory) are filtered out before returning to frontend
```

### Gap Analysis Prompt

```python
async def analyze_gaps(items: list[dict], skin_tone_context: str | None = None) -> dict:
    # Temperature 0.1 for consistency
    # v1.2: skin_tone_context injected to recommend flattering colors for missing items
    # Returns: {"gaps": [...], "coverage_score": {...}}
    # Each gap: {"occasion": "formal", "missing_items": [...], "priority": "high", "reason": "..."}
```

-----

## API Endpoints

```
GET    /profile
POST   /profile

GET    /items                          # ?category= &occasion= &season=
POST   /items                          # multipart/form-data: photo ≤15MB + optional metadata JSON string
GET    /items/{id}
PUT    /items/{id}                      # Partial update (id, photo_path, date_added are protected)
DELETE /items/{id}                      # Deletes DB row + image file + cascades to remove ID from all SavedOutfit.item_ids
POST   /items/{id}/worn                 # Increment times_worn counter — returns {id, times_worn}
POST   /items/{id}/tag                  # Re-run AI tagging (preserve_existing=True)
GET    /items/{id}/fit-check            # Verify garment_measurements vs user body (fit_service)
GET    /items/barcode/{upc}             # 4-source barcode lookup — validates UPC-12/EAN-13 format, returns pre-fill data
POST   /items/scan-label               # OCR clothing label photo via Ollama vision — returns pre-fill data

GET    /outfits                         # ?occasion= &season= — includes missing_items field for deleted-item refs
POST   /outfits/generate                # body: {"occasion": "work", "season": "winter"}
POST   /outfits                         # rating validated 1–5 if provided
PUT    /outfits/{id}                    # update rating (1–5) or name
DELETE /outfits/{id}
POST   /outfits/{id}/worn               # Increment outfit times_worn + worn_date + all item times_worn
GET    /outfits/history                 # Worn outfits sorted by worn_date DESC

GET    /shop/gaps                       # ?force=true to bypass 300s cache — skin tone context injected
GET    /shop/suggest                    # ?brand=zara&budget_cad=100 — now includes recommended_colors, versatility_score
GET    /shop/palette                    # Instant color palette (Sanzo Wada) — by_group, all_colors, complementary_suggestions, flattering_colors
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
- Respect safe area insets: `max(env(safe-area-inset-bottom), 0px)` on bottom-nav padding (use `max()` wrapper for older WebKit compat).
- `parseJson()` fallback rule: array fields (colors, tags, occasions, seasons) use `[]`; object fields (garment_measurements, brand_sizes) use `{}` as explicit second argument.
- `parseColorString(str)` from `lib/utils.js` — parse comma-separated color strings in edit forms. Never duplicate inline.
- `INPUT_STYLE` in `lib/constants.js` is the base input style. Profile.jsx has a local extension with `transition` — this is intentional and documented.

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
- 300s gap analysis cache to avoid double Ollama calls (increased from 30s in v1.1)
- Shopping page: coverage rings + gap cards + suggestion cards with Google Shopping links
- Size inference engine: brand preference → body measurements → category fallback
- Color palette analysis via `color_service.py` — `GET /shop/palette` (instant, no AI)
- Complementary color suggestions + underrepresented group detection

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

### Phase 5 — Automated Verification ✅ (2026-03-15)

- `backend/test_api.py` — 62-test baseline suite covering all 22 endpoints
- `backend/test_adversarial.py` — 139-test adversarial suite: filtering accuracy, cascade correctness, JSON round-trips, race resistance, protected fields, history ordering
- `scripts/verify.sh` — orchestrates 4 loops: baseline → adversarial → combined re-run → stress battery (10 items)
- **Bug found and fixed**: `StaticFiles` mount in `main.py` ran before `data/images/` was created → added `os.makedirs` before `app.mount()`
- All 243 tests pass without Ollama (AI tests gracefully skipped)

### Phase 6 — Outfit Intelligence Redesign (v1.2) ✅

- **Sanzo Wada color palette integration**: 159 named colors with LAB values + 348 curated palette combinations from "A Dictionary of Color Combinations". `color_service.py` fully rewritten to use CIE76 LAB distance for nearest-color matching and shared palette counting for pairwise compatibility scoring.
- **Skin tone intelligence**: New `skin_tone_service.py` with 8 skin tone × undertone rule sets focused on Indian complexions (fair/light-medium/medium/olive/deep × warm/cool/neutral). Returns flattering/good/avoid color lists, numeric scoring (0.0–1.0), and natural-language AI prompt context.
- **Database migration**: `skin_tone` and `undertone` TEXT columns added to `userprofile` table (Iteration 8 migration in `database.py`).
- **Enriched AI outfit prompts**: `generate_outfits()` now receives skin tone context, color harmony hints (wardrobe colors), wear frequency data, and instructs AI as "personal stylist for an Indian man" with skin tone guidance.
- **Outfit validation**: New `validate_outfit()` function ensures every AI-generated outfit has at least 1 top + 1 bottom. Invalid outfits are silently filtered before returning to frontend.
- **Color harmony scoring**: Each generated outfit now includes `harmony_score` (0.0–1.0) computed via Sanzo Wada palette matching.
- **Compatibility scoring upgrade**: `_score_pair()` weights rebalanced (category 0.35, color 0.30, occasion 0.15, season 0.10, skin tone 0.10). Skin tone flattery bonus added as 10% weight.
- **Shopping suggestions upgrade**: New `recommended_colors` (flattering colors from skin tone rules) and `versatility_score` (% of wardrobe this pairs with) fields on every suggestion.
- **Gap analysis cache**: Cache key now includes `skin_key` dimension. Profile skin tone changes invalidate the cache.
- **Palette endpoint**: `/shop/palette` now returns `flattering_colors` when skin tone is set, and `complementary_suggestions` are filtered to exclude skin-tone-unflattering colors.
- **Frontend Profile.jsx**: New "Skin Tone & Undertone" section with dropdowns and vein-test tip. Skin tone/undertone stored and round-tripped through the API.
- **Frontend Shop.jsx**: Suggestion cards show color swatches for `recommended_colors` and "Pairs with X% of wardrobe" versatility text.
- **Frontend constants.js**: New `SKIN_TONES`, `UNDERTONES`, `SKIN_TONE_LABELS`, `UNDERTONE_LABELS` exports.

### Backlog (Not Yet Implemented)

- Gemini 2.5 Flash-Lite fallback — implemented in ai_service.py (vision + text) but untested in production
- Versatility score per shopping suggestion ("this chino matches 7 of your tops") — compatibility_service exists but full UI not wired
- Pagination on `/items` and `/outfits` list endpoints (currently return all rows)

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
- **Ollama health checked at startup** in `lifespan()` — failure is a WARNING only (non-AI endpoints still work)
- **Photo uploads capped at 15 MB** — enforced in `POST /items` after `await photo.read()`; returns 413 if exceeded
- **Deleting a ClothingItem cascades** to remove its ID from all `SavedOutfit.item_ids`; empty outfits are deleted entirely
- **Barcode lookup requires valid UPC-12 or EAN-13** — 12 or 13 digits only; returns 400 on invalid format
- **`projectstructure.md` must be kept in sync**: After ANY code change — new file, new endpoint, new model field, component added/removed, logic change — update `projectstructure.md` in the same commit. Never leave it stale.
- **After every correction, update CLAUDE.md** — ruthlessly. Keep iterating until mistake rate measurably drops.
- **BUG FIXED (v1.1.1): `StaticFiles` mount race on fresh install** — `app.mount("/images", StaticFiles(...))` runs at module import time, BEFORE `lifespan()` creates `data/images/`. Fix: add `os.makedirs("data/images", exist_ok=True)` immediately before `app.mount()` in `main.py`. Without this, `uvicorn` crashes with `RuntimeError: Directory 'data/images' does not exist` on any fresh install where the directory hasn't been pre-created.
- **Automated verification**: `backend/test_api.py` (67 tests) + `backend/test_adversarial.py` (139 tests) + Loop 4 stress battery (42 tests). All pass without Ollama (AI tests gracefully skipped). Run: `bash scripts/verify.sh` — starts backend automatically, clears DB, runs all 4 loops, cleans up.
- **Sanzo Wada data**: `backend/services/sanzo_wada_data.json` is loaded once at module import time. If file is missing/corrupt, `color_service.py` will crash on import. The data contains 159 colors with `name`, `hex`, `rgb`, `lab`, `swatch`, and `combinations` (palette IDs).
- **Skin tone service**: `skin_tone_service.py` uses static lookup tables — no AI calls. Neutral undertone = union of warm + cool "best" colors with no "avoid" list. Missing/unrecognized skin tone falls back to universally flattering Indian palette (navy, emerald, maroon, teal, white).
- **Color matching pipeline**: clothing color name → `_CLOTHING_COLOR_HEX` lookup → RGB → LAB → CIE76 distance against 159 Sanzo Wada LAB values → nearest match. `@lru_cache(maxsize=512)` on `find_nearest_sanzo_color()` avoids recomputing.
- **Outfit validation**: `validate_outfit()` in `ai_service.py` checks for top+bottom presence. This is a post-filter — the AI prompt also requests it, but models sometimes ignore constraints. Both the prompt rule and the post-filter work together as defense-in-depth.
- **Profile skin tone changes invalidate gaps cache**: `POST /profile` with `skin_tone` or `undertone` in the payload calls `invalidate_gaps_cache()` from `routers/shop.py`. This ensures the next `/shop/gaps` call re-runs AI analysis with updated skin tone context.
- **Compatibility scoring weights (v1.2)**: category 0.35, color (Sanzo Wada) 0.30, occasion overlap 0.15, season overlap 0.10, skin tone flattery bonus 0.10. Previous weights: category 0.40, color 0.30, occasion 0.20, season 0.10.

-----

## Issue Tracking & Versioning

- **Issue templates** live in `.github/ISSUE_TEMPLATE/` — use `bug_report.yml` for bugs, `feature_request.yml` for enhancements.
- **PR template** is at `.github/pull_request_template.md` — fill every section; PRs with empty checklists will not be merged.
- **VERSION file** (`/VERSION`) holds the current semver string. Bump it on every release commit: patch for bug-fixes, minor for new features, major for breaking changes.
- **CHANGELOG.md** must be updated in the same commit as a version bump. Follow Keep-a-Changelog format.
- **Labels in use**: `bug`, `enhancement`, `documentation`, `performance`, `technical-debt`, `security`. Always apply at least one label when filing an issue.
- **`scripts/setup_github.py`** — run once per fresh repo clone with a `GH_TOKEN` env var to recreate all labels and seed the backlog issues.
