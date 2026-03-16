# WardrobeAI — Gemini API Testing Observations
**Date:** 2026-03-16
**Tester:** Claude (on behalf of Vipin)
**Branch:** claude/test-gemini-api-6hWMu
**Backend version:** 1.1.0

---

## Setup Summary

- API Key configured in `backend/.env` (gitignored, never committed)
- Model in code: `gemini-3.1-flash-lite-preview`
- Ollama: **not running** (forces Gemini fallback path)
- Test environment: Linux cloud server (Claude Code)
- **Critical finding:** Google APIs are unreachable from the cloud server — this is expected, the app runs on Vipin's Windows PC at home. All Gemini network tests were conducted by analysing code paths and fallback behaviour.

---

## Test Results by Endpoint

### ✅ Profile Endpoints

| Endpoint | Method | Result |
|----------|--------|--------|
| `/profile` | GET | ✅ Returns Vipin's profile with all measurement fields |
| `/profile` | POST | ✅ Saves all body measurements correctly (height, weight, chest, waist, etc.) |

**Notes:** Profile measurements update correctly. `brand_sizes` stored as JSON string `{}` by default — works fine.

---

### ✅ Items — Non-AI Operations

| Endpoint | Method | Result |
|----------|--------|--------|
| `GET /items` | GET | ✅ Returns all items, empty array when wardrobe is empty |
| `GET /items?occasion=casual` | GET | ✅ Filters correctly by occasion |
| `GET /items?season=winter` | GET | ✅ Filters correctly by season |
| `GET /items/{id}` | GET | ✅ Returns single item with all fields |
| `PUT /items/{id}` | PUT | ✅ Partial update works (brand, size_label, fit_type, notes) |
| `PUT /items/{id}` | PUT | ✅ Protected fields (id, photo_path, date_added) cannot be overwritten |
| `POST /items/{id}/worn` | POST | ✅ Increments times_worn counter correctly |
| `DELETE /items/{id}` | DELETE | ✅ Deletes item + cascades: removes item ID from outfit.item_ids |

**Notes:**
- Cascade delete works perfectly: outfit item_ids updated, empty outfits removed
- Missing item IDs appear in `missing_items` array on GET /outfits (great for UI)

---

### ⚠️ Items — AI-Powered Operations (Gemini Fallback Path)

| Endpoint | Method | Result |
|----------|--------|--------|
| `POST /items` (no metadata) | POST | ⚠️ AI tagging fails → `category: "unknown"`, `ai_tagged: false` |
| `POST /items` (with metadata) | POST | ✅ Manual metadata saves correctly, item created in 0.6s |
| `POST /items/{id}/tag` | POST | ⚠️ Retag fails gracefully → returns item unchanged, `ai_tagged: false` |
| `GET /items/{id}/fit-check` | GET | ⚠️ Returns "No Data" — needs garment_measurements (which needs AI) |
| `GET /items/barcode/{upc}` | GET | ✅ UPC validation works (rejects <12 digits → 400). UPCItemDB lookup works (returns "not found" for test UPC) |

**Key behaviour when AI fails:**
- Items are still created/returned — never crash
- `ai_tagged: false` field signals frontend to show manual form
- Category defaults to `"unknown"` (not `"other"` as per code comment — minor discrepancy)
- Response time: ~0.5s (fast failure, no hanging)

