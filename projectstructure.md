# WardrobeAI — Codebase Reference

> **Purpose:** One-file codebase map for fast context recovery. No need to re-read
> source files before making changes — read this first, then pinpoint the exact file.
> All information is derived from actual source code, no assumptions.
>
> **Last updated:** 2026-03-15
>
> **Maintenance rule:** This file MUST be updated in the same commit as any code change.
> New file → Section 0. New endpoint → Sections 2 & 5. New model field → Section 3.
> New component → Section 10. Data flow change → Section 7. Never commit code without syncing this file.

---

## 0. Quick Navigation Index

### Root
| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project instructions, tech stack, rules (incl. issue-tracking rules) |
| `README.md` | Project overview, quick start, API reference, data models |
| `CHANGELOG.md` | Keep-a-Changelog formatted history; bump with every version release |
| `VERSION` | Current semver string (1.0.0); single source of truth for version |
| `HANDOFF.md` | Project handoff: backlog issues, next steps, dev workflow |
| `test_ollama_tagging.py` | Standalone test: creates synthetic image, calls AI tag endpoint |
| `WardrobeAI PRD.docx` | Product requirements document (binary) |

### .github
| File | Purpose |
|------|---------|
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Structured bug-report form (area, priority, steps) |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Structured feature-request form |
| `.github/ISSUE_TEMPLATE/config.yml` | Disables blank issues; links to README |
| `.github/pull_request_template.md` | PR checklist: type, test plan, screenshots, projectstructure.md tick |

### Scripts
| File | Purpose |
|------|---------|
| `scripts/setup_github.py` | One-shot bootstrap: creates 6 labels + seeds 12 backlog issues via GitHub API |
| `scripts/verify.sh` | Full 4-loop verification (starts backend, runs all test suites, cleans up) |

### Backend
| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app init, CORS, static files, lifespan (DB creation) |
| `backend/database.py` | SQLite engine, table creation, migrations, session dep |
| `backend/models/user.py` | `UserProfile` SQLModel |
| `backend/models/item.py` | `ClothingItem` SQLModel |
| `backend/models/outfit.py` | `SavedOutfit` SQLModel |
| `backend/routers/profile.py` | GET/POST `/profile` |
| `backend/routers/items.py` | All 10 `/items` endpoints |
| `backend/routers/outfits.py` | All 7 `/outfits` endpoints |
| `backend/routers/shop.py` | GET `/shop/gaps`, `/shop/suggest`, `/shop/palette` |
| `backend/services/ai_service.py` | Ollama calls: tagging, measurement inference, outfit gen, gap analysis |
| `backend/services/product_lookup_service.py` | 4-source barcode lookup + label OCR |
| `backend/services/barcode_service.py` | Thin wrapper → `product_lookup_service` |
| `backend/services/shopping_service.py` | Coverage scoring, size inference, suggestion building |
| `backend/services/color_service.py` | Color grouping, palette analysis, compatibility scoring |
| `backend/services/compatibility_service.py` | Item-vs-wardrobe compatibility scoring |
| `backend/services/fit_service.py` | Garment measurements vs body measurements verdict |
| `backend/test_api.py` | Baseline 62-test suite (no pytest); run: `python backend/test_api.py` |
| `backend/test_adversarial.py` | Adversarial 139-test suite (edge cases); run: `python backend/test_adversarial.py` |

### Frontend
| File | Purpose |
|------|---------|
| `frontend/src/main.jsx` | React entry point, BrowserRouter mount |
| `frontend/src/App.jsx` | Routes, ToastProvider, ErrorBoundary, AnimatePresence transitions, SplashScreen |
| `frontend/src/index.css` | CSS variables (theme), Tailwind base, keyframes |
| `frontend/src/lib/utils.js` | `cn()` class merger, `parseJson()` safe parser |
| `frontend/src/lib/scenes.js` | Spline scene URLs, `SPLASH_SEEN_KEY` |
| `frontend/src/lib/colors.js` | Shared `COLOR_MAP` + `getColorCSS()` color resolver |
| `frontend/src/lib/constants.js` | Shared `CATEGORIES`, `OCCASIONS`, `SEASONS`, `FIT_TYPES`, `INPUT_STYLE`, `toggleArr()`, `isPhotoValid()` |
| `frontend/src/pages/Wardrobe.jsx` | Main wardrobe grid + filters + palette view |
| `frontend/src/pages/AddItem.jsx` | 6-phase upload flow: idle→camera→preview→upload→form→done |
| `frontend/src/pages/OutfitBuilder.jsx` | Generate/Saved/History 3-tab outfit manager |
| `frontend/src/pages/Profile.jsx` | Body measurements + brand sizes form |
| `frontend/src/pages/Shop.jsx` | Coverage rings + gap cards + shopping suggestions |
| `frontend/src/components/Navbar.jsx` | Fixed bottom 5-tab navigation bar |
| `frontend/src/components/ItemCard.jsx` | Grid card: photo, swatches, worn badge, mark worn |
| `frontend/src/components/ItemDetailModal.jsx` | Full-screen sheet: view/edit/retag/fit-check/delete |
| `frontend/src/components/OutfitCard.jsx` | Outfit display: thumbnails, reason, stars, actions |
| `frontend/src/components/OutfitGallery.jsx` | WebGL Three.js horizontal drag gallery with sticky shader effect; replaces saved outfits grid in OutfitBuilder |
| `frontend/src/components/BarcodeScanner.jsx` | @zxing full-screen camera barcode reader |
| `frontend/src/components/PhaseIndicator.jsx` | AddItem 4-step progress bar (Photo→Preview→AI Tag→Done) |
| `frontend/src/components/SplineScene.jsx` | Lazy-loaded Spline 3D wrapper + error boundary |
| `frontend/src/components/SplashScreen.jsx` | First-launch 3D splash, 2.4s auto-dismiss |
| `frontend/src/components/Toast.jsx` | Toast notification system + `useToast()` hook |
| `frontend/src/components/ErrorBoundary.jsx` | React class error boundary (renders null on crash) |
| `frontend/src/components/LuxSelect.jsx` | Styled native `<select>` with gold focus ring |
| `frontend/src/components/TextShimmer.jsx` | Heading with animated gold shimmer sweep |
| `frontend/src/components/NoiseOverlay.jsx` | Fixed grain texture overlay (pointer-events none) |
| `frontend/src/components/GlassCard.jsx` | Reusable glassmorphism container |

