# WardrobeAI — Handoff Document
**Last updated:** 2026-03-16
**Version:** 1.1.0
**Branch with Gemini testing:** `claude/test-gemini-api-6hWMu`

---

## How to Resume in a New Session

Start a new Claude Code session and say:
> "Read handoff.md and continue from where we left off."

Claude will read this file and have full context to continue without re-exploring the codebase.

---

## Current State

The app is **fully functional** for local use on Vipin's Windows PC. All core features work. The Gemini fallback AI is implemented and just needs the API key configured.

### What Works ✅
- Full CRUD for clothing items (upload, edit, delete, view)
- AI tagging via Ollama (primary) or Gemini (fallback) — requires at least one to be running
- Outfit builder: manual + AI-generated outfits, saved/history tabs, star ratings
- Worn tracking: per-item and per-outfit counters with dates
- Shopping page: local coverage analysis (instant), gap analysis (AI), color palette (instant)
- Barcode scanning via phone camera (@zxing/library)
- PWA manifest for "Add to Home Screen" on phone
- Dark luxury theme, mobile-first layout, GSAP animations, Spline 3D scenes

### Gemini API Status
- Implementation: **Complete** — no code changes needed
- Activation: Set `GEMINI_API_KEY` in `backend/.env` (file exists, gitignored)
- Model: `gemini-3.1-flash-lite-preview` (verify this works on your PC — see observation.md)
- Fallback chain: Ollama → Gemini → empty dict (graceful)
- **Verify on Vipin's PC:** Run the curl test in observation.md to confirm model name is valid

---

## Bugs to Fix (Priority Order)

### P1 — Bug: POST /outfits ignores `name` field
**File:** `backend/routers/outfits.py`
**Lines to change:**
1. Add `name: str | None = None` to `SaveOutfitRequest` (line 28-33):
   ```python
   class SaveOutfitRequest(BaseModel):
       item_ids: list[int]
       occasion: str | None = None
       season: str | None = None
       rating: int | None = None
       name: str | None = None   # ADD THIS
   ```
2. Pass name to constructor in `save_outfit()` (line 139-144):
   ```python
   outfit = SavedOutfit(
       item_ids=json.dumps(req.item_ids),
       occasion=req.occasion,
       season=req.season,
       rating=req.rating,
       name=req.name,   # ADD THIS
   )
   ```

### P2 — Minor: "unknown" vs "other" as default AI fail category
**File:** `backend/routers/items.py` — where category defaults when AI returns nothing
**Impact:** Cosmetic only. No functional issue.

---

## Recommended Enhancements (Ranked by User Value)

These are features that would make a real difference for day-to-day use as a wardrobe manager:

### 1. 🔥 Quick Add Flow — Outfit from Today's Wear
**What:** One-tap "Log what I'm wearing today" — select items, auto-saves as outfit + marks all as worn
**Why:** Current flow requires: generate outfit → save → mark worn. Too many steps for daily logging
**Effort:** Medium (new frontend flow, 1-2 new endpoints or reuse existing)

