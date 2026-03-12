# WardrobeAI — GitHub Issues Tracker

> This file documents issues found in the codebase audit.
> Copy each block into GitHub Issues (phone app or web) — title, label, and body are ready to paste.
> **Workflow:** Issue → PR (branch `claude/...`) → Merge → Issue auto-closes.

---

## Bugs

---

### [B1] Unused `COLOR_MAP` import in ItemCard.jsx
**Label:** `bug`

`ItemCard.jsx` line 6 imports both `getColorCSS` and `COLOR_MAP` from `../lib/colors`,
but `COLOR_MAP` is never used anywhere in the component. Only `getColorCSS()` is called.

**File:** `frontend/src/components/ItemCard.jsx:6`

```js
// Current:
import { getColorCSS, COLOR_MAP } from '../lib/colors'
// Fix:
import { getColorCSS } from '../lib/colors'
```

**Impact:** Low — dead import left over from the simplification pass.

---

### [B2] `isPhotoValid()` not used in OutfitBuilder.jsx — broken image risk
**Label:** `bug`

`OutfitBuilder.jsx` line 439 checks `item.photo_path ?` (truthy check only).
If `photo_path === 'tmp'` (placeholder during upload), this renders a broken `<img>` tag.
`ItemCard.jsx` correctly uses `isPhotoValid(item)` from `lib/constants.js` — OutfitBuilder should too.

**File:** `frontend/src/pages/OutfitBuilder.jsx:439`

```js
// Current:
{item.photo_path ? (
// Fix:
{isPhotoValid(item) ? (
```

Also requires adding `isPhotoValid` to the import from `../lib/constants`.

---

### [B3] `isPhotoValid()` not used in Shop.jsx — broken image risk
**Label:** `bug`

Same issue as B2 but in `Shop.jsx` line 431. The suggestion card item thumbnails
check `mi.photo_path ?` instead of `isPhotoValid(mi)`.

**File:** `frontend/src/pages/Shop.jsx:431`

```js
// Current:
{mi.photo_path ? (
// Fix:
{isPhotoValid(mi) ? (
```

Also requires adding `isPhotoValid` to the import from `../lib/constants`.

---

### [B4] Gap analysis cache not invalidated when item is updated (PUT /items/{id})
**Label:** `bug`

`backend/routers/items.py` calls `invalidate_gaps_cache()` after DELETE (line 273),
but NOT after PUT (update_item, line 257). If user edits an item's occasions/seasons,
the gap analysis stays stale for up to 30 seconds.

**File:** `backend/routers/items.py:257`

```python
# After session.commit() in update_item, before return:
invalidate_gaps_cache()
return item
```

---

### [B5] Duplicate error feedback in ItemDetailModal on save failure
**Label:** `bug`

`ItemDetailModal.jsx` lines 72-73: on save failure, both `setError(...)` (shows inline
in the form) AND `toast(...)` are called. User sees two error messages simultaneously.
Same pattern on retag failure at lines 100-101.

**File:** `frontend/src/components/ItemDetailModal.jsx:72-73`, `100-101`

Fix: remove `setError(...)` on failures where a toast is already shown.
The inline `error` state should only be used for field-level validation, not catch blocks.

---

## Enhancements

---

### [E1] File size + MIME type validation on image upload endpoint
**Label:** `enhancement`

`POST /items` (backend/routers/items.py ~line 72) reads the full uploaded file into
memory with no size limit and no MIME type check before passing to `PIL.Image.open()`.
On a local network with a single user this is low risk, but good hygiene.

**Proposed fix:**
- Reject files > 20MB with HTTP 413
- Check `photo.content_type.startswith("image/")` before saving
- Add `MAX_UPLOAD_BYTES = 20 * 1024 * 1024` constant

---

### [E2] Gemini 2.5 Flash-Lite fallback when Ollama is offline
**Label:** `enhancement`

`ai_service.py` has a comment stub for Gemini fallback but no implementation.
When Ollama is not running (e.g. PC just booted), tagging always fails with
`httpx.ConnectError` and the user must use the manual form.

**Proposed implementation:**
- Catch `httpx.ConnectError` in `tag_clothing_image()`
- If Ollama unreachable, call Gemini 2.5 Flash-Lite API with same prompt
- `GEMINI_API_KEY` from `.env` (free tier, no cost)
- Applies to: tagging, outfit generation, gap analysis

---

### [E3] Versatility score on shopping suggestions
**Label:** `enhancement`

Shopping suggestions in `/shop/suggest` recommend items but don't say how many
existing wardrobe pieces the new item would work with.

**Proposed output addition:**
```json
{
  "suggestion": "slim chinos in tan",
  "versatility_score": 7,
  "matches_with": ["navy tshirt", "white shirt", "black polo"]
}
```

This helps prioritize purchases with the highest wardrobe ROI.

---

## Documentation

---

### [D1] CLAUDE.md backlog section is stale — history tab and palette are implemented
**Label:** `documentation`

CLAUDE.md Backlog lists these as "not yet implemented":
- "Dedicated outfit history view" — ✅ **IS implemented** (`OutfitBuilder.jsx` History tab, `/outfits/history` endpoint)
- "Color palette gap detection" — ✅ **IS implemented** (`Shop.jsx` palette rings, `/shop/palette` endpoint)

These should be moved to the "Phase 4 — Polish ✅" section.

---

## Version Reference

| Tag | Commit | Description |
|-----|--------|-------------|
| `v1.0.0` | `03bc80c` | All 4 phases complete, simplification pass done |

To restore to v1.0.0:
```bash
git checkout v1.0.0          # detached HEAD at that state
git checkout claude/document-skills-MjmVA  # return to latest
```

---

## Workflow

```
Find issue → Add to this file + GitHub Issues → Fix in PR (claude/...) → You merge → Issue closes
```

Labels in use: `bug` · `enhancement` · `documentation` · `duplicate` · `wontfix`