---

## 1. Architecture Overview

```
Phone (browser) ─── WiFi ───► Frontend  Vite dev server  0.0.0.0:5173
                                  │
                                  │ Axios  import.meta.env.VITE_API_URL
                                  ▼
                             Backend  FastAPI  0.0.0.0:8000
                           ┌────────────────────────────┐
                           │ /images  StaticFiles mount  │
                           │ SQLite   wardrobe.db        │
                           │ Ollama   localhost:11434     │
                           │ UPCItemDB / OpenGTINDB (HTTP)│
                           └────────────────────────────┘
```

**Ports:**
- Frontend: `0.0.0.0:5173` (accessible from phone on same WiFi)
- Backend: `0.0.0.0:8000`
- Ollama: `http://localhost:11434` (local only, not exposed to phone)

**Image storage:**
- Saved to: `backend/data/images/{item_id}_{uuid}.jpg`
- Served at: `http://{PC_LAN_IP}:8000/images/{filename}`
- Frontend constructs URL: `` `${API_URL}/images/${item.photo_path}` ``

**CORS:** `allow_origins=["*"]` — phone on same WiFi needs unrestricted access.

**Environment:**
- `frontend/.env` → `VITE_API_URL=http://{LAN_IP}:8000` (must set real IP)
- Backend has no `.env` in use; Ollama URL is hardcoded in `ai_service.py`

**PWA:** `frontend/public/manifest.json` — enables "Add to Home Screen" on iOS/Android.
Icon files at `public/icons/icon-192.png` and `icon-512.png` are **referenced but not
present on disk** — need to be created if PWA icons are needed.

---

## 2. Frontend → Backend Integration Map

Quick lookup: which frontend file calls which backend endpoint.

| Frontend File | Endpoints Called |
|---------------|-----------------|
| `pages/Wardrobe.jsx` | `GET /items`, `GET /shop/palette`, `POST /items/{id}/worn` |
| `pages/AddItem.jsx` | `POST /items`, `GET /items/barcode/{upc}`, `POST /items/scan-label`, `PUT /items/{id}` |
| `pages/OutfitBuilder.jsx` | `POST /outfits/generate`, `GET /outfits`, `GET /outfits/history`, `POST /outfits`, `PUT /outfits/{id}`, `DELETE /outfits/{id}`, `POST /outfits/{id}/worn` |
| `pages/Profile.jsx` | `GET /profile`, `POST /profile` |
| `pages/Shop.jsx` | `GET /shop/gaps`, `GET /shop/palette`, `GET /shop/suggest` |
| `components/ItemCard.jsx` | `POST /items/{id}/worn` |
| `components/ItemDetailModal.jsx` | `PUT /items/{id}`, `POST /items/{id}/tag`, `GET /items/{id}/fit-check`, `DELETE /items/{id}` |

**Reverse lookup — if you change an endpoint, these files break:**

| Endpoint | Affected Frontend Files |
|----------|------------------------|
| `GET /items` | Wardrobe.jsx |
| `POST /items` | AddItem.jsx |
| `PUT /items/{id}` | AddItem.jsx, ItemDetailModal.jsx |
| `DELETE /items/{id}` | ItemDetailModal.jsx |
| `POST /items/{id}/worn` | Wardrobe.jsx (inline), ItemCard.jsx |
| `POST /items/{id}/tag` | ItemDetailModal.jsx |
| `GET /items/{id}/fit-check` | ItemDetailModal.jsx |
| `GET /items/barcode/{upc}` | AddItem.jsx |
| `POST /items/scan-label` | AddItem.jsx |
| `POST /outfits/generate` | OutfitBuilder.jsx |
| `GET /outfits` | OutfitBuilder.jsx |
| `POST /outfits` | OutfitBuilder.jsx |
| `PUT /outfits/{id}` | OutfitBuilder.jsx |
| `DELETE /outfits/{id}` | OutfitBuilder.jsx |
| `POST /outfits/{id}/worn` | OutfitBuilder.jsx |
| `GET /outfits/history` | OutfitBuilder.jsx |
| `GET /profile` | Profile.jsx |
| `POST /profile` | Profile.jsx |
| `GET /shop/gaps` | Shop.jsx |
| `GET /shop/suggest` | Shop.jsx |
| `GET /shop/palette` | Wardrobe.jsx, Shop.jsx |

---

## 3. Data Models

All models use SQLModel with SQLite. JSON arrays/dicts stored as TEXT strings.

### `UserProfile` — `backend/models/user.py`

Single-user model (always ID=1). Created automatically on first GET /profile.

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `id` | int (PK) | 1 | Always 1 (single user) |
| `name` | str | "Vipin" | Display name |
| `height_cm` | float | 0 | Body measurement |
| `weight_kg` | float | 0 | Body measurement |
| `chest_cm` | float | 0 | Used for size inference |
| `waist_cm` | float | 0 | Used for size inference |
| `hips_cm` | float | 0 | Body measurement |
| `inseam_cm` | float | 0 | Body measurement |
| `shoulder_cm` | float | 0 | Body measurement |
| `arm_length_cm` | float | 0 | Body measurement |
| `neck_cm` | float | 0 | Body measurement |
| `brand_sizes` | str (JSON) | "{}" | e.g. `{"Zara": "M", "H&M": "L"}` |

