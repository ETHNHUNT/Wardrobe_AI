# WardrobeAI — Project Handoff Document

**Date:** 2026-03-13
**Version:** 1.0.0
**Status:** All 4 build phases complete and running.

---

## What Was Delivered in This PR

This PR sets up the issue-tracking infrastructure and versioning baseline for WardrobeAI v1.0.

| Deliverable | File(s) |
|---|---|
| GitHub issue templates | `.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, `config.yml` |
| PR template | `.github/pull_request_template.md` |
| Semantic version | `VERSION` (1.0.0) |
| Changelog | `CHANGELOG.md` |
| Bootstrap script | `scripts/setup_github.py` |
| Updated rules | `CLAUDE.md` (Issue Tracking & Versioning section appended) |
| Version bump | `frontend/package.json` → `1.0.0` |

---

## How to Seed GitHub Labels + Issues

> Run once after merging this PR.  Needs a GitHub Personal Access Token with
> **Issues write** and **Labels write** permissions (classic token: `repo` scope).

```bash
# 1. Install the only dependency
pip install requests

# 2. Export your token
export GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# 3. Run
python scripts/setup_github.py
```

The script will create 6 labels and file 12 backlog issues, skipping any that
already exist.  It is safe to re-run.

---

## Backlog Issues to Be Filed (12 total)

Run `scripts/setup_github.py` to file all of these automatically.
They are listed below for reference.

### Critical (2)

| # | Title | Labels |
|---|---|---|
| — | Outfit Builder crashes when wardrobe is empty | `bug` |
| — | ItemDetailModal edit form loses changes on accidental backdrop tap | `bug` |

### High (4)

| # | Title | Labels |
|---|---|---|
| — | /shop/gaps 30 s cache not invalidated after new item is added | `bug`, `performance` |
| — | Barcode scanner leaves camera stream open after navigation | `bug` |
| — | Implement Gemini 2.5 Flash-Lite fallback when Ollama is unavailable | `enhancement` |
| — | AI tagging blocks the upload response for 15–30 s | `performance`, `enhancement` |

### Medium (4)

| # | Title | Labels |
|---|---|---|
| — | OLLAMA_URL and MODEL are hardcoded strings in ai_service.py | `technical-debt` |
| — | Add outfit history / recently worn view | `enhancement` |
| — | PUT /items/{id} does not validate JSON array fields | `security`, `bug` |
| — | Versatility score per shopping suggestion | `enhancement` |

### Low (2)

| # | Title | Labels |
|---|---|---|
| — | Duplicate cn() helper defined in multiple component files | `technical-debt` |
| — | Color palette gap detection in wardrobe analysis | `enhancement` |

> **Note:** Issue numbers shown as "—" because they are filed by the setup script
> after this PR is merged.  Update this table with real numbers once filed.

---

## Labels to Be Created

| Label | Colour | Purpose |
|---|---|---|
| `bug` | `#d73a4a` | Default — something isn't working |
| `enhancement` | `#a2eeef` | Default — new feature or improvement |
| `documentation` | `#0075ca` | Default — docs improvements |
| `performance` | `#0075ca` | Slow responses, caching, query optimisation |
| `technical-debt` | `#7c3aed` | Hardcoded values, missing config, duplication |
| `security` | `#e11d48` | Input validation, auth, injection risks |

---

## Current State of the App

- **Backend** — FastAPI + SQLite, all endpoints live (`/items`, `/outfits`, `/shop`, `/profile`).
- **Frontend** — React 19 + Vite + Tailwind, dark luxury theme, fully mobile-optimised.
- **AI** — Ollama `qwen3.5:2b` (local, 2.7 GB).  Gemini fallback in backlog.
- **Camera / Barcode** — `@zxing/library` on phone browser.
- **3D** — Spline scenes on splash, wardrobe hero, AddItem idle.
- **PWA** — manifest installed; can be added to iOS/Android home screen.

### Known Issues (not yet tracked in GitHub)

See backlog table above.  The two critical bugs are the highest priority.

---

## Next Steps for Vipin

1. **Merge this PR** on GitHub.
2. **Run** `GH_TOKEN=<token> python scripts/setup_github.py` to seed labels + issues.
3. **Tackle critical bugs** first:
   - Empty-wardrobe crash in Outfit Builder (`OutfitBuilder.jsx`)
   - Unsaved-change loss in `ItemDetailModal.jsx`
4. **Implement Gemini fallback** (high priority) so the app works when Ollama is off.
5. **Async tagging** (high priority) — move Ollama call out of the upload request path.

---

## Development Workflow Going Forward

```
# Start Ollama
ollama serve

# Backend
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend && npm run dev -- --host 0.0.0.0

# Phone
# Visit http://<LAN_IP>:5173 in mobile browser
```

- Branch naming: `feature/<short-description>` or use Claude's `claude/<name>-<session-id>` pattern.
- Always update `projectstructure.md` in the same commit as structural changes.
- Bump `VERSION` + update `CHANGELOG.md` on every release.

---

## File Index (new files in this PR)

```
.github/
├── ISSUE_TEMPLATE/
│   ├── bug_report.yml          ← structured bug-report form
│   ├── feature_request.yml     ← structured feature-request form
│   └── config.yml              ← disables blank issues
└── pull_request_template.md    ← PR checklist

CHANGELOG.md                    ← v1.0.0 full feature history
VERSION                         ← "1.0.0"
scripts/
└── setup_github.py             ← seeds labels + 12 backlog issues
HANDOFF.md                      ← this file
```
