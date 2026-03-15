"""
WardrobeAI Adversarial Test Suite
==================================
Covers edge cases and attack vectors not in test_api.py.
Run with: python test_adversarial.py
Prerequisites: backend running at http://localhost:8000
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

total = passed = failed = skipped = 0
_created_item_ids: list[int] = []
_created_outfit_ids: list[int] = []


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


def make_image(color=(100, 149, 237)) -> bytes:
    img = Image.new("RGB", (80, 80), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def upload_item(client: httpx.Client, metadata: dict | None = None) -> int | None:
    """Upload a test item, optionally with metadata. Returns item id."""
    files = {"photo": ("test.jpg", make_image(), "image/jpeg")}
    data = {}
    if metadata:
        data["metadata"] = json.dumps(metadata)
    r = client.post("/items", files=files, data=data, timeout=60)
    if r.status_code in (200, 201):
        item_id = r.json().get("id")
        if item_id:
            _created_item_ids.append(item_id)
        return item_id
    print(f"    → upload failed: {r.status_code} {r.text[:200]}")
    return None


def save_outfit(client: httpx.Client, item_ids: list[int], **kwargs) -> int | None:
    """Save an outfit. Returns outfit id."""
    payload = {"item_ids": item_ids, **kwargs}
    r = client.post("/outfits", json=payload)
    if r.status_code == 200:
        outfit_id = r.json().get("id")
        if outfit_id:
            _created_outfit_ids.append(outfit_id)
        return outfit_id
    print(f"    → save outfit failed: {r.status_code} {r.text[:200]}")
    return None


# ── Test Sections ──────────────────────────────────────────────────────────────

def test_empty_wardrobe_shop(client: httpx.Client):
    """Verify shop endpoints work correctly with empty wardrobe."""
    section("Empty wardrobe — shop endpoints")

    # GET /shop/gaps — empty wardrobe
    r = client.get("/shop/gaps", timeout=30)
    check("GET /shop/gaps empty wardrobe returns 200", r.status_code == 200)
    data = r.json()
    check("shop/gaps empty wardrobe has total_items=0", data.get("total_items") == 0)
    check("shop/gaps empty wardrobe has local_coverage", "local_coverage" in data)
    cov = data.get("local_coverage", {})
    check("local_coverage has counts dict", isinstance(cov.get("counts"), dict))
    check("local_coverage has flagged list", isinstance(cov.get("flagged"), list))
    # With no items, all occasions should be flagged
    check("all occasions flagged when wardrobe empty", len(cov.get("flagged", [])) >= 4)

    # GET /shop/palette — empty wardrobe
    r = client.get("/shop/palette")
    check("GET /shop/palette empty wardrobe returns 200", r.status_code == 200)
    data = r.json()
    check("palette has by_group", "by_group" in data)
    check("palette has all_colors list", isinstance(data.get("all_colors"), list))
    check("palette all_colors is empty", data.get("all_colors") == [])
    check("palette complementary_suggestions is list", isinstance(data.get("complementary_suggestions"), list))

    # GET /shop/suggest — no gaps (empty wardrobe, no AI)
    r = client.get("/shop/suggest", timeout=30)
    check("GET /shop/suggest empty wardrobe returns 200", r.status_code == 200)
    check("suggest returns list", isinstance(r.json().get("suggestions"), list))


def test_filtering_accuracy(client: httpx.Client):
    """Upload items with distinct metadata, verify filters return exact matches."""
    section("Items filtering accuracy")

    # Upload 3 items with distinct categories and occasions
    id_tshirt = upload_item(client, {"category": "tshirt", "occasions": ["casual"], "seasons": ["summer"]})
    id_jeans  = upload_item(client, {"category": "jeans",  "occasions": ["casual", "work"], "seasons": ["spring", "fall"]})
    id_jacket = upload_item(client, {"category": "jacket", "occasions": ["formal", "work"], "seasons": ["fall", "winter"]})

    check("Uploaded tshirt item", id_tshirt is not None)
    check("Uploaded jeans item", id_jeans is not None)
    check("Uploaded jacket item", id_jacket is not None)

    if not all([id_tshirt, id_jeans, id_jacket]):
        skip("Filtering tests", "one or more upload failed")
        return

    # Filter by category=tshirt — must return exactly 1 item (id_tshirt)
    r = client.get("/items?category=tshirt")
    check("GET /items?category=tshirt returns 200", r.status_code == 200)
    results = r.json()
    result_ids = [i["id"] for i in results]
    check("category=tshirt returns only tshirts", all(i["category"] == "tshirt" for i in results),
          f"ids={result_ids}")
    check("category=tshirt includes tshirt item", id_tshirt in result_ids)
    check("category=tshirt excludes jeans", id_jeans not in result_ids)
    check("category=tshirt excludes jacket", id_jacket not in result_ids)

    # Filter by occasion=formal — must return only jacket
    r = client.get("/items?occasion=formal")
    check("GET /items?occasion=formal returns 200", r.status_code == 200)
    results = r.json()
    result_ids = [i["id"] for i in results]
    check("occasion=formal includes jacket", id_jacket in result_ids,
          f"expected {id_jacket} in {result_ids}")
    check("occasion=formal excludes tshirt (casual only)", id_tshirt not in result_ids)

    # Filter by season=winter — only jacket has winter
    r = client.get("/items?season=winter")
    check("GET /items?season=winter returns 200", r.status_code == 200)
    results = r.json()
    result_ids = [i["id"] for i in results]
    check("season=winter includes jacket", id_jacket in result_ids)
    check("season=winter excludes tshirt (summer only)", id_tshirt not in result_ids)

    # Combined filter: category=jeans&occasion=work — only jeans
    r = client.get("/items?category=jeans&occasion=work")
    check("GET /items?category=jeans&occasion=work returns 200", r.status_code == 200)
    results = r.json()
    result_ids = [i["id"] for i in results]
    check("combined category+occasion includes jeans", id_jeans in result_ids)
    check("combined category+occasion excludes tshirt", id_tshirt not in result_ids)
    check("combined category+occasion excludes jacket", id_jacket not in result_ids)


def test_sequential_worn_tracking(client: httpx.Client):
    """Mark item worn multiple times, verify counter increments correctly each time."""
    section("Sequential worn tracking")

    item_id = upload_item(client, {"category": "tshirt"})
    check("Uploaded item for worn tracking", item_id is not None)
    if not item_id:
        return

    # Mark worn 3 times
    for i in range(1, 4):
        r = client.post(f"/items/{item_id}/worn")
        check(f"POST /items/{item_id}/worn call {i} returns 200", r.status_code == 200)
        check(f"Counter is {i} after call {i}", r.json().get("times_worn") == i,
              f"got {r.json().get('times_worn')}")

    # GET item — verify times_worn is 3
    r = client.get(f"/items/{item_id}")
    check("GET item after 3 worn calls has times_worn=3", r.json().get("times_worn") == 3,
          f"got {r.json().get('times_worn')}")


def test_profile_brand_sizes_roundtrip(client: httpx.Client):
    """POST brand_sizes as JSON, GET back, verify exact round-trip."""
    section("Profile brand_sizes round-trip")

    brand_sizes = {"Zara": "M", "Nike": "L", "H&M": "XS"}
    r = client.post("/profile", json={"brand_sizes": json.dumps(brand_sizes)})
    check("POST /profile with brand_sizes returns 200", r.status_code == 200)

    r = client.get("/profile")
    check("GET /profile returns 200", r.status_code == 200)
    data = r.json()
    raw_sizes = data.get("brand_sizes", "{}")
    try:
        parsed = json.loads(raw_sizes) if isinstance(raw_sizes, str) else raw_sizes
        check("brand_sizes Zara=M", parsed.get("Zara") == "M", f"got {parsed}")
        check("brand_sizes Nike=L", parsed.get("Nike") == "L")
        check("brand_sizes H&M=XS", parsed.get("H&M") == "XS")
    except Exception as e:
        check("brand_sizes parseable", False, str(e))


def test_outfit_filtering(client: httpx.Client):
    """Save outfits with different occasions/seasons, verify filtering works."""
    section("Outfit filtering")

    # Need items first
    item_a = upload_item(client, {"category": "tshirt"})
    item_b = upload_item(client, {"category": "jeans"})
    check("Uploaded items for outfit filter test", item_a and item_b)
    if not item_a or not item_b:
        return

    # Save outfits with different occasions/seasons
    casual_spring = save_outfit(client, [item_a], occasion="casual", season="spring")
    formal_winter = save_outfit(client, [item_b], occasion="formal", season="winter")
    work_spring   = save_outfit(client, [item_a, item_b], occasion="work", season="spring")

    check("Saved casual/spring outfit", casual_spring is not None)
    check("Saved formal/winter outfit", formal_winter is not None)
    check("Saved work/spring outfit", work_spring is not None)

    # Filter by occasion=casual
    r = client.get("/outfits?occasion=casual")
    check("GET /outfits?occasion=casual returns 200", r.status_code == 200)
    ids = [o["id"] for o in r.json()]
    check("occasion=casual includes casual outfit", casual_spring in ids)
    check("occasion=casual excludes formal outfit", formal_winter not in ids)

    # Filter by season=winter
    r = client.get("/outfits?season=winter")
    check("GET /outfits?season=winter returns 200", r.status_code == 200)
    ids = [o["id"] for o in r.json()]
    check("season=winter includes formal/winter outfit", formal_winter in ids)
    check("season=winter excludes spring outfits", casual_spring not in ids)

    # Filter by occasion=work&season=spring
    r = client.get("/outfits?occasion=work&season=spring")
    check("GET /outfits?occasion=work&season=spring returns 200", r.status_code == 200)
    ids = [o["id"] for o in r.json()]
    check("work+spring includes work/spring outfit", work_spring in ids)
    check("work+spring excludes casual/spring", casual_spring not in ids)


def test_cascade_multi_item_outfit(client: httpx.Client):
    """Outfit with 2 items: delete 1, verify outfit survives with 1 item remaining."""
    section("Cascade delete — multi-item outfit")

    item_a = upload_item(client, {"category": "tshirt"})
    item_b = upload_item(client, {"category": "jeans"})
    check("Uploaded 2 items for cascade test", item_a and item_b)
    if not item_a or not item_b:
        return

    outfit_id = save_outfit(client, [item_a, item_b], occasion="casual")
    check("Saved multi-item outfit", outfit_id is not None)
    if not outfit_id:
        return

    # Delete item_a
    r = client.delete(f"/items/{item_a}")
    check("DELETE item_a returns 200", r.status_code == 200)
    if item_a in _created_item_ids:
        _created_item_ids.remove(item_a)

    # Outfit should still exist with only item_b
    r = client.get("/outfits")
    outfits = r.json()
    outfit = next((o for o in outfits if o["id"] == outfit_id), None)
    check("Multi-item outfit survives partial item deletion", outfit is not None,
          f"outfit {outfit_id} not found — was it deleted?")
    if outfit:
        remaining = outfit.get("item_ids", [])
        if isinstance(remaining, str):
            remaining = json.loads(remaining)
        check("Outfit has 1 item remaining", len(remaining) == 1,
              f"got {remaining}")
        check("item_b still in outfit", item_b in remaining,
              f"expected {item_b}, got {remaining}")
        check("item_a no longer in outfit", item_a not in remaining)


def test_protected_put_fields(client: httpx.Client):
    """PUT with photo_path/date_added must be silently ignored (not in update schema)."""
    section("Protected PUT fields")

    item_id = upload_item(client, {"category": "tshirt"})
    check("Uploaded item for protected field test", item_id is not None)
    if not item_id:
        return

    # Get original values
    orig = client.get(f"/items/{item_id}").json()
    orig_photo = orig.get("photo_path")
    orig_date = orig.get("date_added")

    # Try to overwrite protected fields — schema ignores them
    r = client.put(f"/items/{item_id}", json={
        "photo_path": "hacked.jpg",
        "date_added": "2000-01-01T00:00:00",
        "brand": "ProtectedTest"
    })
    check("PUT with protected fields returns 200", r.status_code == 200)
    updated = r.json()
    check("photo_path unchanged after PUT", updated.get("photo_path") == orig_photo,
          f"expected {orig_photo}, got {updated.get('photo_path')}")
    check("date_added unchanged after PUT", updated.get("date_added") == orig_date,
          f"expected {orig_date}, got {updated.get('date_added')}")
    check("brand WAS updated (allowed field)", updated.get("brand") == "ProtectedTest")


def test_outfit_name_and_history(client: httpx.Client):
    """PUT outfit name; verify outfit worn history ordering."""
    section("Outfit name + history ordering")

    item_id = upload_item(client, {"category": "tshirt"})
    check("Uploaded item for name/history test", item_id is not None)
    if not item_id:
        return

    outfit1 = save_outfit(client, [item_id], occasion="casual")
    outfit2 = save_outfit(client, [item_id], occasion="work")
    check("Saved outfit1", outfit1 is not None)
    check("Saved outfit2", outfit2 is not None)
    if not outfit1 or not outfit2:
        return

    # Set a name on outfit1
    r = client.put(f"/outfits/{outfit1}", json={"name": "Friday Casual"})
    check("PUT /outfits/{id} with name returns 200", r.status_code == 200)
    check("name persisted", r.json().get("name") == "Friday Casual",
          f"got {r.json().get('name')}")

    # Mark outfit2 worn first, then outfit1 worn (slight pause for different timestamps)
    r2 = client.post(f"/outfits/{outfit2}/worn")
    check("Mark outfit2 worn", r2.status_code == 200)
    time.sleep(0.05)  # Ensure different timestamps
    r1 = client.post(f"/outfits/{outfit1}/worn")
    check("Mark outfit1 worn", r1.status_code == 200)

    # GET /outfits/history — outfit1 should be first (most recent)
    r = client.get("/outfits/history")
    check("GET /outfits/history returns 200", r.status_code == 200)
    history = r.json()
    check("History is non-empty list", isinstance(history, list) and len(history) >= 2)
    if len(history) >= 2:
        check("History ordered: outfit1 (newer) before outfit2",
              history[0]["id"] == outfit1,
              f"expected {outfit1} first, got {history[0]['id']} first")


def test_garment_measurements_and_fit(client: httpx.Client):
    """PUT garment_measurements, then fit-check uses them properly."""
    section("Garment measurements + fit-check")

    item_id = upload_item(client, {"category": "tshirt"})
    check("Uploaded tshirt for measurements test", item_id is not None)
    if not item_id:
        return

    # PUT garment measurements
    measurements = {"chest_width_cm": 54, "body_length_cm": 72, "sleeve_cm": 62}
    r = client.put(f"/items/{item_id}", json={"garment_measurements": measurements, "category": "tshirt"})
    check("PUT garment_measurements returns 200", r.status_code == 200)

    # GET item and verify measurements are stored
    r = client.get(f"/items/{item_id}")
    item = r.json()
    raw = item.get("garment_measurements")
    try:
        stored = json.loads(raw) if isinstance(raw, str) else (raw or {})
        check("chest_width_cm stored correctly", stored.get("chest_width_cm") == 54,
              f"got {stored}")
        check("body_length_cm stored correctly", stored.get("body_length_cm") == 72)
    except Exception as e:
        check("garment_measurements parseable", False, str(e))

    # Set profile measurements for meaningful fit check
    client.post("/profile", json={"chest_cm": 100, "waist_cm": 84})

    # GET fit-check — must return 200 with fits field
    r = client.get(f"/items/{item_id}/fit-check")
    check("GET /items/{id}/fit-check returns 200", r.status_code == 200)
    fit = r.json()
    check("fit-check has 'fits' field", "fits" in fit, f"keys: {list(fit.keys())}")
    check("fit-check fits is bool", isinstance(fit.get("fits"), bool))
    check("fit-check has 'notes' field", "notes" in fit)


def test_list_fields_put_roundtrip(client: httpx.Client):
    """PUT list fields (colors, tags, occasions, seasons) and verify they round-trip."""
    section("PUT list fields round-trip")

    item_id = upload_item(client, {"category": "jacket"})
    check("Uploaded item for list field test", item_id is not None)
    if not item_id:
        return

    new_colors = ["navy", "white"]
    new_tags   = ["slim-fit", "cotton"]
    new_occ    = ["work", "formal"]
    new_seas   = ["spring", "fall"]

    r = client.put(f"/items/{item_id}", json={
        "colors": new_colors,
        "tags": new_tags,
        "occasions": new_occ,
        "seasons": new_seas,
    })
    check("PUT list fields returns 200", r.status_code == 200)

    # GET and verify
    r = client.get(f"/items/{item_id}")
    item = r.json()

    def parse_field(val):
        if isinstance(val, list):
            return val
        try:
            return json.loads(val) if val else []
        except Exception:
            return []

    check("colors round-trips correctly", parse_field(item.get("colors")) == new_colors,
          f"got {item.get('colors')}")
    check("tags round-trips correctly", parse_field(item.get("tags")) == new_tags,
          f"got {item.get('tags')}")
    check("occasions round-trips correctly", parse_field(item.get("occasions")) == new_occ,
          f"got {item.get('occasions')}")
    check("seasons round-trips correctly", parse_field(item.get("seasons")) == new_seas,
          f"got {item.get('seasons')}")


def test_metadata_override(client: httpx.Client):
    """Metadata in POST /items overrides AI-derived values (even when AI returns empty)."""
    section("Metadata override on upload")

    meta = {
        "category": "jeans",
        "brand": "Levis",
        "size_label": "32W 30L",
        "occasions": ["casual", "work"],
        "seasons": ["spring", "fall"],
        "colors": ["indigo", "blue"],
    }
    files = {"photo": ("test.jpg", make_image(), "image/jpeg")}
    data = {"metadata": json.dumps(meta)}
    r = client.post("/items", files=files, data=data, timeout=60)
    check("POST /items with metadata returns 200/201", r.status_code in (200, 201))
    if r.status_code not in (200, 201):
        return

    item = r.json()
    item_id = item.get("id")
    if item_id:
        _created_item_ids.append(item_id)

    check("category from metadata = jeans", item.get("category") == "jeans",
          f"got {item.get('category')}")
    check("brand from metadata = Levis", item.get("brand") == "Levis",
          f"got {item.get('brand')}")
    check("size_label from metadata", item.get("size_label") == "32W 30L")


def test_bulk_upload_unique_ids(client: httpx.Client):
    """Upload 5 items sequentially — all must have unique IDs and all appear in GET /items."""
    section("Bulk upload — 5 items, unique IDs")

    # Get current item count
    before = {i["id"] for i in client.get("/items").json()}

    ids = []
    for i in range(5):
        item_id = upload_item(client, {"category": "tshirt", "brand": f"Bulk{i}"})
        ids.append(item_id)

    check("All 5 items uploaded successfully", all(ids), f"failed: {[i for i in ids if not i]}")
    check("All 5 IDs are unique", len(set(ids)) == len([i for i in ids if i]))

    # GET /items — all 5 must be present
    all_items = {i["id"] for i in client.get("/items").json()}
    new_items = all_items - before
    check("5 new items visible in GET /items", len(new_items) >= 5,
          f"new items: {new_items}, uploaded: {ids}")
    for item_id in ids:
        if item_id:
            check(f"Item {item_id} present in list", item_id in all_items)


def test_outfit_generate_insufficient_items(client: httpx.Client):
    """POST /outfits/generate with only 1 item (matching occasion) returns 400."""
    section("Outfit generate — insufficient items")

    # Upload 1 item with specific occasion
    item_id = upload_item(client, {"category": "tshirt", "occasions": ["outdoor"], "seasons": ["summer"]})
    check("Uploaded single outdoor item", item_id is not None)
    if not item_id:
        return

    # Try to generate with outdoor/summer — only 1 item matches
    r = client.post("/outfits/generate", json={"occasion": "outdoor", "season": "summer"}, timeout=30)
    check("POST /outfits/generate with 1 matching item returns 400",
          r.status_code == 400,
          f"got {r.status_code}: {r.text[:100]}")


def test_outfit_delete(client: httpx.Client):
    """DELETE outfit, verify it's gone from GET /outfits."""
    section("Outfit delete verification")

    item_id = upload_item(client, {"category": "tshirt"})
    check("Uploaded item", item_id is not None)
    if not item_id:
        return

    outfit_id = save_outfit(client, [item_id], occasion="casual")
    check("Saved outfit to delete", outfit_id is not None)
    if not outfit_id:
        return

    # Verify it exists
    r = client.get("/outfits")
    ids_before = [o["id"] for o in r.json()]
    check("Outfit exists before delete", outfit_id in ids_before)

    # Delete it
    r = client.delete(f"/outfits/{outfit_id}")
    check("DELETE /outfits/{id} returns 200", r.status_code == 200)
    if outfit_id in _created_outfit_ids:
        _created_outfit_ids.remove(outfit_id)

    # Verify gone
    r = client.get("/outfits")
    ids_after = [o["id"] for o in r.json()]
    check("Outfit gone from GET /outfits after delete", outfit_id not in ids_after)

    # DELETE again — 404
    r = client.delete(f"/outfits/{outfit_id}")
    check("DELETE non-existent outfit returns 404", r.status_code == 404,
          f"got {r.status_code}")


