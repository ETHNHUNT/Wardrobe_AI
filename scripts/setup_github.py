"""
WardrobeAI — GitHub bootstrap script
=====================================
Creates labels and seeds backlog issues on the GitHub repo.

Usage:
    GH_TOKEN=<your_personal_access_token> python scripts/setup_github.py

Requirements:
    pip install requests

The token needs: repo scope (or fine-grained: Issues write + Labels write).
Run once per fresh clone.  Safe to re-run — existing labels/issues are skipped.
"""

import os
import sys
import json
import time
import requests

REPO = "ETHNHUNT/Wardrobe_AI"
API  = "https://api.github.com"
TOKEN = os.environ.get("GH_TOKEN", "")

if not TOKEN:
    sys.exit("ERROR: set GH_TOKEN environment variable before running this script.")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

LABELS = [
    {"name": "bug",            "color": "d73a4a", "description": "Something isn't working"},
    {"name": "enhancement",    "color": "a2eeef", "description": "New feature or improvement"},
    {"name": "documentation",  "color": "0075ca", "description": "Improvements to docs"},
    {"name": "performance",    "color": "0075ca", "description": "Slow responses, caching, query optimisation"},
    {"name": "technical-debt", "color": "7c3aed", "description": "Hardcoded values, missing config, duplicated constants"},
    {"name": "security",       "color": "e11d48", "description": "Input validation, auth, injection risks"},
]


def ensure_labels():
    print("\n── Labels ──────────────────────────────")
    existing = {l["name"] for l in requests.get(f"{API}/repos/{REPO}/labels", headers=HEADERS).json()}
    for label in LABELS:
        if label["name"] in existing:
            print(f"  skip  {label['name']}")
            continue
        r = requests.post(f"{API}/repos/{REPO}/labels", headers=HEADERS, json=label)
        if r.status_code == 201:
            print(f"  created  {label['name']}")
        else:
            print(f"  FAILED  {label['name']}  {r.status_code} {r.text[:80]}")
        time.sleep(0.3)


# ---------------------------------------------------------------------------
# Issues  (12 backlog issues, priority-ordered)
# ---------------------------------------------------------------------------

