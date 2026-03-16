"""
WardrobeAI Gemini Fallback Test Suite
======================================
Standalone test script — no pytest required. Uses httpx (already in requirements).

Purpose: Tests Gemini-only AI paths by ensuring Ollama is NOT running.
This validates that the fallback chain (Ollama → Gemini) works correctly.

Prerequisites:
    - Backend running: GEMINI_API_KEY=<key> uvicorn main:app --host 0.0.0.0 --port 8000
    - Ollama: MUST be stopped (otherwise Ollama handles everything, Gemini never fires)
    - GEMINI_API_KEY: Must be set in environment or backend/.env
    - Internet access to generativelanguage.googleapis.com

Run with:
    # Stop Ollama first:
    #   taskkill /IM ollama.exe /F        (Windows)
    #   killall ollama                    (Linux/Mac)
    #
    # Then run:
    cd backend
    GEMINI_API_KEY=<your-key> python test_gemini.py

Test coverage:
    - Gemini model reachability (text + vision)
    - Image tagging via Gemini fallback
    - Garment measurement inference via Gemini
    - Outfit generation via Gemini
    - Gap analysis via Gemini
    - Label OCR via Gemini fallback
    - Full user flow: upload item → AI tags it → generate outfit → shop gaps
"""

import io
import json
import os
import sys
import time
import traceback

import httpx
from PIL import Image

BASE_URL = os.environ.get("TEST_API_URL", "http://localhost:8000")

# ── Helpers ────────────────────────────────────────────────────────────────────

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
SKIP = "\033[93m~\033[0m"
INFO = "\033[94mℹ\033[0m"

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


def info(msg: str):
    print(f"  {INFO} {msg}")


def section(title: str):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


def make_test_image(color=(100, 149, 237), size=(200, 200)) -> bytes:
    """Create a small JPEG in memory for upload tests."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def make_clothing_image() -> bytes:
    """Create a simple clothing-like image (blue rectangle on white bg)."""
    img = Image.new("RGB", (300, 400), color=(255, 255, 255))
    # Draw a simple blue rectangle to simulate a t-shirt shape
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    # T-shirt body
    draw.rectangle([50, 80, 250, 350], fill=(30, 60, 120))
    # Sleeves
    draw.rectangle([10, 80, 60, 180], fill=(30, 60, 120))
    draw.rectangle([240, 80, 290, 180], fill=(30, 60, 120))
    # Collar
    draw.ellipse([120, 60, 180, 100], fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


# ── Pre-flight checks ────────────────────────────────────────────────────────

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


def check_gemini_key():
    return bool(os.environ.get("GEMINI_API_KEY", ""))


def check_gemini_reachable():
    """Test if Gemini API is reachable with a simple text call."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return False, "No API key"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={api_key}"
    try:
        r = httpx.post(url, json={
            "contents": [{"parts": [{"text": "Say hello in one word"}]}],
            "generationConfig": {"temperature": 0.0},
        }, timeout=30)
        if r.status_code == 200:
            data = r.json()
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return bool(text), f"Response: {text[:50]}"
        return False, f"HTTP {r.status_code}: {r.text[:100]}"
    except Exception as e:
        return False, str(e)


# ── Test: Direct Gemini API ──────────────────────────────────────────────────

