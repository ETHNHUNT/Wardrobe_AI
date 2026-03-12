# WardrobeAI

A personal, locally-hosted AI wardrobe manager. Runs on a Windows PC; phone connects over the same WiFi LAN. No cloud. No subscription. Single user.

---

## Architecture

```
Phone (browser) ──── WiFi ────► Vite dev server  0.0.0.0:5173
                                     │
                                     │ Axios  (VITE_API_URL)
                                     ▼
                               FastAPI  0.0.0.0:8000
                             ┌─────────────────────────┐
                             │  SQLite  wardrobe.db     │
                             │  Ollama  localhost:11434  │
                             │  /images  StaticFiles    │
                             └─────────────────────────┘
```

---

## Hardware

- **PC**: Dell Inspiron 7567 — GTX 1050Ti (4 GB VRAM), 16 GB RAM, Windows
- **AI model**: Ollama `qwen3.5:2b` (2.7 GB) — runs entirely on GPU
- **Phone**: Any browser on same WiFi LAN

---

## Quick Start

```bash
# 1. Pull the AI model (one-time, ~2.7 GB)
ollama pull qwen3.5:2b

# 2. Start backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 3. Start frontend
cd frontend
npm install
npm run dev -- --host 0.0.0.0

# 4. Set your LAN IP in frontend/.env
#    Run `ipconfig` in Command Prompt → find IPv4 under Wi-Fi adapter
echo "VITE_API_URL=http://192.168.1.XXX:8000" > frontend/.env
```

Open `http://192.168.1.XXX:5173` on your phone.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.10+ / FastAPI |
| Frontend | React 19 + Vite 7 + Tailwind CSS |
| Database | SQLite via SQLModel |
| AI (primary) | Ollama `qwen3.5:2b` — local, vision-capable |
| Image storage | Local filesystem `backend/data/images/` |
| Barcode lookup | UPCItemDB free API |
| Barcode scanning | `@zxing/library` (phone camera) |
| Animations | Framer Motion + GSAP |
| 3D scenes | Spline (`@splinetool/react-spline`) |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET/POST | `/profile` | Body measurements + brand sizes |
| GET | `/items` | List items (`?category=&occasion=&season=`) |
| POST | `/items` | Upload photo + AI tag |
| GET | `/items/{id}` | Single item |
| PUT | `/items/{id}` | Edit item fields |
| DELETE | `/items/{id}` | Delete item + photo from disk |
| POST | `/items/{id}/worn` | Increment times_worn counter |
| POST | `/items/{id}/tag` | Re-run AI tagging |
| GET | `/items/barcode/{upc}` | UPC lookup → pre-fill data |
| GET | `/outfits` | Saved outfits (`?occasion=&season=`) |
| POST | `/outfits/generate` | AI outfit suggestions |
| POST | `/outfits` | Save an outfit |
| PUT | `/outfits/{id}` | Update rating / name |
| DELETE | `/outfits/{id}` | Delete outfit |
| POST | `/outfits/{id}/worn` | Mark outfit worn + increment item counts |
| GET | `/outfits/history` | Outfits that have been worn |
| GET | `/shop/gaps` | AI gap analysis (`?force=true` to bypass cache) |
| GET | `/shop/suggest` | Shopping suggestions (`?brand=&budget_cad=`) |
| GET | `/shop/palette` | Wardrobe color palette analysis |

---

## Data Models

**UserProfile** — single row, always id=1

| Field | Type | Notes |
|---|---|---|
| name | str | Default: "Vipin" |
| height_cm … neck_cm | float | Body measurements |
| brand_sizes | str (JSON) | `{"Zara": "M", "H&M": "L"}` |

**ClothingItem**

| Field | Type | Notes |
|---|---|---|
| photo_path | str | Filename in `data/images/` |
| category | str | tshirt, jeans, jacket, etc. |
| colors | str (JSON) | `["navy", "white"]` |
| tags | str (JSON) | `["slim-fit", "cotton"]` |
| brand, size_label, fit_type | str/null | |
| occasions, seasons | str (JSON) | Arrays of strings |
| times_worn | int | Incremented by `/worn` endpoint |
| material | str/null | e.g. "100% cotton" |
| garment_measurements | str (JSON) | Flat garment dimensions in cm |

**SavedOutfit**

| Field | Type | Notes |
|---|---|---|
| item_ids | str (JSON) | `[1, 3, 7]` |
| occasion, season | str/null | |
| rating | int/null | 1–5 stars |
| times_worn | int | |
| worn_date | str/null | ISO timestamp |
| name | str/null | Optional outfit name |

---

## Folder Structure

```
wardrobeai/
├── backend/
│   ├── main.py               FastAPI app, CORS, static files
│   ├── database.py           SQLite engine + session
│   ├── models/               SQLModel table definitions
│   ├── routers/              Route handlers (profile, items, outfits, shop)
│   ├── services/             AI, barcode, shopping, color, fit logic
│   └── data/images/          Stored clothing photos
└── frontend/
    ├── src/
    │   ├── pages/            Wardrobe, AddItem, OutfitBuilder, Shop, Profile
    │   ├── components/       ItemCard, ItemDetailModal, Navbar, Toast, etc.
    │   └── lib/              utils.js, scenes.js, colors.js, constants.js
    └── public/manifest.json  PWA manifest (Add to Home Screen)
```

---

## Notes

- Start Ollama and backend **before** the frontend
- First AI inference takes 15–30 s while the model loads into VRAM
- If AI tagging fails, a manual tag form appears automatically — no crash
- The `<think>…</think>` blocks in qwen3.5:2b responses are stripped before parsing
- Gap analysis (`/shop/gaps`) has a 30-second in-memory cache; pass `?force=true` to bypass