---

### `ClothingItem` — `backend/models/item.py`

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `id` | int\|None (PK) | auto | Auto-generated DB ID |
| `photo_path` | str | required | Filename only: `{id}_{uuid}.jpg` |
| `category` | str | required | tshirt/shirt/polo/jacket/hoodie/sweater/jeans/chinos/trousers/shorts/shoes/sneakers/boots/formal_shoes/accessory/other |
| `colors` | str (JSON array) | "[]" | e.g. `["navy", "white"]` |
| `tags` | str (JSON array) | "[]" | e.g. `["slim-fit", "cotton", "striped"]` |
| `brand` | str\|None | None | Brand name |
| `size_label` | str\|None | None | XS/S/M/L/XL/XXL |
| `fit_type` | str\|None | None | slim/regular/oversized/relaxed |
| `occasions` | str (JSON array) | "[]" | casual/work/formal/sport/outdoor |
| `seasons` | str (JSON array) | "[]" | spring/summer/fall/winter |
| `date_added` | datetime | utcnow | Auto-set on creation |
| `times_worn` | int | 0 | Incremented by POST /items/{id}/worn |
| `notes` | str\|None | None | User notes |
| `garment_measurements` | str (JSON dict) | "{}" | e.g. `{"chest_width_cm": 54, "body_length_cm": 72, "sleeve_cm": 62, "waist_cm": 82}` |
| `material` | str\|None | None | e.g. "100% cotton" |

---

### `SavedOutfit` — `backend/models/outfit.py`

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `id` | int\|None (PK) | auto | Auto-generated DB ID |
| `item_ids` | str (JSON array) | required | e.g. `"[1, 3, 7]"` — IDs only in DB |
| `occasion` | str\|None | None | casual/work/formal/sport/outdoor |
| `season` | str\|None | None | spring/summer/fall/winter |
| `rating` | int\|None | None | 1–5 stars |
| `created_at` | datetime | utcnow | Auto-set on creation |
| `worn_date` | str\|None | None | ISO-8601 string of last worn date |
| `times_worn` | int | 0 | Incremented by POST /outfits/{id}/worn |
| `name` | str\|None | None | User-given name, e.g. "Work Monday Look" |

> **Key pattern:** `item_ids` is stored as a JSON string in SQLite. All GET /outfits
> and POST /outfits/generate responses **enrich** IDs to full item objects via a batch
> `SELECT WHERE id IN (...)` before returning to the frontend.

---

## 4. Database & Migrations

**File:** `backend/database.py`

| Symbol | Purpose |
|--------|---------|
| `DATABASE_URL` | `"sqlite:///backend/wardrobe.db"` |
| `engine` | SQLAlchemy engine, `check_same_thread=False` |
| `create_db_and_tables()` | Creates all tables from SQLModel metadata; called on startup |
| `run_migrations()` | Adds new columns via `ALTER TABLE`; idempotent (checks `PRAGMA table_info` first); called every restart |
| `get_session()` | FastAPI dependency generator yielding `Session` |

**Tracked migrations (columns added after v1.0):**

| Column | Table | SQL Type |
|--------|-------|---------|
| `garment_measurements` | clothingitem | TEXT DEFAULT '{}' |
| `material` | clothingitem | TEXT |
| `worn_date` | savedoutfit | TEXT |
| `times_worn` | savedoutfit | INTEGER DEFAULT 0 |
| `name` | savedoutfit | TEXT |

---

## 5. API Endpoints

### `routers/profile.py`

| Method | Path | Function | Input | Output |
|--------|------|----------|-------|--------|
| GET | `/profile` | `get_profile()` | — | `UserProfile` (auto-creates ID=1 if missing) |
| POST | `/profile` | `update_profile()` | `ProfileUpdate` (all optional fields) | `UserProfile` |

---

### `routers/items.py`

| Method | Path | Function | Input | Output |
|--------|------|----------|-------|--------|
| POST | `/items` | `add_item()` | multipart: `photo` (File) + `metadata` (Form JSON string, optional) | `ClothingItem` + `ai_tagged: bool` |
| GET | `/items` | `list_items()` | `?category= &occasion= &season=` | `list[ClothingItem]` |
| GET | `/items/{id}` | `get_item()` | path: `item_id` | `ClothingItem` or 404 |
| PUT | `/items/{id}` | `update_item()` | `ClothingItemUpdate` (all optional) | `ClothingItem` or 404 |
| DELETE | `/items/{id}` | `delete_item()` | path: `item_id` | `{"ok": True}` or 404; also deletes image file + invalidates gaps cache |
| GET | `/items/barcode/{upc}` | `lookup_barcode()` | path: `upc` | dict or 404 |
| POST | `/items/scan-label` | `scan_label_photo()` | multipart: `photo` (File) | dict (brand, size, material, etc.) — does NOT create item |
| POST | `/items/{id}/worn` | `mark_worn()` | path: `item_id` | `{"id": int, "times_worn": int}` |
| POST | `/items/{id}/tag` | `retag_item()` | path: `item_id` | `ClothingItem` + `ai_tagged: bool`; uses `preserve_existing=True` |
| GET | `/items/{id}/fit-check` | `fit_check()` | path: `item_id` | fit verdict dict (see fit_service) |

`ClothingItemUpdate` optional fields: `category, colors (list), tags (list), brand, size_label, fit_type, occasions (list), seasons (list), notes, material, garment_measurements (dict)`

> **Filter behavior:** `occasion` and `season` filters search JSON arrays via SQL LIKE.

---

### `routers/outfits.py`