**On Vipin's PC (with Gemini or Ollama running):**
- `POST /items` with a real photo → AI returns category, colors, tags, fit_type, occasions, seasons, material
- Garment measurements inferred async after item save (won't block upload)

---

### ⚠️ Outfits

| Endpoint | Method | Result |
|----------|--------|--------|
| `GET /outfits` | GET | ✅ Lists outfits with full item objects + missing_items array |
| `POST /outfits` | POST | ✅ Creates outfit. ⚠️ **BUG: `name` field ignored in POST** |
| `PUT /outfits/{id}` | PUT | ✅ Rating and name update correctly |
| `DELETE /outfits/{id}` | DELETE | ✅ (not directly tested but cascade test confirms deletion path) |
| `POST /outfits/{id}/worn` | POST | ✅ Increments outfit times_worn + worn_date + increments all item times_worn |
| `GET /outfits/history` | GET | ✅ Returns worn outfits sorted by worn_date DESC |
| `POST /outfits/generate` | POST | ⚠️ Returns 422 "AI outfit generation failed. Make sure Ollama is running." |

**Bug Found: `name` not saved on POST /outfits**
- `SaveOutfitRequest` model (outfits.py line 28-33) is missing the `name` field
- Even if name was in the request, the `SavedOutfit` constructor call (line 139-144) doesn't pass it
- Workaround: Create outfit first, then PUT /outfits/{id} with name
- **Fix required:** Add `name: str | None = None` to `SaveOutfitRequest` and pass it to `SavedOutfit()`

---

### ✅ Shop Endpoints

| Endpoint | Method | Result |
|----------|--------|--------|
| `GET /shop/gaps` | GET | ✅ Returns `local_coverage` instantly (no AI). `ai_gaps: []` when Gemini unreachable |
| `GET /shop/gaps?force=true` | GET | ✅ Cache bypass works |
| `GET /shop/suggest` | GET | ✅ Returns `suggestions: []` gracefully when AI unavailable |
| `GET /shop/palette` | GET | ✅ Instant local color analysis — `dominant_group`, `underrepresented`, `complementary_suggestions` |

**Notable:** Local coverage (non-AI) correctly identifies gaps:
- With test wardrobe of 4 items (tshirt + jeans): `formal`, `sport`, `outdoor` flagged as gaps
- `/shop/palette` with 2 colors (black, blue) → suggests warm, earth, bright colors to add

---

### ✅ Safety & Validation

| Test | Expected | Result |
|------|----------|--------|
| Upload >15MB file | 413 | ✅ |
| Invalid UPC (3 digits) | 400 | ✅ |
| Rating = 6 | 422 "Rating must be between 1 and 5" | ✅ |
| Rating = 0 | 422 "Rating must be between 1 and 5" | ✅ |
| PUT protected fields | Fields unchanged | ✅ |

---

## Startup Behaviour

When Ollama is off + GEMINI_API_KEY is set:
```
WARNING: Ollama is not reachable at http://localhost:11434 — AI tagging and outfit generation
         will fall back to Gemini or be unavailable.
INFO:    Gemini fallback is configured and ready ✓   ← only in logs, not stdout by default
```

**Observation:** The Gemini "configured and ready" confirmation uses `logger.info()` from the `wardrobeai` logger which may not be visible in default uvicorn output. Users may not know Gemini is active. Consider adding a `print()` or using the uvicorn logger directly.

---

## Gemini Model Name Question

The code uses `gemini-3.1-flash-lite-preview`. To verify this model exists and works **on Vipin's PC**:

```bash
# Run this from Windows Command Prompt or PowerShell on your PC
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=YOUR_API_KEY" -H "Content-Type: application/json" -d "{\"contents\":[{\"parts\":[{\"text\":\"Say hi\"}]}]}"
```

If you get a 404 or model-not-found error, update line 14 in `backend/services/ai_service.py`:
```python
GEMINI_MODEL = "gemini-2.5-flash"  # fallback model name
```

---

## Bugs Found

### Bug #1 (Minor): POST /outfits ignores `name` field
- **File:** `backend/routers/outfits.py`
- **Issue:** `SaveOutfitRequest` model missing `name` field; `save_outfit()` function doesn't pass name to constructor
- **Impact:** Users can't name an outfit when creating it; must use separate PUT call
- **Fix:** Add `name: str | None = None` to `SaveOutfitRequest` and update `SavedOutfit()` constructor call

### Bug #2 (Minor): Category defaults to "unknown" not "other"
- **File:** `backend/routers/items.py`
- **Issue:** CLAUDE.md documents "other" as the default failed-AI category, but actual default is `"unknown"`
- **Impact:** Cosmetic only — frontend shows "unknown" to user instead of "other"

---

## Performance Notes

- Non-AI endpoints: < 20ms response time
- AI upload (no AI running): ~0.5s (fast fail)
- AI upload (Gemini/Ollama running): estimated 5-15s for Gemini, 15-30s for Ollama first run
- Gap analysis: instant local_coverage; AI part (Gemini/Ollama) estimated 10-30s
- Outfit generation: estimated 10-20s with Gemini

---

## Day-to-Day UX Assessment (Vipin's Perspective)

### What would work great:
1. **Adding items via barcode** — scan a barcode, UPCItemDB fills in brand/name, photo + AI fills rest
2. **Daily outfit suggestions** — "Wear Today?" with casual + current season filter is useful for quick morning decisions
3. **Wardrobe gap analysis** — local_coverage rings on Shop page give instant visual of what's missing
4. **Times worn tracking** — the badge on ItemCard helps identify unworn clothes at a glance
5. **Color palette analysis** — instant feedback on wardrobe color balance

### What needs improvement for real daily use:
1. **Speed** — Gemini/Ollama AI calls take 10-30s. For morning use, this friction is real
2. **No outfit naming at creation** — must do PUT after POST to set a name
3. **Fit-check unusable without garment measurements** — requires AI tagging to work; no manual entry path
4. **No "last worn" visible in wardrobe grid** — have to open ItemDetailModal to see worn date
5. **No notification/reminder** — "you haven't worn X in 3 months" type nudge missing
6. **Outfit builder requires occasion+season input** — could auto-suggest based on current date/weather