def test_shop_suggest_with_params(client: httpx.Client):
    """GET /shop/suggest?brand=Zara&budget_cad=100 — params reflected in response."""
    section("Shop suggest with brand/budget params")

    r = client.get("/shop/suggest?brand=Zara&budget_cad=100", timeout=30)
    check("GET /shop/suggest?brand=Zara&budget_cad=100 returns 200", r.status_code == 200)
    data = r.json()
    check("Response has suggestions list", isinstance(data.get("suggestions"), list))
    check("Response echoes brand param", data.get("brand") == "Zara",
          f"got {data.get('brand')}")
    check("Response echoes budget param", data.get("budget_cad") == 100.0,
          f"got {data.get('budget_cad')}")


def test_gaps_cache_invalidation(client: httpx.Client):
    """Deleting item invalidates gaps cache — force=true returns fresh result."""
    section("Gaps cache invalidation")

    # Warm the cache
    r1 = client.get("/shop/gaps", timeout=30)
    check("Initial GET /shop/gaps returns 200", r1.status_code == 200)
    count_before = r1.json().get("total_items", -1)

    # Upload a new item
    item_id = upload_item(client, {"category": "tshirt"})
    check("Uploaded item to trigger cache invalidation", item_id is not None)

    # force=true should bypass cache and show updated count
    r2 = client.get("/shop/gaps?force=true", timeout=30)
    check("GET /shop/gaps?force=true returns 200", r2.status_code == 200)
    count_after = r2.json().get("total_items", -1)
    check("total_items increased after upload with force=true",
          count_after > count_before,
          f"before={count_before}, after={count_after}")

    # Delete item — should invalidate cache
    if item_id:
        client.delete(f"/items/{item_id}")
        if item_id in _created_item_ids:
            _created_item_ids.remove(item_id)

    # force=true again — count should be back
    r3 = client.get("/shop/gaps?force=true", timeout=30)
    check("GET /shop/gaps?force=true after delete returns 200", r3.status_code == 200)
    count_final = r3.json().get("total_items", -1)
    check("total_items restored after delete with force=true",
          count_final == count_before,
          f"expected {count_before}, got {count_final}")