| Method | Path | Function | Input | Output |
|--------|------|----------|-------|--------|
| POST | `/outfits/generate` | `generate_outfit_suggestions()` | `{"occasion": str, "season": str}` | `{"occasion", "season", "suggestions": [{items: [...full objects...], item_ids: [...], reason: str}]}` |
| GET | `/outfits` | `list_outfits()` | `?occasion= &season=` | `list[SavedOutfit + items]` (enriched) |
| POST | `/outfits` | `save_outfit()` | `{"item_ids": list[int], "occasion"?, "season"?, "rating"?}` | `SavedOutfit` |
| PUT | `/outfits/{id}` | `update_outfit()` | `{"rating"?: 1–5, "name"?: str}` | `SavedOutfit` or 404 |
| DELETE | `/outfits/{id}` | `delete_outfit()` | path: `outfit_id` | `{"ok": True}` or 404 |
| POST | `/outfits/{id}/worn` | `mark_outfit_worn()` | path: `outfit_id` | `{"id", "times_worn", "worn_date": ISO-8601}` — also batch-increments `times_worn` on each item |
| GET | `/outfits/history` | `outfit_history()` | — | `list[SavedOutfit + items]` where `times_worn > 0`, sorted by `worn_date DESC` |

---

### `routers/shop.py`

| Method | Path | Function | Input | Output |
|--------|------|----------|-------|--------|
| GET | `/shop/gaps` | `get_gaps()` | `?force=true` | `{"total_items", "local_coverage": {counts, flagged}, "ai_gaps": [...], "ai_coverage_score": {...}}` |
| GET | `/shop/suggest` | `get_suggestions()` | `?brand= &budget_cad=` | `{"suggestions": [...], "brand", "budget_cad"}` |
| GET | `/shop/palette` | `get_palette()` | — | `{"by_group", "dominant_group", "underrepresented", "complementary_suggestions", "all_colors"}` |

**Gap analysis cache** (`shop.py` module-level):
```python
_gaps_cache = {"result": None, "item_count": -1, "ts": 0.0}
_GAPS_CACHE_TTL = 30  # seconds
```
- Cache is **invalidated** when `DELETE /items/{id}` is called (via `invalidate_gaps_cache()`)
- `force=true` bypasses TTL check

---

## 6. Service Layer

### `services/ai_service.py`

**Config:**
```python
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3.5:2b"
```

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `parse_ai_json(raw)` | `str → dict` | Parsed JSON or `{}` | Strips `<think>…</think>` blocks and markdown fences first |
| `tag_clothing_image(image_path)` | `str → dict` | Tags dict or `{}` | Vision call, temp=0.1, timeout=120s; returns `{}` on Ollama down |
| `infer_garment_measurements(image_path, category)` | `(str, str) → dict` | Measurements or `{}` | Vision call, temp=0.2, timeout=120s |
| `generate_outfits(items, occasion, season, past_outfits=None)` | `(list, str, str, list?) → list` | `[{"items": [...IDs], "reason": str}]` | temp=0.3; passes slim item dicts to reduce prompt size |
| `analyze_gaps(items)` | `list → dict` | `{"gaps": [...], "coverage_score": {...}}` | temp=0.1; returns `{"gaps": [], "coverage_score": {}}` on failure |

**Tagging prompt output fields:** `category, colors (list), tags (list), fit_type, occasions (list), seasons (list), material`

**Measurement prompt output fields:** `chest_width_cm, body_length_cm, sleeve_cm, waist_cm, inseam_cm` (nulls allowed)

---

### `services/product_lookup_service.py`

4-source chain (tries in order, returns first success):

| Priority | Source | Auth | Timeout |
|----------|--------|------|---------|
| 1 | UPCItemDB | None | 8s |
| 2 | Open GTIN Database | None | 8s |
| 3 | Barcode Lookup | `BARCODE_LOOKUP_KEY` env var | 8s |
| 4 | GS1 Prefix Map | Hardcoded (Nike, Adidas, H&M, Zara, Uniqlo, Mango, Pull&Bear, Bershka) | Instant |

**Unified result dict:** `{brand, title, size, color, material, description, garment_measurements, category, source}`

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `lookup_product(upc)` | `str → dict\|None` | First-success result or None | Tries all 4 sources |
| `lookup_from_label_photo(image_path)` | `str → dict` | `{brand, size, material, country, care_instructions, other_text}` or `{}` | Ollama vision OCR, temp=0.05, timeout=120s |

---

### `services/barcode_service.py`

```python
def lookup_upc(upc: str) -> dict | None:
    # Thin wrapper → product_lookup_service.lookup_product(upc)
```

---

### `services/shopping_service.py`

| Function | Signature | Returns |
|----------|-----------|---------|
| `compute_local_coverage(items)` | `list → dict` | `{"counts": {occasion: int}, "flagged": [occasions with <2 items]}` |
| `infer_size(category, profile, brand)` | `(str, dict, str?) → str` | Size string (XS/S/M/L/XL/XXL). Priority: brand_sizes preference → chest/waist cm thresholds → "M" fallback |
| `build_google_shopping_url(query)` | `str → str` | Google Shopping URL with encoded query |
| `build_suggestions(gaps, profile, brand, budget_cad, wardrobe_items)` | `(list, dict, str?, float?, list?) → list` | Suggestions sorted by priority then compatibility score (desc) |

**Size thresholds (chest/waist cm):** ≤88→XS, ≤96→S, ≤104→M, ≤112→L, ≤120→XL, >120→XXL

---

### `services/color_service.py`

5 color groups: `neutrals, cool, warm, earth, bright`

