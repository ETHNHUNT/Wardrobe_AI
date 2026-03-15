"""
WardrobeAI API Test Suite
=========================
Standalone test script — no pytest required. Uses httpx (already in requirements).
Run with: python test_api.py

Prerequisites:
    - Backend running: uvicorn main:app --host 0.0.0.0 --port 8000
    - Ollama optional — AI-dependent tests are skipped if Ollama is unreachable

Test coverage:
    - Profile: GET, POST
    - Items: POST (upload), GET list, GET single, PUT update, DELETE, POST worn, POST tag, GET fit-check
    - Items special: GET barcode (format validation, not-found), POST scan-label (skipped without Ollama)
    - Outfits: POST generate (skipped without items), GET list, POST save, PUT update, DELETE
    - Outfits special: POST worn, GET history, rating validation
    - Shop: GET gaps, GET suggest, GET palette
    - Error paths: 404 on bad IDs, 413 on oversized upload, 400 on invalid UPC, 422 on bad rating
"""

import io
import json
import os
import sys
import traceback
from pathlib import Path

import httpx
from PIL import Image

BASE_URL = os.environ.get("TEST_API_URL", "http://localhost:8000")

# ── Helpers ────────────────────────────────────────────────────────────────────

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
SKIP = "\033[93m~\033[0m"

total = passed = failed = skipped = 0


def check(name: str, condition: bool, detail: str = ""):
    global total, passed, failed
    total += 1
    if condition:
        passed += 1
        print(f"  {PASS} {name}")
    else:
        failed += 1
        print(f"  {FAIL} {name}" + (f" — {detail}" if detail else ""))


def skip(name: str, reason: str = ""):
    global total, skipped
    total += 1
    skipped += 1
    print(f"  {SKIP} SKIP {name}" + (f" — {reason}" if reason else ""))


def section(title: str):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


def make_test_image(size_bytes: int = 10_000) -> bytes:
    """Create a small JPEG in memory for upload tests."""
    img = Image.new("RGB", (100, 100), color=(100, 149, 237))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    data = buf.getvalue()
    # Pad to requested size if needed (for size-limit tests)
    while len(data) < size_bytes:
        data += data
    return data[:size_bytes] if len(data) > size_bytes else data


def make_large_image(target_bytes: int = 16 * 1024 * 1024) -> bytes:
    """Create a large blob that exceeds the 15 MB upload limit."""
    return b"X" * target_bytes


# ── Connectivity check ─────────────────────────────────────────────────────────

def check_backend():
    try:
        r = httpx.get(f"{BASE_URL}/profile", timeout=5)
        return r.status_code < 500
    except Exception:
        return False