def test_outfit_missing_items_field(client: httpx.Client):
    """GET /outfits always includes missing_items field even for valid outfits."""
    section("Outfit missing_items field")

    item_id = upload_item(client, {"category": "tshirt"})
    check("Uploaded item", item_id is not None)
    if not item_id:
        return

    outfit_id = save_outfit(client, [item_id])
    check("Saved outfit", outfit_id is not None)
    if not outfit_id:
        return

    r = client.get("/outfits")
    check("GET /outfits returns 200", r.status_code == 200)
    outfits = r.json()
    our_outfit = next((o for o in outfits if o["id"] == outfit_id), None)
    check("Our outfit appears in list", our_outfit is not None)
    if our_outfit:
        check("missing_items field present", "missing_items" in our_outfit,
              f"keys: {list(our_outfit.keys())}")
        check("missing_items is empty list (item exists)", our_outfit.get("missing_items") == [],
              f"got {our_outfit.get('missing_items')}")
        check("items field present in outfit", "items" in our_outfit)


def test_invalid_item_id_paths(client: httpx.Client):
    """Various 404 paths — bad IDs, non-existent resources."""
    section("404 / invalid ID paths")

    # Non-existent item
    r = client.get("/items/9999999")
    check("GET /items/9999999 returns 404", r.status_code == 404)

    r = client.put("/items/9999999", json={"brand": "Ghost"})
    check("PUT /items/9999999 returns 404", r.status_code == 404)

    r = client.delete("/items/9999999")
    check("DELETE /items/9999999 returns 404", r.status_code == 404)

    r = client.post("/items/9999999/worn")
    check("POST /items/9999999/worn returns 404", r.status_code == 404)

    r = client.get("/items/9999999/fit-check")
    check("GET /items/9999999/fit-check returns 404", r.status_code == 404)

    r = client.post("/items/9999999/tag", timeout=30)
    check("POST /items/9999999/tag returns 404", r.status_code == 404)

    # Non-existent outfit
    r = client.put("/outfits/9999999", json={"rating": 3})
    check("PUT /outfits/9999999 returns 404", r.status_code == 404)

    r = client.delete("/outfits/9999999")
    check("DELETE /outfits/9999999 returns 404", r.status_code == 404)

    r = client.post("/outfits/9999999/worn")
    check("POST /outfits/9999999/worn returns 404", r.status_code == 404)