| Function | Signature | Returns |
|----------|-----------|---------|
| `get_color_group(color)` | `str → str\|None` | Group name or None (case-insensitive, partial match fallback) |
| `get_palette_summary(items)` | `list → dict` | `{by_group, dominant_group, underrepresented, all_colors}` |
| `suggest_complementary_colors(palette_summary)` | `dict → list[str]` | 2–3 color name suggestions |
| `score_color_compatibility(color_a, color_b)` | `(str, str) → float` | 0.0–1.0. Neutrals=0.95, compat pairs=0.85, neutral+color=0.80, incompat=0.25, unknown=0.5 |
| `extract_dominant_color_from_image(image_path)` | `str → str\|None` | Dominant color name via Pillow (no AI). Returns None on failure |

---

### `services/compatibility_service.py`

| Function | Signature | Returns |
|----------|-----------|---------|
| `score_item_compatibility(candidate, wardrobe_items)` | `(dict, list) → dict` | `{"score": 0.0–1.0, "match_count": int, "matching_items": [top 6]}` |
| `build_candidate_from_gap_item(missing_item, occasion)` | `(str, str) → dict` | Candidate dict from free-text AI item name |

**Pair scoring weights:** category compatibility 40% + color compatibility 30% + occasion overlap 20% + season overlap 10%

---

### `services/fit_service.py`

| Function | Signature | Returns |
|----------|-----------|---------|
| `verify_garment_fit(garment_measurements, profile, fit_type, category)` | `(dict, dict, str?, str) → dict` | `{fits: bool?, overall_verdict, overall_label, color, chest_verdict?, waist_verdict?, notes}` |

**Ease ranges by fit_type (cm breathing room):**

| Fit Type | Min ease | Max ease |
|----------|---------|---------|
| slim | 2 | 8 |
| regular | 6 | 14 |
| relaxed | 12 | 20 |
| oversized | 20 | 40 |
| unknown | 4 | 16 |

**Verdicts:** too_small / tight / perfect / loose / too_large / unknown
**Colors:** danger (red), warning (yellow), success (green), neutral (gray)

---

## 7. Key Data Flows

### Flow 1: Add Item (POST /items) — 12 Steps

```
1. Receive multipart: photo file + optional metadata JSON string
2. Validate image via PIL.Image.verify() → 400 if invalid
3. Save to temp file: backend/data/images/tmp_{uuid}.jpg
4. Create ClothingItem row in DB (without ID yet) → flush to get auto-ID
5. Rename file: tmp_{uuid}.jpg → {item_id}_{uuid}.jpg
6. Update item.photo_path in DB → commit
7. Call tag_clothing_image({id}_{uuid}.jpg) async [120s, temp=0.1]
   └─ If Ollama down: returns {} → ai_tagged=False → caller shows manual form
8. If tags returned: _apply_tags(item, tags, preserve_existing=False)
9. If user metadata provided: override AI tags with explicit user values
10. Call infer_garment_measurements() async IF garment_measurements empty
11. Call extract_dominant_color_from_image() via Pillow IF colors empty
12. Final commit → return item + ai_tagged bool
```

### Flow 2: Re-tag Item (POST /items/{id}/tag)

```
1. Fetch existing ClothingItem by ID
2. Call tag_clothing_image() async
3. _apply_tags(item, tags, preserve_existing=True)
   └─ preserve_existing=True: only overwrite if new value is non-empty
      (never clobbers manually-edited fields)
4. Commit → return item + ai_tagged bool
```

### Flow 3: Shopping Suggestions

```
1. GET /shop/gaps → compute_local_coverage() (instant, no AI)
                  → analyze_gaps() via Ollama (30s cached)
2. GET /shop/suggest → for each gap, for each missing_item:
   a. build_candidate_from_gap_item(missing_item, occasion)
   b. score_item_compatibility(candidate, wardrobe_items)
   c. infer_size(category, profile, brand)
   d. build_google_shopping_url(query)
   e. Create suggestion dict with score + matching_items (top 6)
3. Sort by priority (high→medium→low) then score (desc)
4. Return with optional brand/budget filters applied
```

### Flow 4: AddItem UI Phase Machine

```
idle       → [Take Photo] → camera
camera     → [Capture]    → previewing
camera     → [Barcode]    → barcode → (scan result pre-fills form) → previewing
previewing → [Retake]     → camera
previewing → [Use Photo]  → uploading (POST /items fires)
uploading  → ai_tagged=True  → done (shows item summary)
uploading  → ai_tagged=False → manual_form (shows tag dropdown form)
manual_form→ [Save]       → PUT /items/{id} → done
done       → [Add Another] → idle
```

PhaseIndicator shows: Photo (idle/camera) → Preview (previewing) → AI Tag (uploading/manual_form) → Done. Hidden during camera and barcode phases.

### Flow 5: Outfit Generation

```
1. POST /outfits/generate {occasion, season}
2. Filter items by occasion AND season (JSON LIKE query)
3. Fetch top 5 past outfits (highest rating + times_worn)
4. Call generate_outfits(slim_items, occasion, season, past_outfits) [temp=0.3]
   → Returns: [{"items": [id1, id2], "reason": "brief note"}, ...]
5. Enrich each suggestion: IDs → full ClothingItem objects (batch SELECT)
6. Return {occasion, season, suggestions: [{items: [...full objects...], item_ids, reason}]}
```

---

## 8. Frontend: Routing & App Shell

### `frontend/src/App.jsx`

```
Routes:
  /          → <Wardrobe />
  /add       → <AddItem />
  /outfits   → <OutfitBuilder />
  /shop      → <Shop />
  /profile   → <Profile />
```

**Shell structure:**
```jsx
<ToastProvider>
  <SplashScreen onDone={...} />   {/* sessionStorage-gated, 2.4s auto-dismiss */}
  <AnimatePresence mode="wait">   {/* page transitions: opacity + y slide */}
    <Routes>...</Routes>
  </AnimatePresence>
  <Navbar />
</ToastProvider>
```

