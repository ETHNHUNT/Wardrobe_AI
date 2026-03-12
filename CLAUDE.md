# WardrobeAI — Claude Code Instructions

## Project Overview

A personal, locally-hosted AI wardrobe manager. The user (Vipin) runs this on his Windows PC;
his phone connects to it over the same WiFi. No cloud hosting. Zero ongoing cost. Not public. Single user only.

**Current State: v1.0 + 6 Post-Launch Iterations — All features complete and running.**

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
| Barcode Lookup     | UPCItemDB API free no auth (primary)      | https://api.upcitemdb.com/prod/trial/lookup?upc={upc}         |
| Barcode Lookup 2   | Open GTIN Database (fallback)             | https://www.barcodelookup.com/api (optional key)              |
| Barcode Scanning   | @zxing/library 0.21.3                     | Phone camera barcode reading in browser                       |
| Animations         | Framer Motion 12.35 + GSAP 3.14           | Page transitions + stagger entrance animations                |
| 3D Scenes          | @splinetool/react-spline 4.1.0            | Luxury splash + hero scenes                                   |
| Icons              | lucide-react 0.577 + @iconify/react       | UI icons throughout                                           |
| HTTP Client        | Axios 1.13.6                              | All frontend API calls                                        |
| Class Utilities    | clsx + tailwind-merge                     | Safe Tailwind class merging via `cn()` helper                 |
| UI Primitives      | @radix-ui/* + class-variance-authority    | Shadcn-style accessible component primitives                  |

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
│   ├── database.py                      # SQLite + SQLModel setup + run_migrations()
│   ├── wardrobe.db                      # SQLite DB (auto-created on first run)
│   ├── models/
│   │   ├── user.py                      # UserProfile model
│   │   ├── item.py                      # ClothingItem model (garment_measurements, material)
│   │   └── outfit.py                    # SavedOutfit model (name, times_worn, worn_date)
│   ├── routers/
│   │   ├── profile.py                   # GET/POST /profile
│   │   ├── items.py                     # CRUD /items + worn tracking + barcode + retag + fit-check
│   │   ├── outfits.py                   # GET/POST /outfits + AI generation + history + naming
│   │   └── shop.py                      # GET /shop/gaps, /shop/suggest, /shop/palette
│   ├── services/
│   │   ├── ai_service.py                # Ollama calls (vision tagging + measurement inference + text)
│   │   ├── barcode_service.py           # Thin wrapper delegating to product_lookup_service
│   │   ├── color_service.py             # Pure Python color palette intelligence (no Ollama)
│   │   ├── compatibility_service.py     # Wardrobe integration scoring (no Ollama)
│   │   ├── fit_service.py               # Garment fit verification against body measurements
│   │   ├── product_lookup_service.py    # Multi-source barcode/product lookup (3 APIs)
│   │   └── shopping_service.py          # Gap analysis + size inference + Google Shopping URLs
│   ├── data/
│   │   └── images/                      # Stored clothing photos: {id}_{uuid}.jpg
│   └── requirements.txt
├── frontend/
│   ├── vite.config.js
│   ├── jsconfig.json                    # Path alias: @/* → ./src/*
│   ├── components.json                  # Shadcn UI configuration
│   ├── .env                             # VITE_API_URL=http://{LAN_IP}:8000
│   ├── public/
│   │   └── manifest.json               # PWA manifest (Add to Home Screen)
│   └── src/
│       ├── main.jsx                     # React entry point
│       ├── index.css                    # Tailwind + full luxury theme (CSS variables + keyframes)
│       ├── App.jsx                      # Router + splash + page transitions + ToastProvider
│       ├── lib/
│       │   ├── utils.js                 # cn() class merger, parseJson() safe parser
│       │   └── scenes.js                # Spline 3D scene URL constants
│       ├── pages/
│       │   ├── Wardrobe.jsx             # Grid + palette views + filters + 3D hero + GSAP animations
│       │   ├── AddItem.jsx              # 6-phase upload flow + label scan mode + PhaseIndicator
│       │   ├── OutfitBuilder.jsx        # Generate tab + Saved tab + History tab (wear tracking)
│       │   ├── Profile.jsx              # Body measurements + structured brand sizes UI
│       │   └── Shop.jsx                 # Coverage rings + gap cards + shopping + palette section
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
│           ├── Toast.jsx                # Context-based toast system (success/error/info, auto-dismiss)
│           ├── PhaseIndicator.jsx       # Visual stepper for AddItem phases (Photo→Preview→AI Tag→Done)
│           └── ui/                      # Shadcn-style utility components
│               ├── badge.jsx            # Badge / chip component with variants
│               ├── button.jsx           # Button with CVA variants
│               ├── input.jsx            # Styled input primitive
│               ├── label.jsx            # Accessible label via @radix-ui/react-label
│               └── separator.jsx        # Horizontal/vertical divider via @radix-ui/react-separator
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
    date_added: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    times_worn: int = 0                      # Incremented by POST /items/{id}/worn
    notes: str | None = None
    # Iteration 1 additions:
    garment_measurements: str = "{}"        # JSON: {"chest_width_cm": 52, "body_length_cm": 73, ...}
    material: str | None = None             # e.g. "100% cotton", "98% cotton 2% elastane"
```

**Garment measurement keys** (all float, cm): `chest_width_cm`, `body_length_cm`, `sleeve_cm`, `waist_cm`, `inseam_cm`.
Only non-null values from the Ollama inference call are stored; missing keys mean unmeasured.

### SavedOutfit

```python
class SavedOutfit(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    item_ids: str              # JSON array of ClothingItem IDs: [1, 3, 7]
    occasion: str | None = None
    season: str | None = None
    rating: int | None = None  # 1-5 stars
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Iteration 6 additions:
    name: str | None = None    # User-given label e.g. "Work Monday Look"
    times_worn: int = 0        # How many times this outfit has been worn
    worn_date: str | None = None  # ISO-8601 date of last wear: "2025-01-15"
```

-----

## Database Migration System

`backend/database.py` includes a `run_migrations()` function called at startup. It safely adds new
columns to existing tables without dropping data, using SQLite `PRAGMA table_info` to check
whether each column already exists before executing `ALTER TABLE`.

```python
def run_migrations(engine):
    with engine.connect() as conn:
        # Example pattern for each added column:
        cols = [r[1] for r in conn.execute(text("PRAGMA table_info(clothingitem)"))]
        if "garment_measurements" not in cols:
            conn.execute(text("ALTER TABLE clothingitem ADD COLUMN garment_measurements TEXT DEFAULT '{}'"))
        if "material" not in cols:
            conn.execute(text("ALTER TABLE clothingitem ADD COLUMN material TEXT"))
        # Same pattern for savedoutfit: name, times_worn, worn_date
        conn.commit()
```

This means existing `wardrobe.db` files from earlier versions automatically gain new columns on
first boot after an upgrade — no data loss, no manual migration needed.

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
    item.material = tags.get("material", item.material if preserve_existing else None)
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

### Vision Tagging Prompt (Updated — includes material)

```python
TAGGING_PROMPT = """You are a fashion assistant. Analyze this clothing item photo and return ONLY valid JSON with no markdown, no explanation.

{
  "category": "one of: tshirt, shirt, polo, jacket, hoodie, sweater, jeans, chinos, trousers, shorts, shoes, sneakers, boots, formal_shoes, accessory, other",
  "colors": ["primary color", "secondary color if present"],
  "tags": ["fit-type", "material-if-visible", "pattern-if-any"],
  "fit_type": "one of: slim, regular, oversized, relaxed",
  "occasions": ["one or more of: casual, work, formal, sport, outdoor"],
  "seasons": ["one or more of: spring, summer, fall, winter"],
  "material": "fabric composition if visible on label or clearly inferrable (e.g. '100% cotton', 'polyester blend'). Use null if completely unknown."
}"""
```

### Garment Measurement Inference (Iteration 1)

A second Ollama call is made **asynchronously after** the item is saved to the database.
This is non-blocking — the POST /items response returns immediately with the item, and
measurement inference runs in a background task.

```python
async def infer_garment_measurements(image_path: str, category: str) -> dict:
    """Returns dict with only non-null measurement keys. Temperature 0.2 for precision."""
    # Prompt requests: chest_width_cm, body_length_cm, sleeve_cm, waist_cm, inseam_cm
    # Returns {} if inference fails — caller silently ignores
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

### Outfit Generation Prompt (Iteration 6 — includes past outfit context)

```python
async def generate_outfits(items: list[dict], occasion: str, season: str,
                            past_outfits: list[dict] | None = None) -> list[dict]:
    # Sends only essential item fields: id, category, colors, occasions, seasons, fit_type
    # Includes top 5 past outfits (by rating + worn count) as preference examples
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

## Backend Services

### color_service.py (Iteration 3 — no Ollama)

Pure Python color palette intelligence. No AI calls — runs instantly.

```python
COLOR_GROUPS = {
    "neutrals": ["black", "white", "grey", "gray", "beige", "cream", "ivory", "off-white"],
    "cool":     ["blue", "navy", "teal", "cyan", "slate", "indigo", "purple", "lilac"],
    "warm":     ["red", "pink", "coral", "salmon", "orange", "burgundy", "maroon", "wine"],
    "earth":    ["brown", "tan", "camel", "khaki", "olive", "mustard", "rust", "terracotta"],
    "bright":   ["yellow", "lime", "green", "mint", "turquoise", "magenta", "fuchsia"],
}

def get_color_group(color: str) -> str: ...          # Returns group name or "other"
def get_palette_summary(items: list[dict]) -> dict:  # Analyzes all item colors → group counts
def suggest_complementary_colors(summary: dict) -> list[str]:  # Suggests underrepresented groups
def score_color_compatibility(color_a: str, color_b: str) -> float:  # 0.0–1.0 pair score
```

Used by `/shop/palette` endpoint and the Wardrobe palette view.

### compatibility_service.py (Iteration 4 — no Ollama)

Scores how well a candidate item integrates with the existing wardrobe.

```python
def score_item_compatibility(candidate: ClothingItem, wardrobe: list[ClothingItem]) -> float:
    # Factors (weighted):
    #   - Category complementarity: does wardrobe need this category type? (tops vs bottoms vs shoes)
    #   - Color compatibility: average score_color_compatibility() against all wardrobe items
    #   - Occasion/season overlap: does it fit existing use-case mix?
    # Returns: 0.0–1.0 (higher = better wardrobe fit)
```

### fit_service.py (Iteration 5 — no Ollama)

Verifies whether stored garment dimensions physically fit the user's body measurements.

```python
EASE_RANGES = {
    # (min_ease_cm, max_ease_cm) per fit_type for chest dimension
    "slim":      (2,  8),
    "regular":   (6, 14),
    "relaxed":   (12, 20),
    "oversized": (20, 999),
}

def verify_garment_fit(item: ClothingItem, profile: UserProfile) -> dict:
    # Returns: {"verdict": "perfect" | "tight" | "loose" | "too_small" | "too_large",
    #           "details": {dimension: {"ease_cm": float, "verdict": str}, ...}}
    # Skips dimensions not present in garment_measurements (treated as unmeasured)
```

### product_lookup_service.py (Iteration 2)

Multi-source product/barcode lookup with ordered fallback.

```python
async def lookup_product(upc: str) -> dict | None:
    # Tries in order:
    #   1. UPCItemDB:          https://api.upcitemdb.com/prod/trial/lookup?upc={upc}  (free, no auth)
    #   2. Open GTIN Database: https://www.barcodelookup.com/...                       (free, no auth)
    #   3. Barcode Lookup API: requires BARCODE_LOOKUP_API_KEY env var (optional)
    # Each failure is silently caught; next source tried immediately
    # Returns standardized dict or None:
    # {"brand", "title", "size", "color", "material", "garment_measurements"}
```

`barcode_service.py` is now a thin wrapper that delegates to `lookup_product()`.

### shopping_service.py (unchanged from v1.0)

- `compute_local_coverage()` — instant wardrobe coverage scoring, no AI
- `infer_size_for_suggestion()` — brand preference → body measurements → category fallback
- `build_google_shopping_url()` — Google Shopping search URL for suggested items

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
GET    /items/{id}/fit-check            # Garment fit verification — uses fit_service
GET    /items/barcode/{upc}             # Product lookup (3-source fallback) — returns pre-fill data

GET    /outfits                         # ?occasion= &season=
POST   /outfits/generate                # body: {"occasion": "work", "season": "winter"}
POST   /outfits
PUT    /outfits/{id}                    # Supports: rating, name fields
DELETE /outfits/{id}
POST   /outfits/{id}/worn               # Increment outfit times_worn, set worn_date to today
GET    /outfits/history                 # Outfits sorted by worn_date desc, with wear counts

GET    /shop/gaps                       # ?force=true to bypass 30s cache
GET    /shop/suggest                    # ?brand=zara&budget_cad=100
GET    /shop/palette                    # Instant color palette analysis — no Ollama
                                        # Returns: {by_group, dominant_group, underrepresented,
                                        #           complementary_suggestions, all_colors}
```

**POST /items metadata field**: When uploading, the `metadata` form field accepts a JSON string
with pre-filled data (from barcode scan or label scan): `brand`, `title`, `size`, `color`,
`material`, `garment_measurements`. These are applied to the item before/after AI tagging.

-----

## Frontend Theme & Design

The app uses a dark luxury theme defined as CSS custom properties in `frontend/src/index.css`.
All color usage throughout components must reference these variables — never hard-code hex values.

| Variable              | Value                                       | Usage                              |
|-----------------------|---------------------------------------------|------------------------------------|
| `--bg-primary`        | `#0C0C0C`                                  | Main background                    |
| `--bg-surface`        | `#161616`                                  | Cards, panels                      |
| `--bg-elevated`       | `#1E1E1E`                                  | Inputs, modals, dropdowns          |
| `--text-primary`      | `#F0EDE8`                                  | Main readable text                 |
| `--text-muted`        | `#6B6560`                                  | Secondary / placeholder text       |
| `--accent`            | `#C8A97E`                                  | Gold — CTAs, active states, focus  |
| `--accent-soft`       | `rgba(200,169,126,0.10)`                   | Subtle gold tint backgrounds       |
| `--success`           | `#4ADE80`                                  | Coverage rings ≥2, success toast   |
| `--warning`           | `#FBB846`                                  | Coverage rings =1, medium priority |
| `--danger`            | `#F87171`                                  | Coverage rings =0, high priority   |
| `--glass-bg`          | `rgba(20,20,20,0.72)`                      | Glassmorphism background token     |
| `--glass-border`      | `rgba(255,255,255,0.08)`                   | Glassmorphism border token         |
| `--gradient-gold`     | `linear-gradient(135deg, #C8A97E…#9A7A52)` | Multi-stop gold gradient           |
| `--shimmer-light`     | `#E8D5B0`                                  | Light gold for text shimmer        |
| `--font-serif`        | `"Cormorant Garamond", Georgia, serif`     | Display heading font stack         |

**Typography:**
- Body: System stack — `Inter, SF Pro Text, -apple-system, sans-serif`
- Display headings: `Cormorant Garamond` (Google Fonts), letter-spacing 0.2–0.3em

**Animation libraries in use:**
- `framer-motion`: AnimatePresence for page transitions and modal entrance
- `gsap`: Stagger entrance animations on wardrobe grid items (fromTo opacity + y)
- `tailwindcss-animate`: Additional Tailwind animation utility classes
- Tailwind keyframes: shimmer skeleton, text-shimmer gold sweep, ring-pulse, pulsing dots, gold-pulse, fade-up, text-reveal

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

## Frontend Components

### Toast System (`Toast.jsx`)

Context-based global toast notifications. Wrap at app root via `<ToastProvider>` in `App.jsx`.

```jsx
// Access anywhere via hook:
const { toast } = useToast()
toast({ type: "success", message: "Item added!" })
toast({ type: "error",   message: "AI tagging failed" })
toast({ type: "info",    message: "Syncing..." })

// Behaviour:
// - Max 4 toasts stacked, positioned above bottom nav (accounts for safe-area-inset-bottom)
// - Auto-dismiss after 3 seconds with animated progress bar
// - Each toast has an X dismiss button
// - Entrance animation: slide-in from right
```

### Phase Indicator (`PhaseIndicator.jsx`)

Visual stepper shown during AddItem upload flow.

```jsx
<PhaseIndicator
  phases={["Photo", "Preview", "AI Tag", "Done"]}
  current={2}   // 0-indexed; 2 = "AI Tag" is active
/>
// Completed phases show gold checkmark
// Active phase shows gold pulsing dot
// Pending phases are dimmed
// Connecting lines between steps
```

### Shadcn UI Components (`components/ui/`)

Accessible utility components following Shadcn patterns. Import via `@/components/ui/`:

```jsx
import { Badge }     from "@/components/ui/badge"      // Chip with variants
import { Button }    from "@/components/ui/button"     // Button with CVA variants
import { Input }     from "@/components/ui/input"      // Styled input primitive
import { Label }     from "@/components/ui/label"      // Accessible label (Radix)
import { Separator } from "@/components/ui/separator"  // Divider (Radix)
```

The `@/*` alias is configured in `frontend/jsconfig.json` → `./src/*`.
Component variants use `class-variance-authority` (CVA) for type-safe className composition.

-----

## Frontend Pages

### Wardrobe.jsx

Grid view (default) + **palette view** (toggle).

- **Grid view**: 2-col mobile / 4-col desktop, GSAP stagger entrance, filters by category/occasion/season
- **Palette view**: Calls `GET /shop/palette`, renders color groups (Neutrals, Cool, Warm, Earth, Bright) with item counts and color swatches. Uses `COLOR_CSS` map to render representative swatches.
- 3D Spline hero at top (180px, reduced-motion safe)
- GSAP stagger entrance (`fromTo` opacity + y) on grid items

### AddItem.jsx

6-phase upload flow: `idle → camera → labelScan → preview → upload → form → done`

- **idle**: Spline 3D scene (200px), tap to start. Shows PhaseIndicator at step 0.
- **camera**: Rear camera (`facingMode: "environment"`), capture button, option to switch to label scan mode.
- **labelScan**: Separate camera capture mode targeting clothing labels (care labels, size tags). Calls backend to extract brand/size/material/measurements from label photo. Stores result in `labelScanResult` state and merges into form.
- **preview**: Shows captured photo, confirm or retake. PhaseIndicator step 1.
- **upload**: Sends multipart form to `POST /items` with optional `metadata` JSON (from barcode/label). PhaseIndicator step 2 — shows pulsing dots during AI tagging (10–30s).
- **form**: If AI returns empty dict: manual form with dropdowns for all fields (category, colors, fit_type, occasions, seasons, material). Also shown to review/edit AI results. Includes garment measurement inputs (chest_width_cm, body_length_cm, sleeve_cm, waist_cm).
- **done**: Success state. PhaseIndicator step 3. "Add Another" resets to idle.

**Barcode scanning** (via `BarcodeScanner.jsx`): intercepts barcode scan, calls
`GET /items/barcode/{upc}`, pre-fills form fields.

### OutfitBuilder.jsx

Three tabs: **Generate**, **Saved**, **History**

- **Generate**: Occasion + season selectors → `POST /outfits/generate` → shows 3 AI-suggested outfits. "Save Outfit" persists. "Wear Today?" quick suggestion (casual + current season, uses past outfit context from Iteration 6).
- **Saved**: All saved outfits from `GET /outfits`. Star rating (1–5) via `PUT /outfits/{id}`. Delete.
- **History** (Iteration 6): Outfits sorted by `worn_date` desc via `GET /outfits/history`. Each entry shows wear count + last worn date. Outfit naming input (editable inline, saved via `PUT /outfits/{id}`). "Mark Worn" button calls `POST /outfits/{id}/worn`.

### Profile.jsx

Body measurements form + **structured brand sizes** (Iteration 5).

- Measurements: height, weight, chest, waist, hips, inseam, shoulder, arm length, neck (all in cm).
- Brand sizes: List UI — "Add brand size" button shows brand + size inputs. Delete per entry. Serializes to/from `brand_sizes` JSON string. Common brand suggestions: Zara, H&M, Uniqlo, Gap, Levi's.

### Shop.jsx

- **Coverage rings**: Instant local coverage by occasion (no Ollama). Ring color: green ≥2, yellow =1, red =0.
- **Gap cards**: From `GET /shop/gaps` (30s cached Ollama call). Shows priority badges, missing items.
- **Shopping suggestions**: From `GET /shop/suggest`. Each card has Google Shopping deep link.
- **Color palette section** (Iteration 3): Calls `GET /shop/palette`. Shows dominant color group, underrepresented groups, and complementary color suggestions (e.g., "Add earth tones to balance your cool-heavy wardrobe").

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
- Use `useToast()` hook for all user-facing success/error feedback — no `alert()`.
- Shadcn `ui/` components use `@/components/ui/` import path (jsconfig alias).

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
npm install tailwindcss @tailwindcss/vite tailwindcss-animate \
  @zxing/library axios \
  framer-motion gsap @splinetool/react-spline \
  lucide-react @iconify/react \
  clsx tailwind-merge react-router-dom \
  @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slot \
  class-variance-authority
```

-----

## Implementation Status

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

### Post-v1.0 Iterations ✅

**Iteration 1 — Garment Physical Specs**
- Vision-based garment measurement inference (second async Ollama call after upload)
- Material/fabric extraction added to tagging prompt and ClothingItem model
- `GET /items/{id}/fit-check` endpoint using fit_service

**Iteration 2 — Multi-Source Product Lookup**
- `product_lookup_service.py` with 3-API fallback chain (UPCItemDB → Open GTIN → Barcode Lookup)
- Label photo scan mode in AddItem (captures care/size labels, extracts structured data)
- Garment measurements from label scan merged with AI inference results

**Iteration 3 — Color Palette Intelligence**
- `color_service.py`: pure Python color grouping + compatibility scoring (no Ollama)
- `GET /shop/palette` endpoint with instant response
- Palette view toggle in Wardrobe page (color group distribution visualization)
- Color palette section in Shop page with complementary suggestions

**Iteration 4 — Compatibility Scoring**
- `compatibility_service.py`: wardrobe integration score for candidate items
- Factors: category complementarity, color compatibility, occasion/season overlap

**Iteration 5 — Fit Verification**
- `fit_service.py`: garment dimension vs. body measurement check with ease ranges by fit_type
- Structured brand sizes management UI in Profile page (list-based add/delete)

**Iteration 6 — Outfit Wear Lifecycle**
- `times_worn`, `worn_date`, `name` fields on SavedOutfit model
- `POST /outfits/{id}/worn` endpoint + `GET /outfits/history`
- History tab in OutfitBuilder with wear tracking and outfit naming
- Past outfit context passed to `generate_outfits` for personalized suggestions

### Backlog (Not Yet Implemented)

- Gemini 2.5 Flash-Lite fallback — referenced in config but no actual code path exists
- Color palette gap detection (planned in PRD Phase 3)
- Versatility score per shopping suggestion ("this chino matches 7 of your tops")

-----

## Critical Notes

- Always start Ollama and backend BEFORE frontend
- Test Ollama tagging with a real clothing photo FIRST — verify valid JSON returned
- Image naming: `{item_id}_{uuid}.jpg` in `backend/data/images/`
- JSON fields in SQLite: store as strings, parse with `json.loads()` in service layer
- No auth needed — single user, local network only
- Ollama first inference: 15–30 seconds while model loads into VRAM — show clear loading state
- Garment measurement inference runs async after item save — item is usable immediately, no blocking
- If AI returns malformed JSON: fall back to manual tag form, NEVER crash the app
- Handle Ollama connection error: `httpx.ConnectError` if Ollama is not running
- VRAM: do not run GPU-intensive apps while using wardrobe AI (GTX 1050Ti 4GB is shared)
- `preserve_existing=True` on retag: AI result never clobbers manually edited fields
- Database migrations run automatically at startup via `run_migrations()` — safe on existing DBs
- `datetime.now(timezone.utc)` used throughout (not deprecated `datetime.utcnow()`)
- All user feedback through `useToast()` hook — never use `alert()` or `console.error` as UX