def test_gemini_direct():
    section("Direct Gemini API Tests")

    api_key = os.environ.get("GEMINI_API_KEY", "")

    # Test 1: Text generation
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={api_key}"
    try:
        r = httpx.post(url, json={
            "contents": [{"parts": [{"text": "Return ONLY this JSON: {\"test\": true}"}]}],
            "generationConfig": {"temperature": 0.0},
        }, timeout=30)
        check("Gemini text endpoint returns 200", r.status_code == 200, f"Got {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            check("Gemini text returns content", bool(text), "Empty response")
            # Check if JSON parseable
            import re
            cleaned = re.sub(r"```(?:json)?|```", "", text).strip()
            try:
                parsed = json.loads(cleaned)
                check("Gemini returns valid JSON", isinstance(parsed, dict))
            except json.JSONDecodeError:
                check("Gemini returns valid JSON", False, f"Got: {text[:80]}")
    except Exception as e:
        check("Gemini text endpoint reachable", False, str(e))

    # Test 2: Vision with test image
    img_data = make_clothing_image()
    import base64
    b64 = base64.b64encode(img_data).decode()

    try:
        r = httpx.post(url, json={
            "contents": [{
                "parts": [
                    {"text": "What color is the main shape in this image? Reply in one word."},
                    {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
                ]
            }],
            "generationConfig": {"temperature": 0.0},
        }, timeout=60)
        check("Gemini vision endpoint returns 200", r.status_code == 200, f"Got {r.status_code}")
        if r.status_code == 200:
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            check("Gemini vision returns content", bool(text), "Empty response")
            info(f"Vision response: {text.strip()[:80]}")
    except Exception as e:
        check("Gemini vision endpoint reachable", False, str(e))


# ── Test: AI Tagging via Backend ─────────────────────────────────────────────

def test_gemini_tagging(client: httpx.Client):
    section("Gemini Fallback — Image Tagging")

    # Upload an item without metadata — forces AI tagging
    img = make_clothing_image()
    files = {"photo": ("test_shirt.jpg", img, "image/jpeg")}

    info("Uploading clothing image (no metadata) — AI should tag via Gemini...")
    start = time.time()
    r = client.post("/items", files=files, timeout=120)
    elapsed = time.time() - start

    check("POST /items returns 200", r.status_code == 200, f"Got {r.status_code}: {r.text[:100]}")

    if r.status_code != 200:
        skip("Tagging result checks", "upload failed")
        return None

    data = r.json()
    item_id = data.get("id")
    info(f"Item created: id={item_id} in {elapsed:.1f}s")

    # Check AI tagging results
    category = data.get("category", "unknown")
    colors = json.loads(data.get("colors", "[]")) if isinstance(data.get("colors"), str) else data.get("colors", [])
    tags = json.loads(data.get("tags", "[]")) if isinstance(data.get("tags"), str) else data.get("tags", [])
    occasions = json.loads(data.get("occasions", "[]")) if isinstance(data.get("occasions"), str) else data.get("occasions", [])
    seasons = json.loads(data.get("seasons", "[]")) if isinstance(data.get("seasons"), str) else data.get("seasons", [])

    ai_worked = category not in ("unknown", "other", None)
    check("AI tagged category (not unknown/other)", ai_worked, f"category={category}")
    check("AI detected colors", len(colors) > 0, f"colors={colors}")
    check("AI assigned occasions", len(occasions) > 0, f"occasions={occasions}")
    check("AI assigned seasons", len(seasons) > 0, f"seasons={seasons}")
    check("Response time < 60s", elapsed < 60, f"took {elapsed:.1f}s")

    info(f"Category: {category}")
    info(f"Colors: {colors}")
    info(f"Tags: {tags}")
    info(f"Fit type: {data.get('fit_type')}")
    info(f"Occasions: {occasions}")
    info(f"Seasons: {seasons}")
    info(f"Material: {data.get('material')}")

    return item_id


# ── Test: Re-tagging via Gemini ──────────────────────────────────────────────

def test_gemini_retag(client: httpx.Client, item_id: int):
    section("Gemini Fallback — Re-tag Existing Item")

    if not item_id:
        skip("POST /items/{id}/tag", "no item to retag")
        return

    # First, manually edit the item to set known values
    client.put(f"/items/{item_id}", json={"brand": "TestBrand", "notes": "manual edit"})

    # Now retag — should preserve manual edits (preserve_existing=True)
    info("Re-tagging item via Gemini (preserve_existing=True)...")
    start = time.time()
    r = client.post(f"/items/{item_id}/tag", timeout=120)
    elapsed = time.time() - start

    check("POST /items/{id}/tag returns 200", r.status_code == 200, f"Got {r.status_code}")

    if r.status_code == 200:
        data = r.json()
        check("Brand preserved after retag", data.get("brand") == "TestBrand", f"brand={data.get('brand')}")
        check("Notes preserved after retag", data.get("notes") == "manual edit", f"notes={data.get('notes')}")
        info(f"Retag completed in {elapsed:.1f}s")


# ── Test: Garment Measurements ───────────────────────────────────────────────

def test_garment_measurements(client: httpx.Client, item_id: int):
    section("Gemini Fallback — Garment Measurements")

    if not item_id:
        skip("Garment measurements", "no item")
        return

    # Wait a moment for async measurement inference to complete
    info("Waiting 5s for async garment measurement inference...")
    time.sleep(5)

    r = client.get(f"/items/{item_id}")
    check("GET /items/{id} returns 200", r.status_code == 200)

    if r.status_code == 200:
        data = r.json()
        gm = data.get("garment_measurements")
        if gm:
            if isinstance(gm, str):
                gm = json.loads(gm)
            has_measurements = any(v is not None for v in gm.values()) if isinstance(gm, dict) else False
            check("Garment measurements inferred", has_measurements, f"measurements={gm}")
            if has_measurements:
                info(f"Measurements: {gm}")
        else:
            check("Garment measurements inferred", False, "garment_measurements is null/empty")


# ── Test: Outfit Generation ──────────────────────────────────────────────────

def test_gemini_outfits(client: httpx.Client):
    section("Gemini Fallback — Outfit Generation")

    # First, make sure we have at least 3 items
    items_r = client.get("/items")
    existing_items = items_r.json() if items_r.status_code == 200 else []

    if len(existing_items) < 3:
        info(f"Only {len(existing_items)} items — adding more for outfit generation...")
        colors_and_cats = [
            ({"category": "jeans", "colors": '["blue"]', "occasions": '["casual","work"]', "seasons": '["spring","summer","fall","winter"]'}, (30, 40, 100)),
            ({"category": "sneakers", "colors": '["white"]', "occasions": '["casual","sport"]', "seasons": '["spring","summer"]'}, (240, 240, 240)),
            ({"category": "jacket", "colors": '["black"]', "occasions": '["casual","work"]', "seasons": '["fall","winter"]'}, (20, 20, 20)),
        ]
        for meta, color in colors_and_cats:
            if len(existing_items) >= 3:
                break
            img = make_test_image(color=color)
            files = {"photo": ("item.jpg", img, "image/jpeg")}
            r = client.post("/items", files=files, data={"metadata": json.dumps(meta)}, timeout=120)
            if r.status_code == 200:
                existing_items.append(r.json())

    if len(existing_items) < 2:
        skip("Outfit generation", f"need ≥2 items, have {len(existing_items)}")
        return

    # Generate outfits
    info("Generating outfits via Gemini (occasion=casual, season=summer)...")
    start = time.time()
    r = client.post("/outfits/generate", json={"occasion": "casual", "season": "summer"}, timeout=120)
    elapsed = time.time() - start

    check("POST /outfits/generate returns 200", r.status_code == 200, f"Got {r.status_code}: {r.text[:100]}")

    if r.status_code == 200:
        outfits = r.json()
        check("Returns a list", isinstance(outfits, list))
        check("At least 1 outfit generated", len(outfits) >= 1, f"got {len(outfits)}")
        info(f"Generated {len(outfits)} outfits in {elapsed:.1f}s")

        for i, outfit in enumerate(outfits):
            items_in = outfit.get("items", [])
            reason = outfit.get("reason", "")
            info(f"  Outfit {i+1}: {len(items_in)} items — {reason[:60]}")
            check(f"Outfit {i+1} has items", len(items_in) >= 2, f"only {len(items_in)} items")
            check(f"Outfit {i+1} has reason", bool(reason))

        # Save the first outfit
        if outfits:
            first = outfits[0]
            item_ids = [it["id"] if isinstance(it, dict) else it for it in first.get("items", [])]
            save_r = client.post("/outfits", json={
                "item_ids": item_ids,
                "occasion": "casual",
                "season": "summer",
                "name": "Gemini Test Outfit",
                "rating": 4,
            })
            check("Save generated outfit", save_r.status_code == 200, f"Got {save_r.status_code}")
            if save_r.status_code == 200:
                saved = save_r.json()
                check("Saved outfit has name", saved.get("name") == "Gemini Test Outfit")
                info(f"Saved outfit id={saved.get('id')}")
    elif r.status_code == 503:
        check("Gemini outfit generation", False, "503 — AI backend not reachable")


# ── Test: Gap Analysis ───────────────────────────────────────────────────────

def test_gemini_gaps(client: httpx.Client):
    section("Gemini Fallback — Gap Analysis")

    info("Running gap analysis via Gemini...")
    start = time.time()
    r = client.get("/shop/gaps?force=true", timeout=120)
    elapsed = time.time() - start

    check("GET /shop/gaps returns 200", r.status_code == 200, f"Got {r.status_code}")

    if r.status_code == 200:
        data = r.json()
        info(f"Gap analysis completed in {elapsed:.1f}s")

        # Check local coverage (always works, no AI)
        local = data.get("local_coverage", {})
        check("Local coverage present", bool(local))
        if local:
            info(f"Local coverage: {json.dumps(local, indent=2)[:200]}")

        # Check AI gaps (requires Gemini)
        ai_gaps = data.get("ai_gaps", data.get("gaps", []))
        if ai_gaps:
            check("AI gaps returned", True)
            for gap in ai_gaps[:3]:
                info(f"  Gap: {gap.get('occasion','?')} — {gap.get('missing_items', [])[:3]} (priority: {gap.get('priority','?')})")
        else:
            info("No AI gaps returned — Gemini may not be reachable from this server")

        # Check coverage score
        coverage = data.get("coverage_score", {})
        if coverage:
            check("Coverage score returned", True)
            info(f"Coverage scores: {coverage}")


# ── Test: Shopping Suggestions ───────────────────────────────────────────────

def test_gemini_shopping(client: httpx.Client):
    section("Gemini Fallback — Shopping Suggestions")

    r = client.get("/shop/suggest?budget_cad=100", timeout=120)
    check("GET /shop/suggest returns 200", r.status_code == 200, f"Got {r.status_code}")

    if r.status_code == 200:
        data = r.json()
        suggestions = data.get("suggestions", [])
        info(f"Got {len(suggestions)} shopping suggestions")
        for s in suggestions[:3]:
            info(f"  → {s.get('item', '?')} at {s.get('store', '?')} — {s.get('reason', '')[:50]}")


# ── Test: Color Palette (no AI — sanity check) ──────────────────────────────

def test_palette(client: httpx.Client):
    section("Color Palette (Non-AI — Sanity Check)")

    r = client.get("/shop/palette")
    check("GET /shop/palette returns 200", r.status_code == 200)

    if r.status_code == 200:
        data = r.json()
        check("Has color groups", "by_group" in data or "dominant_group" in data)
        info(f"Palette: {json.dumps(data)[:200]}")


# ── Test: Full User Flow ─────────────────────────────────────────────────────

def test_full_user_flow(client: httpx.Client):
    section("Full User Flow (as Vipin)")

    # Step 1: Set up profile
    info("Step 1: Setting up profile...")
    r = client.post("/profile", json={
        "name": "Vipin",
        "height_cm": 178,
        "weight_kg": 75,
        "chest_cm": 100,
        "waist_cm": 82,
        "hips_cm": 96,
        "shoulder_cm": 46,
    })
    check("Profile saved", r.status_code == 200)

    # Step 2: Upload a clothing photo (AI tags via Gemini)
    info("Step 2: Uploading shirt photo for AI tagging...")
    img = make_clothing_image()
    files = {"photo": ("my_shirt.jpg", img, "image/jpeg")}
    start = time.time()
    r = client.post("/items", files=files, timeout=120)
    elapsed = time.time() - start
    check("Item uploaded", r.status_code == 200, f"{r.status_code}: {r.text[:80]}")

    if r.status_code == 200:
        item = r.json()
        info(f"  → id={item['id']}, category={item.get('category')}, colors={item.get('colors')}")
        info(f"  → Tagged in {elapsed:.1f}s")

        # Step 3: Mark as worn
        info("Step 3: Marking item as worn...")
        r = client.post(f"/items/{item['id']}/worn")
        check("Worn tracked", r.status_code == 200)
        if r.status_code == 200:
            info(f"  → times_worn: {r.json().get('times_worn')}")

        # Step 4: Check fit
        info("Step 4: Checking fit against body measurements...")
        time.sleep(3)  # Wait for async garment measurements
        r = client.get(f"/items/{item['id']}/fit-check")
        check("Fit check returns 200", r.status_code == 200)
        if r.status_code == 200:
            fit = r.json()
            info(f"  → Fit verdict: {fit.get('verdict', fit.get('status', 'N/A'))}")

    # Step 5: Check wardrobe gaps
    info("Step 5: Analyzing wardrobe gaps...")
    r = client.get("/shop/gaps?force=true", timeout=120)
    check("Gap analysis works", r.status_code == 200)

    # Step 6: Get outfit suggestion
    info("Step 6: Getting outfit suggestions...")
    r = client.post("/outfits/generate", json={"occasion": "casual", "season": "summer"}, timeout=120)
    if r.status_code == 200:
        outfits = r.json()
        check("Outfits generated", len(outfits) > 0)
        info(f"  → {len(outfits)} outfit(s) suggested")
    else:
        info(f"  → Outfit generation returned {r.status_code} (may need more items)")


# ── Cleanup ──────────────────────────────────────────────────────────────────

def cleanup(client: httpx.Client):
    section("Cleanup")
    # Delete all test items
    r = client.get("/items")
    if r.status_code == 200:
        items = r.json()
        for item in items:
            client.delete(f"/items/{item['id']}")
        info(f"Deleted {len(items)} test items")

    # Delete all outfits
    r = client.get("/outfits")
    if r.status_code == 200:
        outfits = r.json()
        for outfit in outfits:
            client.delete(f"/outfits/{outfit['id']}")
        info(f"Deleted {len(outfits)} test outfits")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    global total, passed, failed, skipped

    print("=" * 60)
    print("  WardrobeAI — Gemini Fallback Test Suite")
    print("=" * 60)

    # Pre-flight checks
    section("Pre-flight Checks")

    if not check_backend():
        print(f"\n  {FAIL} Backend not reachable at {BASE_URL}")
        print("  Start it with: cd backend && uvicorn main:app --host 0.0.0.0 --port 8000")
        sys.exit(1)
    info(f"Backend reachable at {BASE_URL}")

    ollama_up = check_ollama()
    if ollama_up:
        print(f"\n  ⚠️  WARNING: Ollama is running! Gemini fallback will NOT be tested.")
        print("  Stop Ollama first to test Gemini-only paths:")
        print("    Windows: taskkill /IM ollama.exe /F")
        print("    Linux:   killall ollama")
        print("  Continuing anyway (Ollama will handle AI, not Gemini)...\n")
    else:
        info("Ollama is NOT running ✓ (Gemini fallback will be used)")

    if not check_gemini_key():
        print(f"\n  {FAIL} GEMINI_API_KEY not set in environment")
        print("  Set it with: export GEMINI_API_KEY=<your-key>")
        print("  Or add to backend/.env: GEMINI_API_KEY=<your-key>")
        sys.exit(1)
    info("GEMINI_API_KEY is set ✓")

    reachable, detail = check_gemini_reachable()
    if reachable:
        info(f"Gemini API reachable ✓ — {detail}")
    else:
        print(f"\n  {FAIL} Gemini API NOT reachable: {detail}")
        print("  Check your API key and internet connection.")
        print("  If running in a cloud environment, Google APIs may be blocked.")
        sys.exit(1)

    # Run tests
    with httpx.Client(base_url=BASE_URL, timeout=30) as client:
        try:
            test_gemini_direct()
            item_id = test_gemini_tagging(client)
            test_gemini_retag(client, item_id)
            test_garment_measurements(client, item_id)
            test_gemini_outfits(client)
            test_gemini_gaps(client)
            test_gemini_shopping(client)
            test_palette(client)
            test_full_user_flow(client)
        except Exception as e:
            print(f"\n  {FAIL} Unexpected error: {e}")
            traceback.print_exc()
        finally:
            cleanup(client)

    # Summary
    print(f"\n{'=' * 60}")
    print(f"  Results: {passed} passed, {failed} failed, {skipped} skipped / {total} total")
    print(f"{'=' * 60}")

    if failed:
        print(f"\n  {FAIL} Some tests failed — check output above")
        sys.exit(1)
    else:
        print(f"\n  {PASS} All Gemini fallback tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()