Each page wrapped in `<ErrorBoundary>` to prevent white-screen crashes.

### `frontend/src/components/SplashScreen.jsx`

- Checks `sessionStorage.getItem(SPLASH_SEEN_KEY)` — skips if already seen
- Auto-dismisses after 2400ms
- Exit: opacity fade + scale 0.97 (550ms)
- Contains full-screen `<SplineScene scene={SCENES.splash} />`

---

## 9. Frontend: Pages

### `pages/Wardrobe.jsx`

**State:** `items[], loading, filters{category,occasion,season}, selectedItem, view('grid'|'palette'), paletteData, paletteLoading`

**API calls:** `GET /items?...filters`, `GET /shop/palette`, `POST /items/{id}/worn`

**Components used:** `SplineScene` (hero, 180px), `TextShimmer` (title), `ItemCard` (grid), `ItemDetailModal` (on card click)

**Key behaviors:**
- GSAP stagger entrance on items: `fromTo opacity+y`, 0.42s duration, 0.05s stagger
- Color palette view: groups colors into 5 groups with percentage bars + swatches
- Filter pills update items in real-time (re-fetch on change)
- Grid: 2 columns mobile (`grid-cols-2`), 4 columns desktop (`md:grid-cols-4`)

---

### `pages/AddItem.jsx`

**State:** `phase, preview(blob URL), photoFile, savedItem, barcodeInfo, labelScanMode, labelScanResult, manualForm{category,fit_type,brand,size_label,colors,occasions,seasons,material,notes,garment_measurements}`

**API calls:** `POST /items`, `GET /items/barcode/{upc}`, `POST /items/scan-label`, `PUT /items/{id}`

**Components used:** `BarcodeScanner`, `SplineScene` (idle phase, 200px), `LuxSelect`, `PhaseIndicator`

**Key behaviors:**
- Camera: `getUserMedia({ video: { facingMode: 'environment' } })` for rear cam; canvas capture at JPEG 0.9 quality
- File picker fallback if no camera
- Manual form shown if `category === 'unknown'` (AI returned empty)
- Garment measurements: 4 number inputs; empty/zero values stripped before PUT
- Label scan: OCR result shown as AnimatePresence toast, pre-fills brand/size/material

---

### `pages/OutfitBuilder.jsx`

**State:** `tab('generate'|'saved'|'history'), occasion, season, suggestions[], savedOutfits[], historyOutfits[], generating, loadingSaved, loadingHistory, todayLoading, error, nameInputs{}, wornLoading`

**API calls:** `POST /outfits/generate`, `GET /outfits`, `GET /outfits/history`, `POST /outfits`, `PUT /outfits/{id}`, `DELETE /outfits/{id}`, `POST /outfits/{id}/worn`

**Components used:** `OutfitCard` (Generate tab), `OutfitGallery` (Saved tab)

**Key behaviors:**
- Season auto-inferred from current month on mount
- "Wear Today?" → `POST /outfits/generate {occasion: 'casual', season: current}`
- Tab transitions: Framer Motion AnimatePresence x-slide
- Saved tab: WebGL drag gallery (`OutfitGallery`) with sticky deformation shader — replaces old card grid
- History tab: date chip (MM-DD-YYYY), item thumbnails (first 5), times worn, GSAP stagger entrance

---

### `pages/Profile.jsx`

**State:** `form{name, all 9 measurements, brand_sizes}, brandList[{brand,size}], newBrand, newSize, loading, saving, toast, toastOk, focused`

**API calls:** `GET /profile`, `POST /profile`

**Key behaviors:**
- 9 measurement fields in 2-col grid (float inputs)
- Brand sizes: add row (datalist autocomplete via COMMON_BRANDS), remove row (animated exit)
- Empty measurement values stripped before POST
- Toast auto-dismisses after 3s; gold input focus ring on active field

---

### `pages/Shop.jsx`

**State:** `gapsData{local_coverage,ai_gaps,total_items}, loading, error, brand, budget, suggestions[], sugLoading, sugError, paletteData, expandedIdx`

**API calls:** `GET /shop/gaps?force=true`, `GET /shop/palette`, `GET /shop/suggest?brand=&budget_cad=`

**Components used:** Inline `CoverageRing` (conic-gradient SVG), `PulsingDots` (loading)

**Key behaviors:**
- Section 0: Color palette strip (top 8 colors + complementary suggestions with dashed borders)
- Section A: Coverage rings — 5 occasions; green(≥2), yellow(=1), red(=0); refresh button forces `?force=true`
- Section B: AI gap cards — stagger in 0.07s/card; priority badge; missing items as pills
- Section C: Shopping suggestions — compatibility bar (width = match_count/4 × 100%); "See X matches" expandable thumbnail carousel

---

## 10. Frontend: Components

### `Navbar.jsx`

**Props:** None. Uses `useLocation()`.
**5 tabs:** Wardrobe (Shirt icon, `/`), Add (Plus, `/add`), Outfits (Layers, `/outfits`), Shop (ShoppingBag, `/shop`), Profile (User, `/profile`)
**Active indicator:** gold horizontal line, spring animation (stiffness 480)
**Bottom padding:** `env(safe-area-inset-bottom)` for notched phones

---

### `ItemCard.jsx`

**Props:** `item: ClothingItem, onClick(item), onWorn(id, count)`
**State:** `timesWorn, marking, wornFlash`
**API:** `POST /items/{id}/worn`

- Times worn badge: gold pill top-left, hidden if 0, scale-bounce on mark
- Color swatches: 3 dots max
- Mark worn button: updates local state, shows success toast ("Marked worn — Nx total")
- Hover: shadow glow + y offset -4px (`whileHover`)

---

### `ItemDetailModal.jsx`