# ── Cleanup ────────────────────────────────────────────────────────────────────

def cleanup(client: httpx.Client):
    section("Cleanup")
    for outfit_id in list(_created_outfit_ids):
        r = client.delete(f"/outfits/{outfit_id}")
        if r.status_code in (200, 404):
            print(f"  {PASS} Deleted outfit {outfit_id}")
        else:
            print(f"  {FAIL} Could not delete outfit {outfit_id}: {r.status_code}")

    for item_id in list(_created_item_ids):
        r = client.delete(f"/items/{item_id}")
        if r.status_code in (200, 404):
            print(f"  {PASS} Deleted item {item_id}")
        else:
            print(f"  {FAIL} Could not delete item {item_id}: {r.status_code}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "═" * 60)
    print("  WardrobeAI Adversarial Test Suite")
    print("  Target:", BASE_URL)
    print("═" * 60)

    # Check backend is up
    try:
        r = httpx.get(f"{BASE_URL}/profile", timeout=5)
        if r.status_code >= 500:
            raise Exception(f"Backend returned {r.status_code}")
        print(f"\n{PASS} Backend is reachable")
    except Exception as e:
        print(f"\n{FAIL} Cannot reach backend at {BASE_URL}: {e}")
        sys.exit(1)

    with httpx.Client(base_url=BASE_URL, timeout=30) as client:
        try:
            test_empty_wardrobe_shop(client)
            test_filtering_accuracy(client)
            test_sequential_worn_tracking(client)
            test_profile_brand_sizes_roundtrip(client)
            test_outfit_filtering(client)
            test_cascade_multi_item_outfit(client)
            test_protected_put_fields(client)
            test_outfit_name_and_history(client)
            test_garment_measurements_and_fit(client)
            test_list_fields_put_roundtrip(client)
            test_metadata_override(client)
            test_bulk_upload_unique_ids(client)
            test_outfit_generate_insufficient_items(client)
            test_outfit_delete(client)
            test_shop_suggest_with_params(client)
            test_gaps_cache_invalidation(client)
            test_outfit_missing_items_field(client)
            test_invalid_item_id_paths(client)
        except Exception:
            print(f"\n{FAIL} Unexpected error:")
            traceback.print_exc()
        finally:
            cleanup(client)

    print("\n" + "═" * 60)
    print(f"  Results: {passed} passed, {failed} failed, {skipped} skipped / {total} total")
    print("═" * 60 + "\n")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