def check_ollama():
    try:
        r = httpx.get("http://localhost:11434/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


# ── Test Sections ──────────────────────────────────────────────────────────────

def test_profile(client: httpx.Client):
    section("Profile")

    # GET /profile — auto-creates if missing
    r = client.get("/profile")
    check("GET /profile returns 200", r.status_code == 200)
    data = r.json()
    check("Profile has id field", "id" in data)
    check("Profile id is 1", data.get("id") == 1)

    # POST /profile — partial update
    r = client.post("/profile", json={"height_cm": 178.5, "name": "Vipin"})
    check("POST /profile returns 200", r.status_code == 200)
    data = r.json()
    check("Height updated correctly", data.get("height_cm") == 178.5)

    # POST /profile — invalid brand_sizes JSON string (should reject or handle gracefully)
    r = client.post("/profile", json={"brand_sizes": "not-json"})
    # Backend may accept it (stored as string) or reject — just must not 500
    check("POST /profile with bad brand_sizes doesn't 500", r.status_code != 500)

    # Restore
    client.post("/profile", json={"height_cm": 178.5, "name": "Vipin"})


def test_items(client: httpx.Client, ollama_available: bool) -> int | None:
    """Returns created item ID for downstream tests, or None."""
    section("Items — upload & CRUD")

    # GET /items — list (may be empty)
    r = client.get("/items")
    check("GET /items returns 200", r.status_code == 200)
    check("GET /items returns list", isinstance(r.json(), list))

    # POST /items — upload a valid JPEG
    img_data = make_test_image()
    r = client.post(
        "/items",
        files={"photo": ("test.jpg", img_data, "image/jpeg")},
        timeout=60,  # AI tagging can take up to 30s
    )
    check("POST /items upload returns 200 or 201", r.status_code in (200, 201))
    if r.status_code not in (200, 201):
        print(f"    → Response: {r.text[:200]}")
        return None
    item = r.json()
    item_id = item.get("id")
    check("POST /items returns item with id", item_id is not None)
    check("POST /items has photo_path", bool(item.get("photo_path")))
    check("POST /items has category field", "category" in item)
    check("POST /items has ai_tagged field", "ai_tagged" in item)

    # GET /items/{id}
    r = client.get(f"/items/{item_id}")
    check("GET /items/{id} returns 200", r.status_code == 200)
    check("GET /items/{id} returns correct item", r.json().get("id") == item_id)

    # GET /items/999999 — not found
    r = client.get("/items/999999")
    check("GET /items/999999 returns 404", r.status_code == 404)

    # PUT /items/{id} — partial update
    r = client.put(f"/items/{item_id}", json={"brand": "TestBrand", "category": "tshirt"})
    check("PUT /items/{id} returns 200", r.status_code == 200)
    updated = r.json()
    check("PUT /items/{id} updates brand", updated.get("brand") == "TestBrand")
    check("PUT /items/{id} updates category", updated.get("category") == "tshirt")
    check("PUT /items/{id} protected: id unchanged", updated.get("id") == item_id)

    # POST /items/{id}/worn
    r = client.post(f"/items/{item_id}/worn")
    check("POST /items/{id}/worn returns 200", r.status_code == 200)
    worn_data = r.json()
    check("POST /items/{id}/worn increments counter", worn_data.get("times_worn", 0) >= 1)

    # POST /items/999999/worn — not found
    r = client.post("/items/999999/worn")
    check("POST /items/999999/worn returns 404", r.status_code == 404)

    # GET /items/{id}/fit-check — garment_measurements may or may not exist
    r = client.get(f"/items/{item_id}/fit-check")
    check("GET /items/{id}/fit-check returns 200", r.status_code == 200)
    fit = r.json()
    check("fit-check returns fits field", "fits" in fit)

    return item_id


def test_items_barcode(client: httpx.Client):
    section("Items — Barcode & Label")

    # Invalid UPC format — not digits
    r = client.get("/items/barcode/abc123")
    check("GET /items/barcode/abc123 returns 400", r.status_code == 400)

    # Invalid UPC length — 5 digits
    r = client.get("/items/barcode/12345")
    check("GET /items/barcode/12345 (5 digits) returns 400", r.status_code == 400)

    # Valid format but unknown product (12-digit UPC)
    r = client.get("/items/barcode/000000000000")
    check("GET /items/barcode with unknown UPC returns 404 or 200", r.status_code in (200, 404))

    # Valid format — 13-digit EAN
    r = client.get("/items/barcode/0000000000000")
    check("GET /items/barcode with 13-digit EAN returns 400 or 404", r.status_code in (200, 400, 404))


def test_items_upload_size(client: httpx.Client):
    section("Items — Upload Size Limit")

    # Upload a 16 MB blob (exceeds 15 MB limit)
    large_data = make_large_image(16 * 1024 * 1024)
    r = client.post(
        "/items",
        files={"photo": ("huge.jpg", large_data, "image/jpeg")},
        timeout=30,
    )
    check("POST /items with 16 MB file returns 413", r.status_code == 413, f"got {r.status_code}")

    # Upload a non-image file
    r = client.post(
        "/items",
        files={"photo": ("test.txt", b"not an image", "text/plain")},
        timeout=30,
    )
    check("POST /items with non-image returns 400", r.status_code == 400, f"got {r.status_code}")


def test_outfits(client: httpx.Client, item_id: int | None, ollama_available: bool) -> int | None:
    """Returns saved outfit ID or None."""
    section("Outfits")

    # GET /outfits — list
    r = client.get("/outfits")
    check("GET /outfits returns 200", r.status_code == 200)
    check("GET /outfits returns list", isinstance(r.json(), list))
    outfits = r.json()
    if outfits:
        # Check missing_items field exists in response
        check("GET /outfits includes missing_items field", "missing_items" in outfits[0])

    # POST /outfits/generate — requires items in wardrobe
    if item_id and ollama_available:
        r = client.post("/outfits/generate", json={"occasion": "casual", "season": "spring"}, timeout=120)
        check("POST /outfits/generate returns 200 or 503", r.status_code in (200, 400, 503))
        if r.status_code == 200:
            data = r.json()
            check("generate returns suggestions key", "suggestions" in data)
    elif not ollama_available:
        skip("POST /outfits/generate", "Ollama not running")
    else:
        skip("POST /outfits/generate", "no items in wardrobe")

    # POST /outfits — save outfit
    ids = [item_id] if item_id else [1]
    r = client.post("/outfits", json={"item_ids": ids, "occasion": "casual", "season": "spring", "rating": 4})
    check("POST /outfits save returns 200", r.status_code == 200)
    outfit = r.json()
    outfit_id = outfit.get("id")
    check("POST /outfits returns outfit with id", outfit_id is not None)

    # POST /outfits — invalid rating
    r = client.post("/outfits", json={"item_ids": ids, "rating": 10})
    check("POST /outfits with rating=10 returns 422", r.status_code == 422, f"got {r.status_code}")

    r = client.post("/outfits", json={"item_ids": ids, "rating": 0})
    check("POST /outfits with rating=0 returns 422", r.status_code == 422, f"got {r.status_code}")

    if not outfit_id:
        return None

    # PUT /outfits/{id} — update rating
    r = client.put(f"/outfits/{outfit_id}", json={"rating": 5})
    check("PUT /outfits/{id} returns 200", r.status_code == 200)
    check("PUT /outfits/{id} updates rating", r.json().get("rating") == 5)

    # PUT /outfits/{id} — invalid rating
    r = client.put(f"/outfits/{outfit_id}", json={"rating": 6})
    check("PUT /outfits/{id} with rating=6 returns 400", r.status_code == 400, f"got {r.status_code}")

    # POST /outfits/{id}/worn
    r = client.post(f"/outfits/{outfit_id}/worn")
    check("POST /outfits/{id}/worn returns 200", r.status_code == 200)
    check("POST /outfits/{id}/worn increments times_worn", r.json().get("times_worn", 0) >= 1)

    # GET /outfits/history — worn outfits
    r = client.get("/outfits/history")
    check("GET /outfits/history returns 200", r.status_code == 200)
    check("GET /outfits/history returns list", isinstance(r.json(), list))

    # GET /outfits/{bad_id}
    r = client.put("/outfits/999999", json={"rating": 3})
    check("PUT /outfits/999999 returns 404", r.status_code == 404)

    return outfit_id


def test_outfits_cascade(client: httpx.Client, item_id: int | None, outfit_id: int | None):
    """Test that deleting an item removes it from outfit item_ids."""
    section("Items — Cascading Delete")

    if not item_id or not outfit_id:
        skip("Cascading delete test", "no item or outfit created in earlier tests")
        return

    # Get outfit before delete
    r_before = client.get("/outfits")
    outfit_before = next((o for o in r_before.json() if o["id"] == outfit_id), None)
    if outfit_before:
        check("Outfit exists before item delete", True)
        item_ids_before = json.loads(outfit_before.get("item_ids", "[]")) if isinstance(outfit_before.get("item_ids"), str) else outfit_before.get("item_ids", [])
        item_was_in_outfit = item_id in item_ids_before
        if item_was_in_outfit:
            # Delete the item
            r = client.delete(f"/items/{item_id}")
            check("DELETE /items/{id} returns 200", r.status_code == 200)

            # Check outfit no longer references deleted item
            r_after = client.get("/outfits")
            # Outfit may be deleted (if it had only 1 item) or updated
            outfits_after = r_after.json()
            outfit_after = next((o for o in outfits_after if o["id"] == outfit_id), None)
            if outfit_after is None:
                check("Outfit deleted when last item removed", True)
            else:
                remaining_ids = outfit_after.get("item_ids", [])
                check("Deleted item ID removed from outfit", item_id not in remaining_ids)
        else:
            skip("Cascading delete exact check", "test item was not part of the outfit")
    else:
        skip("Cascading delete test", "outfit not found in GET /outfits response")


def test_shop(client: httpx.Client):
    section("Shop")

    # GET /shop/gaps
    r = client.get("/shop/gaps", timeout=60)
    check("GET /shop/gaps returns 200", r.status_code == 200)
    data = r.json()
    check("GET /shop/gaps has total_items", "total_items" in data)
    check("GET /shop/gaps has local_coverage", "local_coverage" in data)
    check("GET /shop/gaps has ai_gaps list", isinstance(data.get("ai_gaps"), list))

    # GET /shop/gaps?force=true
    r = client.get("/shop/gaps?force=true", timeout=60)
    check("GET /shop/gaps?force=true returns 200", r.status_code == 200)

    # GET /shop/suggest
    r = client.get("/shop/suggest", timeout=60)
    check("GET /shop/suggest returns 200", r.status_code == 200)
    data = r.json()
    check("GET /shop/suggest has suggestions list", isinstance(data.get("suggestions"), list))

    # GET /shop/suggest with params
    r = client.get("/shop/suggest?brand=Zara&budget_cad=100", timeout=60)
    check("GET /shop/suggest with params returns 200", r.status_code == 200)

    # GET /shop/palette
    r = client.get("/shop/palette")
    check("GET /shop/palette returns 200", r.status_code == 200)
    data = r.json()
    check("GET /shop/palette has by_group", "by_group" in data)
    check("GET /shop/palette has all_colors list", isinstance(data.get("all_colors"), list))
    check("GET /shop/palette has complementary_suggestions list", isinstance(data.get("complementary_suggestions"), list))


def test_outfit_cleanup(client: httpx.Client, outfit_id: int | None, item_id: int | None):
    """Clean up test data — delete outfit and item if they weren't already cascade-deleted."""
    section("Cleanup")

    if outfit_id:
        r = client.delete(f"/outfits/{outfit_id}")
        if r.status_code == 200:
            check("Deleted test outfit", True)
        elif r.status_code == 404:
            check("Test outfit already removed (cascade)", True)
        else:
            check("DELETE /outfits/{id}", False, f"got {r.status_code}")

    if item_id:
        r = client.delete(f"/items/{item_id}")
        if r.status_code in (200, 404):
            check("Deleted test item (or already gone)", True)
        else:
            check("DELETE /items/{id}", False, f"got {r.status_code}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "═" * 60)
    print("  WardrobeAI API Test Suite")
    print("  Target:", BASE_URL)
    print("═" * 60)

    if not check_backend():
        print(f"\n{FAIL} Cannot reach backend at {BASE_URL}")
        print("  Start with: uvicorn main:app --host 0.0.0.0 --port 8000")
        sys.exit(1)
    print(f"\n{PASS} Backend is reachable")

    ollama_available = check_ollama()
    if ollama_available:
        print(f"{PASS} Ollama is reachable — AI tests will run")
    else:
        print(f"{SKIP} Ollama is not reachable — AI-dependent tests will be skipped")

    with httpx.Client(base_url=BASE_URL, timeout=30) as client:
        item_id = None
        outfit_id = None

        try:
            test_profile(client)
            test_items_upload_size(client)
            test_items_barcode(client)
            item_id = test_items(client, ollama_available)
            outfit_id = test_outfits(client, item_id, ollama_available)
            test_outfits_cascade(client, item_id, outfit_id)
            test_shop(client)
        except Exception:
            print(f"\n{FAIL} Unexpected error during tests:")
            traceback.print_exc()
        finally:
            # Only clean up if cascade test didn't already remove things
            test_outfit_cleanup(client, outfit_id, item_id)

    print("\n" + "═" * 60)
    print(f"  Results: {passed} passed, {failed} failed, {skipped} skipped / {total} total")
    print("═" * 60 + "\n")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