**Props:** `item, onClose(), onDeleted(id), onUpdated(updatedItem)`
**State:** `editing, retagging, deleting, confirmDelete, saving, error, fitResult, fitLoading, form{...}`
**API:** `PUT /items/{id}`, `POST /items/{id}/tag`, `GET /items/{id}/fit-check`, `DELETE /items/{id}`

**Sections (read mode):**
- Photo, color swatches + labels, quick-info chips (fit/size/material/occasions/seasons)
- Garment measurements table (only if `garment_measurements` non-empty)
- Fit check result (AnimatePresence, color-coded)

**Edit form fields:** category (LuxSelect), fit_type (LuxSelect), brand, size_label, colors (comma-sep), occasions/seasons (toggle pills), material, garment measurements (4 number inputs), notes

**Delete:** two-tap confirm (first tap changes button color, second executes)

**Fit check:** "Check Fit" button only shown if `garment_measurements` keys exist

---

### `OutfitCard.jsx`

**Props:** `outfit, onSave(outfit), onRate(id, rating), onDelete(id), isSaved: bool`
**State:** None (parent manages)

- Thumbnail carousel: 20×28px images, lazy load, hover scale 1.04
- Star rating: GSAP bounce on rated stars (0.04s stagger, `back.out`)
- Action: `isSaved=false` → Save button; `isSaved=true` → Delete button

---

### `BarcodeScanner.jsx`

**Props:** `onScan(upc: string), onClose()`
**Uses:** `BrowserMultiFormatReader` from `@zxing/library`

- `decodeFromVideoDevice(null, videoRef, callback)` → continuous scan
- On success: `reader.reset()` → `onScan(result)` → prevents duplicate fires
- Targeting reticle: 70% width, 25% height with gold corner accents
- Error: "camera not available" message (no camera permission)

---

### `PhaseIndicator.jsx`

**Props:** `phase: string`
**Returns null** during `'camera'` and `'barcode'` phases.

4 steps: Photo (idle/camera) → Preview (previewing) → AI Tag (uploading/manual_form) → Done (done)

- Active step: gold filled circle with pulsing scale animation (repeat, 2.4s)
- Done steps: gold tint with checkmark icon
- Connector lines: gold tint if next step reached, else near-invisible

---

### `SplineScene.jsx`

**Props:** `scene: string, style?: object, className?: string`

- `React.lazy()` loads `@splinetool/react-spline` (~500KB code split)
- `Suspense` fallback: null (silent)
- `SplineErrorBoundary` class: catches errors, renders null (no crash)
- Respects `prefers-reduced-motion: reduce` → returns null
- All 3 scenes share the same URL: `https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode`
- Parent: `pointer-events: none` (non-interactive)

---

### `SplashScreen.jsx`

**Props:** `onDone()`

- Auto-dismiss: 2400ms `setTimeout`
- Click anywhere dismisses immediately
- Sets `sessionStorage.setItem(SPLASH_SEEN_KEY, '1')` on dismiss
- Contains `<SplineScene scene={SCENES.splash} />` full-screen

---

### `Toast.jsx` + `useToast()` hook

**Context-based system** — wraps app via `<ToastProvider>`.

**Usage:**
```js
const { toast, dismiss } = useToast()
toast({ message: "Saved!", type: "success", duration: 3000 })
```

**Types:** `success` (green check), `error` (red X), `info` (gold info), `default` (gray)
**Behavior:** max 4 visible, auto-dismiss, progress bar countdown (RAF-based), glassmorphism card

**Used in:** `ItemCard`, `ItemDetailModal`, `OutfitBuilder`, `Profile`

---

### `ErrorBoundary.jsx`

Class component. Catches render errors in subtree. Logs to console.

**Fallback UI** (shown on error):
- AlertTriangle icon (red)
- "Something went wrong" heading + error message (monospace, dimmed)
- "Try Again" button → `setState({ hasError: false })` to attempt recovery

---

### `LuxSelect.jsx`

**Props:** `value, onChange, options: string[], placeholder?: string, required?: bool`
Native `<select>`, dark theme styled, gold focus ring. Best iOS/Android UX.

---

### `TextShimmer.jsx`

**Props:** `as: tag, className, children`
CSS keyframe gold shimmer sweep left-to-right on heading text. Uses `background-clip: text`.

---

### `NoiseOverlay.jsx`

Fixed full-screen, `pointer-events: none`, `z-index: 1` (behind content). SVG/canvas grain texture for visual depth.

---

### `GlassCard.jsx`

**Props:** `children, className?, style?`
Applies `cn('glass-card rounded-2xl overflow-hidden', className)`.
`glass-card` CSS class: `backdrop-filter: blur(12px)`, rgba(22,22,22,0.7) bg, 1px gold-tint border.

---

## 11. Frontend: Utilities & Theme

### `src/lib/utils.js`

```js
cn(...inputs)              // clsx + tailwind-merge: safe class merging
parseJson(str, fallback=[]) // safe JSON.parse; returns fallback on error
```

### `src/lib/scenes.js`

```js
export const SPLASH_SEEN_KEY = 'wardrobe_splash_seen'
export const SCENES = {
  splash:       'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode',
  wardrobeHero: 'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode',
  addItemIdle:  'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode',
}
// All 3 scenes currently use the same URL.
```

### `vite.config.js`

```js
plugins: [react(), tailwindcss()]
resolve.alias: { '@': './src' }
```

### `.env`

```
VITE_API_URL=http://YOUR_BACKEND_HOST:8000
```