### 2. 🔥 "Last Worn" visible in Wardrobe Grid
**What:** Show "X days ago" or worn date badge directly on ItemCard
**Why:** Currently have to open ItemDetailModal to see. Main utility is knowing what you haven't worn
**Effort:** Small (add to ItemCard.jsx, data already available via `times_worn` + we'd need to add `last_worn_date` to ClothingItem model)
**Note:** `times_worn` is tracked per item, but `last_worn_date` isn't stored on ClothingItem — only on SavedOutfit

### 3. 🔥 Gemini Startup Confirmation Visible in Logs
**What:** Make the "Gemini fallback configured ✓" message visible (currently uses `logger.info` which may not show)
**Why:** Vipin needs to know Gemini is active when Ollama is off
**Effort:** Tiny — change `logger.info` to `print()` or `logger.warning()` in `main.py:51`

### 4. 💡 Garment Measurements Manual Entry
**What:** Allow manual entry of chest_width_cm, body_length_cm, etc. in ItemDetailModal
**Why:** Fit-check (GET /items/{id}/fit-check) is useless without measurements; AI often can't infer from image
**Effort:** Medium (new form fields in ItemDetailModal + PUT /items/{id} already accepts garment_measurements)

### 5. 💡 Smart Outfit Suggestion (Weather/Season Auto-Detect)
**What:** "What should I wear today?" auto-detects current season and picks casual occasion by default
**Why:** Currently requires user to pick occasion + season in outfit builder — adds friction for daily use
**Effort:** Small (add a "Today" button in OutfitBuilder that prefills casual + current season)

### 6. 💡 Item Search / Text Filter in Wardrobe
**What:** Search bar in Wardrobe.jsx to filter items by brand, tag, color, or notes
**Why:** As wardrobe grows (20+ items), scrolling is the only navigation — slow
**Effort:** Small (frontend only, no backend changes — filter `items` array by text match)

### 7. 💡 "Outfit of the Week" Suggestions
**What:** AI-generated 5-day outfit plan for a given week (work Mon-Fri, casual Sat-Sun)
**Why:** One weekly planning session instead of daily decisions
**Effort:** Medium (new endpoint + new AI prompt + new frontend tab/page)

### 8. 💡 Worn Frequency Insights
**What:** "You haven't worn [item] in 30+ days" notification/badge on rarely-worn items
**Why:** Helps identify wardrobe clutter — things taking up space that aren't worn
**Effort:** Small-Medium (needs `last_worn_date` on ClothingItem, then frontend badge logic)

### 9. 💡 Category Icons in Grid
**What:** Small category icon overlay on ItemCard (shirt icon, shoe icon, etc.)
**Why:** At a glance, the 2-col grid makes it hard to distinguish item types without opening each
**Effort:** Small (use @iconify/react which is already installed)

### 10. 🔧 Outfit Generation Error Message Improvement
**What:** When AI fails, show "Enable Ollama or set Gemini API key" instead of "Make sure Ollama is running"
**Why:** The current error message ignores that Gemini is a valid alternative
**File:** `backend/routers/outfits.py` line ~82 (the HTTPException detail string)
**Effort:** Trivial (one-line change)

---

## Architecture Notes for Next Session

### File Structure Quick Reference
```
backend/services/ai_service.py    ← Ollama + Gemini fallback (fully implemented)
backend/routers/outfits.py        ← Bug: POST /outfits missing name field (lines 28-33, 139-144)
backend/routers/items.py          ← Item CRUD, AI tagging, worn tracking
backend/routers/shop.py           ← Gap analysis + color palette (300s cache)
frontend/src/pages/OutfitBuilder.jsx  ← Generate + Saved tabs + Wear Today
frontend/src/components/ItemCard.jsx  ← Grid card (add last_worn_date here for item #2 above)
frontend/src/components/ItemDetailModal.jsx  ← Edit/retag/delete modal
```

### Data Flow: Adding a New Item
1. User takes photo → `POST /items` with photo file
2. Backend saves image to `data/images/{id}_{uuid}.jpg`
3. `tag_clothing_image()` called: Ollama → Gemini → {} (manual form)
4. After item saved: `infer_garment_measurements()` called async (doesn't block)
5. Frontend shows item in grid. If `ai_tagged: false` → manual form shown

### API Key Management
- **Never commit** `backend/.env` — it's gitignored
- The env var is: `GEMINI_API_KEY=AIzaSyCZuo7k3iQUMRhbUZag5aURrmbOyxiZLjc`
- On Vipin's PC: Either set in `backend/.env` OR export in the terminal before starting uvicorn

### Running the Stack (Vipin's PC)
```bash
# Terminal 1: Ollama (optional — Gemini is fallback)
ollama serve

# Terminal 2: Backend
cd wardrobeai/backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# Expected: "Ollama is running ✓" and/or "Gemini fallback configured ✓"

# Terminal 3: Frontend
cd wardrobeai/frontend
npm run dev -- --host 0.0.0.0
# Open on phone: http://{PC_LAN_IP}:5173
```

---

## Testing Guide for Vipin (On Your PC)

### Verify Gemini Works Without Ollama:
1. Stop Ollama if running
2. Start backend (with GEMINI_API_KEY in .env or environment)
3. Take a photo of a shirt and upload it via the app
4. Expected: AI tags appear within 5-15 seconds
5. If manual form shows instead → Gemini call failed (check model name per observation.md)

### Quick Smoke Test (all features):
1. Add 3-4 items with different categories (tshirt, jeans, jacket)
2. Generate outfits for "casual" + "fall"
3. Rate one outfit 4 stars → star should persist
4. Open Shop tab → coverage rings should show gaps
5. Scan a barcode from a clothing tag → should pre-fill the add form
6. Mark an outfit as worn → times_worn should increment on both outfit and its items
7. Delete an item → that item should disappear from any outfits it was in

---

## Session History

| Date | What Was Done |
|------|--------------|
| 2026-03-15 | Phase 5 complete: 62 baseline + 139 adversarial tests passing |
| 2026-03-16 | Gemini API integration tested; observation.md + handoff.md created; Bug #1 (name in POST /outfits) found |