ISSUES = [
    # ── Critical ────────────────────────────────────────────────────────────
    {
        "title": "[Bug] Outfit Builder crashes when wardrobe is empty",
        "body": (
            "## Describe the bug\n"
            "Navigating to Outfit Builder with zero clothing items raises an unhandled "
            "exception in `OutfitBuilder.jsx`, showing a blank white screen instead of "
            "a friendly empty-state message.\n\n"
            "## Steps to reproduce\n"
            "1. Delete all items from the wardrobe.\n"
            "2. Tap **Outfits** in the bottom nav.\n"
            "3. Tap **Generate**.\n\n"
            "## Expected behaviour\n"
            "An empty-state illustration with a prompt to add items first.\n\n"
            "## Priority\n"
            "critical — app crashes / data loss"
        ),
        "labels": ["bug"],
    },
    {
        "title": "[Bug] ItemDetailModal edit form loses changes on accidental backdrop tap",
        "body": (
            "## Describe the bug\n"
            "When editing an item in `ItemDetailModal`, tapping outside the modal "
            "dismisses it without warning, discarding unsaved field edits.\n\n"
            "## Steps to reproduce\n"
            "1. Open any item → tap **Edit**.\n"
            "2. Change the brand name.\n"
            "3. Tap outside the modal.\n"
            "4. Reopen the item — change is lost.\n\n"
            "## Expected behaviour\n"
            "Show a confirmation dialog before discarding unsaved changes.\n\n"
            "## Priority\n"
            "critical — data loss"
        ),
        "labels": ["bug"],
    },
    # ── High ─────────────────────────────────────────────────────────────────
    {
        "title": "[Bug] /shop/gaps 30 s cache not invalidated after new item is added",
        "body": (
            "## Describe the bug\n"
            "After uploading a new clothing item, the Shopping page still shows stale "
            "gap-analysis results for up to 30 seconds.  The `_gaps_cache` TTL check "
            "in `shopping_service.py` compares elapsed time but does **not** compare "
            "`item_count`, so a newly added item is silently ignored.\n\n"
            "## Expected behaviour\n"
            "Cache should be invalidated immediately when `item_count` in the DB changes.\n\n"
            "## Priority\n"
            "high — major feature shows wrong data"
        ),
        "labels": ["bug", "performance"],
    },
    {
        "title": "[Bug] Barcode scanner leaves camera stream open after navigation",
        "body": (
            "## Describe the bug\n"
            "When the user scans a barcode and then navigates away from the Add Item "
            "page, the rear camera remains active (indicator light stays on).  "
            "`BarcodeScanner.jsx` does not call `codeReader.reset()` in its cleanup "
            "effect.\n\n"
            "## Steps to reproduce\n"
            "1. Go to **Add Item** → tap **Scan Barcode**.\n"
            "2. Without completing a scan, tap **Wardrobe** in the nav bar.\n"
            "3. Camera light stays on.\n\n"
            "## Expected behaviour\n"
            "Camera stream released on unmount.\n\n"
            "## Priority\n"
            "high — resource / privacy issue"
        ),
        "labels": ["bug"],
    },
    {
        "title": "[Feature] Implement Gemini 2.5 Flash-Lite fallback when Ollama is unavailable",
        "body": (
            "## Problem\n"
            "When Ollama is not running (or the model is not loaded), tagging silently "
            "returns an empty dict and the user lands on the manual form with no "
            "explanation.  The backlog notes a Gemini 2.5 Flash-Lite free-tier fallback "
            "but it has not been implemented.\n\n"
            "## Proposed solution\n"
            "1. Catch `httpx.ConnectError` / timeout in `ai_service.py`.\n"
            "2. Re-try with `google-generativeai` SDK using `gemini-2.5-flash-lite`.\n"
            "3. Surface a toast: "Ollama unavailable — used Gemini fallback".\n\n"
            "## Priority\n"
            "high — core feature broken without Ollama"
        ),
        "labels": ["enhancement"],
    },
    {
        "title": "[Performance] AI tagging blocks the upload response for 15–30 s",
        "body": (
            "## Problem\n"
            "`POST /items` runs Ollama tagging **synchronously** before returning a "
            "response, so the frontend spinner hangs for the full model-inference "
            "duration.  On first load, qwen3.5:2b needs 15–30 s to warm up.\n\n"
            "## Proposed solution\n"
            "1. Save the photo + create a DB row with `status='pending'`.\n"
            "2. Return `202 Accepted` immediately with the item ID.\n"
            "3. Run tagging in a background `asyncio.create_task` and update the row.\n"
            "4. Frontend polls `GET /items/{id}` until `status='ready'`.\n\n"
            "## Priority\n"
            "high — very poor UX on first use"
        ),
        "labels": ["performance", "enhancement"],
    },
    # ── Medium ────────────────────────────────────────────────────────────────
    {
        "title": "[Tech-debt] OLLAMA_URL and MODEL are hardcoded strings in ai_service.py",
        "body": (
            "## Problem\n"
            "`OLLAMA_URL = 'http://localhost:11434/api/chat'` and `MODEL = 'qwen3.5:2b'` "
            "are defined as bare module-level strings.  Changing Ollama's port or "
            "swapping models requires editing source.\n\n"
            "## Proposed solution\n"
            "Read from environment variables with `python-dotenv` fallbacks:\n"
            "```\n"
            "OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434/api/chat')\n"
            "MODEL      = os.getenv('OLLAMA_MODEL', 'qwen3.5:2b')\n"
            "```\n"
            "Document both variables in `backend/.env.example`.\n\n"
            "## Priority\n"
            "medium — config flexibility"
        ),
        "labels": ["technical-debt"],
    },
    {
        "title": "[Feature] Add outfit history / recently worn view",
        "body": (
            "## Problem\n"
            "There is no way to see which outfits were worn in the past.  "
            "`times_worn` is tracked per item but there is no timeline of "
            "complete outfit wears.\n\n"
            "## Proposed solution\n"
            "Add a **History** tab inside Outfit Builder that lists `SavedOutfit` "
            "records ordered by `created_at`, with thumbnails and the last-worn date.\n\n"
            "## Priority\n"
            "medium — nice-to-have UX"
        ),
        "labels": ["enhancement"],
    },
    {
        "title": "[Security] PUT /items/{id} does not validate JSON array fields",
        "body": (
            "## Problem\n"
            "Sending a non-array value for `colors`, `tags`, `occasions`, or `seasons` "
            "in `PUT /items/{id}` is stored verbatim as a string in SQLite without "
            "validation.  Subsequent reads that call `json.loads()` on the field will "
            "either succeed silently with wrong types or crash.\n\n"
            "## Proposed solution\n"
            "Add Pydantic field validators in `items.py` that assert these fields are "
            "`list[str]` before writing to the DB.\n\n"
            "## Priority\n"
            "medium — data-integrity / security"
        ),
        "labels": ["security", "bug"],
    },
    {
        "title": "[Feature] Versatility score per shopping suggestion",
        "body": (
            "## Problem\n"
            "Shopping suggestion cards show a recommended item but do not tell the user "
            "how well it pairs with existing wardrobe items.\n\n"
            "## Proposed solution\n"
            "In `shopping_service.py`, for each suggestion compute how many existing "
            "items share an occasion + compatible colour, and surface it as "
            ""pairs with N items in your wardrobe".\n\n"
            "## Priority\n"
            "medium — improves shopping feature value"
        ),
        "labels": ["enhancement"],
    },
    # ── Low ───────────────────────────────────────────────────────────────────
    {
        "title": "[Tech-debt] Duplicate cn() helper defined in multiple component files",
        "body": (
            "## Problem\n"
            "The `cn()` class-merge helper is already exported from `lib/utils.js` but "
            "some early components define their own inline version, leading to "
            "duplication and potential divergence.\n\n"
            "## Proposed solution\n"
            "Audit all components for local `cn` definitions and replace with the "
            "canonical import from `@/lib/utils`.\n\n"
            "## Priority\n"
            "low — code cleanliness"
        ),
        "labels": ["technical-debt"],
    },
    {
        "title": "[Feature] Color palette gap detection in wardrobe analysis",
        "body": (
            "## Problem\n"
            "The gap analysis focuses on category coverage (e.g. 'missing formal shoes') "
            "but ignores colour palette balance (e.g. 'you have 8 navy items but no "
            "earthy tones').\n\n"
            "## Proposed solution\n"
            "In `analyze_gaps`, parse `colors` arrays and include a colour-balance "
            "section in the response, then visualise it on the Shopping page.\n\n"
            "## Priority\n"
            "low — backlog PRD item"
        ),
        "labels": ["enhancement"],
    },
]


def ensure_issues():
    print("\n── Issues ──────────────────────────────")
    # Fetch all open + closed issue titles to avoid duplicates
    existing_titles = set()
    page = 1
    while True:
        r = requests.get(
            f"{API}/repos/{REPO}/issues",
            headers=HEADERS,
            params={"state": "all", "per_page": 100, "page": page},
        )
        batch = r.json()
        if not batch:
            break
        for issue in batch:
            existing_titles.add(issue["title"])
        page += 1

    for issue in ISSUES:
        if issue["title"] in existing_titles:
            print(f"  skip  {issue['title'][:70]}")
            continue
        payload = {
            "title": issue["title"],
            "body": issue["body"],
            "labels": issue["labels"],
        }
        r = requests.post(f"{API}/repos/{REPO}/issues", headers=HEADERS, json=payload)
        if r.status_code == 201:
            num = r.json()["number"]
            print(f"  #{num:<4} {issue['title'][:65]}")
        else:
            print(f"  FAILED  {r.status_code} {r.text[:120]}")
        time.sleep(0.5)  # stay well within rate limits


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Bootstrapping GitHub repo: {REPO}")
    ensure_labels()
    ensure_issues()
    print("\nDone.")