### CSS Theme Variables (`index.css`)

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg-primary` | `#0C0C0C` | Main background |
| `--bg-surface` | `#161616` | Cards, panels |
| `--bg-elevated` | `#1E1E1E` | Inputs, modals, dropdowns |
| `--text-primary` | `#F0EDE8` | Main text |
| `--text-muted` | `#6B6560` | Secondary / placeholder |
| `--accent` | `#C8A97E` | Gold — CTAs, active states, focus |
| `--accent-soft` | `rgba(200,169,126,0.10)` | Subtle gold tint bg |
| `--success` | `#4ADE80` | Coverage rings ≥2, success |
| `--warning` | `#FBB846` | Coverage rings =1, medium |
| `--danger` | `#F87171` | Coverage rings =0, high priority |

**Typography:**
- Body: `Inter, SF Pro Text, -apple-system, sans-serif`
- Display: `Cormorant Garamond` (Google Font), letter-spacing 0.2–0.3em

**Keyframes defined in index.css:**
- `shimmer` — skeleton loading sweep
- `text-shimmer` — gold sweep on headings (TextShimmer.jsx)
- `ring-pulse` — pulsing border glow
- `pulsing-dots` — loading indicator dots

---

## 12. Common Patterns & Gotchas

### JSON Field Handling
```python
# DB stores as TEXT string:
item.colors = json.dumps(["navy", "white"])

# Read back:
colors = json.loads(item.colors)  # → ["navy", "white"]
```
All list/dict fields in `ClothingItem` and `UserProfile` are stored as JSON strings.
Routers auto-convert list inputs (`list → json.dumps`) and dict inputs for `PUT /items`.

### Ollama Error Handling
```python
try:
    result = await tag_clothing_image(path)
except httpx.ConnectError:
    result = {}  # Ollama not running

if not result:
    # Return item with empty tags → frontend shows manual form
    return {"item": item, "ai_tagged": False}
```
**Never crash on Ollama failure.** Always graceful degradation.

### `preserve_existing=True` Pattern
Used in re-tagging: AI result **never overwrites** a field that already has a non-empty
value. Safe to call re-tag on manually-edited items.
```python
def _apply_tags(item, tags, *, preserve_existing=False):
    item.category = tags.get("category", item.category if preserve_existing else "other")
    # ... same for all fields
```

### `<think>` Tag Stripping (qwen3.5:2b)
The model outputs `<think>...</think>` blocks before its answer. Always use:
```python
raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
```
Done inside `parse_ai_json()` — all AI service functions call this automatically.

### CSS Variable Rule
**Never hard-code hex values in components.** Always use CSS variables:
```jsx
// ✓ correct
style={{ color: 'var(--accent)' }}
className="text-[var(--text-primary)]"

// ✗ wrong
style={{ color: '#C8A97E' }}
```

### `cn()` Rule
Always use `cn()` for conditional class merging (prevents Tailwind conflicts):
```js
import { cn } from '@/lib/utils'
className={cn('base-classes', condition && 'conditional-class', className)}
```

### API URL Rule
All frontend API calls must use:
```js
const API = import.meta.env.VITE_API_URL
axios.get(`${API}/items`)
```

### Occasion/Season Filter (SQL LIKE)
Filters search JSON array strings:
```python
session.exec(select(ClothingItem).where(col(ClothingItem.occasions).like(f'%"{occasion}"%')))
```

---

## 13. Codebase Drift

> **These files exist in actual code but are NOT listed in `CLAUDE.md`.**
> CLAUDE.md reflects v1.0 but the codebase has grown beyond it.

| File | What it does | Added when |
|------|-------------|-----------|
| `backend/services/product_lookup_service.py` | 4-source barcode lookup chain; replaced the original simple UPCItemDB call in barcode_service.py | Phase 4+ improvements |
| `backend/services/color_service.py` | Color grouping, palette analysis, Pillow-based dominant color extraction | Iteration (PR #13) |
| `backend/services/compatibility_service.py` | Wardrobe compatibility scoring for shopping suggestions | Iteration (PR #13) |
| `backend/services/fit_service.py` | Garment vs body measurement fit verification | Iteration (PR #13) |
| `backend/routers/shop.py` → `GET /shop/palette` | Color palette endpoint (not in CLAUDE.md endpoint list) | Iteration |
| `backend/routers/items.py` → `POST /items/scan-label` | Label OCR endpoint (not in CLAUDE.md) | Iteration |
| `backend/routers/items.py` → `GET /items/{id}/fit-check` | Fit check endpoint (not in CLAUDE.md) | Iteration |
| `backend/routers/outfits.py` → `GET /outfits/history` | Outfit wear history (not in CLAUDE.md) | Iteration |
| `backend/routers/outfits.py` → `POST /outfits/{id}/worn` | Mark outfit worn (not in CLAUDE.md) | Iteration |
| `frontend/src/components/PhaseIndicator.jsx` | AddItem 4-step progress bar (not in CLAUDE.md) | PR #14 |
| `frontend/src/components/Toast.jsx` | Toast system + useToast hook (not in CLAUDE.md) | PR #14 |

> `ClothingItem` also has 2 extra fields vs CLAUDE.md: `garment_measurements` and `material`
> `SavedOutfit` has 3 extra fields: `worn_date`, `times_worn`, `name`

---

## 14. Backlog / Not Implemented

These items are mentioned in documentation but **have no code path yet:**

| Feature | Status |
|---------|--------|
| Gemini 2.5 Flash-Lite fallback | Mentioned in CLAUDE.md config but zero code exists; `ai_service.py` only uses Ollama |
| Color palette gap detection | Mentioned in PRD Phase 3 backlog |
| Versatility score per shopping suggestion ("this chino matches 7 of your tops") | Mentioned in PRD backlog; compatibility score exists but "matches N items" UX is not the same |
| Dedicated outfit history view (standalone page) | Current history is a tab inside OutfitBuilder, not a standalone page |

> Do **not** reference Gemini API, Google API keys, or cloud AI in code changes unless
> Vipin explicitly asks to implement the fallback.
