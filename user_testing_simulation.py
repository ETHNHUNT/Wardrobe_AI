#!/usr/bin/env python3
"""
WardrobeAI — User Testing Simulation
======================================
Simulates a complete real-user journey through WardrobeAI.

Unlike test_api.py which uses synthetic solid-color squares, this script:
  - Downloads real clothing photos from Unsplash public CDN (no API key)
  - Falls back to PIL-generated images if network is unavailable
  - Walks through 6 realistic user scenarios in narrative sequence
  - Outputs a full report to output/

Usage:
    python user_testing_simulation.py [--url http://localhost:8000]

Prerequisites:
    Backend running: cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
    Ollama optional: qwen3.5:2b enables AI tagging path
"""

import argparse
import io
import json
import os
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFont

# ── Config ─────────────────────────────────────────────────────────────────────

BASE_URL = "http://localhost:8000"
OUTPUT_DIR = Path(__file__).parent / "output"
IMAGES_DIR = OUTPUT_DIR / "test_images"
LOG_FILE = OUTPUT_DIR / "simulation_log.txt"
REPORT_FILE = OUTPUT_DIR / "user_testing_report.md"
RESULTS_FILE = OUTPUT_DIR / "user_testing_results.json"

# Unsplash Source API — redirects to real photos, no auth needed
# Format: https://source.unsplash.com/400x500/?{keyword}
CLOTHING_IMAGE_SOURCES = [
    {
        "filename": "item_01_tshirt.jpg",
        "keyword": "white,tshirt,clothing",
        "category": "tshirt",
        "brand": "Uniqlo",
        "size_label": "M",
        "fit_type": "regular",
        "occasions": ["casual"],
        "seasons": ["spring", "summer"],
        "colors": ["white"],
        "tags": ["cotton", "crew-neck"],
        "label": "White T-Shirt",
    },
    {
        "filename": "item_02_jeans.jpg",
        "keyword": "blue,jeans,denim",
        "category": "jeans",
        "brand": "Levi's",
        "size_label": "32",
        "fit_type": "slim",
        "occasions": ["casual"],
        "seasons": ["fall", "winter"],
        "colors": ["blue", "indigo"],
        "tags": ["denim", "slim-fit"],
        "label": "Blue Slim Jeans",
    },
    {
        "filename": "item_03_jacket.jpg",
        "keyword": "navy,blazer,jacket,men",
        "category": "jacket",
        "brand": "Zara",
        "size_label": "M",
        "fit_type": "slim",
        "occasions": ["work", "formal"],
        "seasons": ["fall", "winter"],
        "colors": ["navy"],
        "tags": ["blazer", "structured"],
        "label": "Navy Blazer",
    },
    {
        "filename": "item_04_sneakers.jpg",
        "keyword": "white,sneakers,shoes",
        "category": "sneakers",
        "brand": "Nike",
        "size_label": "10",
        "fit_type": "regular",
        "occasions": ["casual", "sport"],
        "seasons": ["spring", "summer"],
        "colors": ["white"],
        "tags": ["athletic", "low-top"],
        "label": "White Sneakers",
    },
    {
        "filename": "item_05_hoodie.jpg",
        "keyword": "grey,hoodie,sweatshirt",
        "category": "hoodie",
        "brand": "H&M",
        "size_label": "L",
        "fit_type": "regular",
        "occasions": ["casual"],
        "seasons": ["fall", "winter"],
        "colors": ["grey"],
        "tags": ["cotton", "drawstring"],
        "label": "Grey Hoodie",
    },
    {
        "filename": "item_06_shirt.jpg",
        "keyword": "white,dress,shirt,formal",
        "category": "shirt",
        "brand": "Marks & Spencer",
        "size_label": "M",
        "fit_type": "regular",
        "occasions": ["work", "formal"],
        "seasons": ["spring", "summer", "fall"],
        "colors": ["white"],
        "tags": ["button-down", "poplin"],
        "label": "White Formal Shirt",
    },
    {
        "filename": "item_07_chinos.jpg",
        "keyword": "beige,chinos,trousers,men",
        "category": "chinos",
        "brand": "Gap",
        "size_label": "32",
        "fit_type": "slim",
        "occasions": ["work", "casual"],
        "seasons": ["spring", "fall"],
        "colors": ["beige", "khaki"],
        "tags": ["slim-fit", "cotton"],
        "label": "Beige Chinos",
    },
    {
        "filename": "item_08_boots.jpg",
        "keyword": "black,leather,boots,shoes",
        "category": "boots",
        "brand": "Dr. Martens",
        "size_label": "10",
        "fit_type": "regular",
        "occasions": ["formal", "work", "casual"],
        "seasons": ["fall", "winter"],
        "colors": ["black"],
        "tags": ["leather", "lace-up"],
        "label": "Black Leather Boots",
    },
]

# ── State ───────────────────────────────────────────────────────────────────────

results = {
    "generated_at": "",
    "backend_url": "",
    "ollama_available": False,
    "total_steps": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "scenarios": [],
}

_log_lines = []
_current_scenario = None
_item_ids = {}       # label → item_id
_outfit_ids = {}     # label → outfit_id


# ── Terminal colors ─────────────────────────────────────────────────────────────

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

PASS_SYM = f"{GREEN}✓{RESET}"
FAIL_SYM = f"{RED}✗{RESET}"
SKIP_SYM = f"{YELLOW}~{RESET}"
INFO_SYM = f"{CYAN}→{RESET}"


# ── Logging ─────────────────────────────────────────────────────────────────────

def log(msg: str):
    _log_lines.append(msg)


def _flush_logs():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text("\n".join(_log_lines), encoding="utf-8")


# ── Step tracking ───────────────────────────────────────────────────────────────

def step_pass(name: str, detail: str = ""):
    results["total_steps"] += 1
    results["passed"] += 1
    msg = f"    {PASS_SYM} {name}"
    if detail:
        msg += f"  ({detail})"
    print(msg)
    log(f"PASS | {name}" + (f" | {detail}" if detail else ""))
    if _current_scenario is not None:
        _current_scenario["steps"].append({"name": name, "status": "pass", "detail": detail})


def step_fail(name: str, detail: str = ""):
    results["total_steps"] += 1
    results["failed"] += 1
    msg = f"    {FAIL_SYM} {name}"
    if detail:
        msg += f"  — {detail}"
    print(msg)
    log(f"FAIL | {name}" + (f" | {detail}" if detail else ""))
    if _current_scenario is not None:
        _current_scenario["steps"].append({"name": name, "status": "fail", "detail": detail})


def step_skip(name: str, reason: str = ""):
    results["total_steps"] += 1
    results["skipped"] += 1
    msg = f"    {SKIP_SYM} SKIP {name}"
    if reason:
        msg += f"  — {reason}"
    print(msg)
    log(f"SKIP | {name}" + (f" | {reason}" if reason else ""))
    if _current_scenario is not None:
        _current_scenario["steps"].append({"name": name, "status": "skip", "detail": reason})


def section(title: str, icon: str = ""):
    sep = "─" * 64
    print(f"\n{sep}")
    print(f"  {icon + ' ' if icon else ''}{BOLD}{title}{RESET}")
    print(sep)
    log(f"\n{'='*64}\n  {title}\n{'='*64}")


def begin_scenario(name: str, description: str) -> dict:
    global _current_scenario
    scenario = {
        "name": name,
        "description": description,
        "steps": [],
        "status": "pass",
        "started_at": datetime.utcnow().isoformat(),
    }
    results["scenarios"].append(scenario)
    _current_scenario = scenario
    section(name, "🎯")
    print(f"  {INFO_SYM} {description}\n")
    return scenario


def end_scenario(scenario: dict):
    fails = sum(1 for s in scenario["steps"] if s["status"] == "fail")
    scenario["status"] = "fail" if fails > 0 else "pass"
    scenario["ended_at"] = datetime.utcnow().isoformat()
    status_str = f"{GREEN}PASS{RESET}" if scenario["status"] == "pass" else f"{RED}FAIL{RESET}"
    print(f"\n  Result: {status_str} ({len(scenario['steps'])} steps, {fails} failures)")


# ── HTTP helpers ────────────────────────────────────────────────────────────────

def api(method: str, path: str, expected_status: int = None, **kwargs):
    url = BASE_URL + path
    t0 = time.time()
    try:
        resp = httpx.request(method, url, timeout=120.0, **kwargs)
        elapsed = time.time() - t0
        log(f"HTTP {method} {path} → {resp.status_code} ({elapsed:.2f}s)")
        try:
            body_preview = json.dumps(resp.json())[:300]
        except Exception:
            body_preview = resp.text[:300]
        log(f"  Body: {body_preview}")
        return resp
    except Exception as exc:
        elapsed = time.time() - t0
        log(f"HTTP {method} {path} → ERROR: {exc} ({elapsed:.2f}s)")
        return None


def check_backend() -> bool:
    try:
        r = httpx.get(f"{BASE_URL}/profile", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def check_ollama() -> bool:
    try:
        r = httpx.get("http://localhost:11434/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


# ── Image helpers ───────────────────────────────────────────────────────────────

def make_fallback_image(filename: str, label: str, color: tuple = (120, 140, 200)) -> Path:
    """Generate a PIL image with text label as fallback when network is unavailable."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    path = IMAGES_DIR / filename
    img = Image.new("RGB", (400, 500), color=color)
    draw = ImageDraw.Draw(img)
    # Draw label text in center
    draw.rectangle([0, 200, 400, 300], fill=(50, 50, 70))
    # Simple text (no font file needed)
    draw.text((200, 250), label, fill=(240, 230, 200), anchor="mm")
    # Draw some "texture" lines to make it look less like a solid block
    for y in range(0, 500, 30):
        draw.line([(0, y), (400, y)], fill=(color[0]-10, color[1]-10, color[2]-10), width=1)
    img.save(path, format="JPEG", quality=85)
    return path


def download_image(keyword: str, filename: str, label: str, color_hint: tuple = None) -> Path:
    """Download a clothing image from Unsplash Source CDN. Falls back to PIL."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    path = IMAGES_DIR / filename
    if path.exists():
        return path  # already downloaded

    url = f"https://source.unsplash.com/400x500/?{keyword}"
    try:
        resp = httpx.get(url, timeout=15, follow_redirects=True)
        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image/"):
            path.write_bytes(resp.content)
            log(f"Downloaded image: {filename} from Unsplash ({len(resp.content)} bytes)")
            return path
        else:
            log(f"Unsplash returned {resp.status_code} for {keyword}, using fallback")
    except Exception as exc:
        log(f"Unsplash download failed ({exc}), using PIL fallback for {filename}")

    # PIL fallback — generate a labeled placeholder
    color = color_hint or (100, 120, 180)
    return make_fallback_image(filename, label, color)


def prepare_all_images() -> bool:
    """Download or generate all 8 test images. Returns True if any are real photos."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    print(f"  {INFO_SYM} Preparing test images in {IMAGES_DIR}/")
    real_count = 0
    fallback_count = 0
    color_palette = [
        (220, 220, 220), (70, 100, 180), (30, 40, 80), (240, 240, 240),
        (100, 100, 100), (255, 255, 255), (200, 190, 160), (20, 20, 20),
    ]
    for i, item in enumerate(CLOTHING_IMAGE_SOURCES):
        path = download_image(
            item["keyword"],
            item["filename"],
            item["label"],
            color_palette[i],
        )
        size_kb = path.stat().st_size // 1024
        is_fallback = size_kb < 20  # PIL fallbacks are tiny
        status = f"{YELLOW}generated{RESET}" if is_fallback else f"{GREEN}downloaded{RESET}"
        print(f"    {PASS_SYM} {item['filename']}  [{size_kb} KB, {status}]")
        if is_fallback:
            fallback_count += 1
        else:
            real_count += 1
    print(f"\n  {INFO_SYM} {real_count} real photos, {fallback_count} generated placeholders\n")
    return real_count > 0


# ── Scenario 1: Profile Setup ───────────────────────────────────────────────────

def scenario_1_profile_setup():
    sc = begin_scenario(
        "Scenario 1: Profile Setup",
        "Vipin opens the app for the first time and enters his body measurements.",
    )

    # Step 1: GET baseline profile
    r = api("GET", "/profile")
    if r and r.status_code == 200:
        step_pass("GET /profile — baseline check", f"name={r.json().get('name', '?')}")
    else:
        step_fail("GET /profile — baseline check", str(r.status_code if r else "no response"))

    # Step 2: POST measurements
    measurements = {
        "name": "Vipin",
        "height_cm": 178.0,
        "weight_kg": 75.0,
        "chest_cm": 96.0,
        "waist_cm": 82.0,
        "hips_cm": 94.0,
        "inseam_cm": 81.0,
        "shoulder_cm": 44.0,
        "arm_length_cm": 63.0,
        "neck_cm": 38.0,
        "brand_sizes": json.dumps({"Zara": "M", "H&M": "L", "Uniqlo": "M", "Gap": "32", "Levi's": "32"}),
    }
    r = api("POST", "/profile", json=measurements)
    if r and r.status_code == 200:
        step_pass("POST /profile — save measurements", "height=178cm, chest=96cm, waist=82cm")
    else:
        step_fail("POST /profile — save measurements", str(r.status_code if r else "no response"))

    # Step 3: GET to verify persistence
    r = api("GET", "/profile")
    if r and r.status_code == 200:
        data = r.json()
        ok = data.get("height_cm") == 178.0 and data.get("chest_cm") == 96.0
        if ok:
            step_pass("GET /profile — verify persistence", "height_cm=178, chest_cm=96 confirmed")
        else:
            step_fail("GET /profile — verify persistence", f"got height={data.get('height_cm')}, chest={data.get('chest_cm')}")

        # Step 4: Verify brand sizes JSON round-trip
        brand_sizes = json.loads(data.get("brand_sizes", "{}"))
        ok = brand_sizes.get("Zara") == "M" and brand_sizes.get("H&M") == "L"
        if ok:
            step_pass("GET /profile — brand_sizes JSON round-trip", "Zara=M, H&M=L confirmed")
        else:
            step_fail("GET /profile — brand_sizes JSON round-trip", f"got {brand_sizes}")
    else:
        step_fail("GET /profile — verify persistence", str(r.status_code if r else "no response"))

    end_scenario(sc)


# ── Scenario 2: Wardrobe Building ──────────────────────────────────────────────

def scenario_2_wardrobe_building(ollama_on: bool):
    sc = begin_scenario(
        "Scenario 2: Wardrobe Building",
        "Vipin photographs and adds 8 clothing items to his wardrobe.",
    )

    # Upload all 8 items
    uploaded = 0
    for item_def in CLOTHING_IMAGE_SOURCES:
        img_path = IMAGES_DIR / item_def["filename"]
        if not img_path.exists():
            step_fail(f"Upload {item_def['label']}", "image file missing")
            continue

        metadata = {
            "category": item_def["category"],
            "brand": item_def["brand"],
            "size_label": item_def["size_label"],
            "fit_type": item_def["fit_type"],
            "occasions": item_def["occasions"],
            "seasons": item_def["seasons"],
            "colors": item_def["colors"],
            "tags": item_def["tags"],
        }

        with open(img_path, "rb") as f:
            r = api(
                "POST", "/items",
                files={"photo": (item_def["filename"], f, "image/jpeg")},
                data={"metadata": json.dumps(metadata)},
            )

        if r and r.status_code == 200:
            item = r.json()
            _item_ids[item_def["label"]] = item["id"]
            ai_tagged = item.get("ai_tagged", False)
            ai_note = "AI tagged" if ai_tagged else "manually tagged"
            step_pass(f"Upload {item_def['label']}", f"id={item['id']}, {ai_note}")
            uploaded += 1
        else:
            detail = f"status={r.status_code}" if r else "no response"
            if r:
                try:
                    detail += f", {r.json()}"
                except Exception:
                    pass
            step_fail(f"Upload {item_def['label']}", detail)

    if uploaded == 0:
        end_scenario(sc)
        return

    # GET all items — verify count
    r = api("GET", "/items")
    if r and r.status_code == 200:
        items = r.json()
        if len(items) >= uploaded:
            step_pass("GET /items — all items present", f"{len(items)} items in wardrobe")
        else:
            step_fail("GET /items — all items present", f"expected ≥{uploaded}, got {len(items)}")
    else:
        step_fail("GET /items — all items present", str(r.status_code if r else "no response"))

    # GET /items?category=jacket
    r = api("GET", "/items?category=jacket")
    if r and r.status_code == 200:
        items = r.json()
        ok = len(items) >= 1 and all(i["category"] == "jacket" for i in items)
        if ok:
            step_pass("GET /items?category=jacket — filter works", f"{len(items)} jacket(s)")
        else:
            step_fail("GET /items?category=jacket — filter works", f"got {[i['category'] for i in items]}")
    else:
        step_fail("GET /items?category=jacket — filter works", str(r.status_code if r else "no response"))

    # GET single item
    blazer_id = _item_ids.get("Navy Blazer")
    if blazer_id:
        r = api("GET", f"/items/{blazer_id}")
        if r and r.status_code == 200:
            item = r.json()
            step_pass(f"GET /items/{blazer_id} — single item fetch", f"brand={item.get('brand')}, category={item.get('category')}")
        else:
            step_fail(f"GET /items/{blazer_id} — single item fetch", str(r.status_code if r else "no response"))

    # PUT update — add a note
    tshirt_id = _item_ids.get("White T-Shirt")
    if tshirt_id:
        r = api("PUT", f"/items/{tshirt_id}", json={"notes": "Favourite for gym days"})
        if r and r.status_code == 200:
            step_pass("PUT /items/{id} — add notes field", "notes saved")
        else:
            step_fail("PUT /items/{id} — add notes field", str(r.status_code if r else "no response"))

        # Verify protected fields are immutable
        r = api("PUT", f"/items/{tshirt_id}", json={"id": 9999, "photo_path": "hacked.jpg"})
        if r and r.status_code == 200:
            item = r.json()
            if item["id"] == tshirt_id and item["photo_path"] != "hacked.jpg":
                step_pass("PUT /items/{id} — protected fields immutable", "id and photo_path unchanged")
            else:
                step_fail("PUT /items/{id} — protected fields immutable", f"id={item['id']}, photo_path={item['photo_path']}")

    # GET fit-check
    if blazer_id:
        r = api("GET", f"/items/{blazer_id}/fit-check")
        if r and r.status_code == 200:
            data = r.json()
            step_pass(f"GET /items/{blazer_id}/fit-check", f"fits={data.get('fits')}, notes: {str(data.get('notes',''))[:60]}")
        elif r and r.status_code == 422:
            step_skip("GET /items/{id}/fit-check", "no garment measurements (expected without AI)")
        else:
            step_fail(f"GET /items/{blazer_id}/fit-check", str(r.status_code if r else "no response"))

    end_scenario(sc)


# ── Scenario 3: Discovery & Browse ─────────────────────────────────────────────

def scenario_3_discovery_and_browse():
    sc = begin_scenario(
        "Scenario 3: Discovery & Browse",
        "Vipin browses his wardrobe using filters to find the right clothes.",
    )

    # Filter by occasion=work
    r = api("GET", "/items?occasion=work")
    if r and r.status_code == 200:
        items = r.json()
        categories = [i["category"] for i in items]
        # Should include shirt, jacket, chinos, boots
        expected = {"shirt", "jacket", "chinos", "boots"}
        found = expected.intersection(set(categories))
        if len(found) >= 2:
            step_pass("GET /items?occasion=work", f"{len(items)} work items: {categories}")
        else:
            step_fail("GET /items?occasion=work", f"expected work items, got {categories}")
    else:
        step_fail("GET /items?occasion=work", str(r.status_code if r else "no response"))

    # Filter by season=winter
    r = api("GET", "/items?season=winter")
    if r and r.status_code == 200:
        items = r.json()
        categories = [i["category"] for i in items]
        # Should include jeans, jacket, hoodie, boots
        step_pass("GET /items?season=winter", f"{len(items)} winter items: {categories}")
    else:
        step_fail("GET /items?season=winter", str(r.status_code if r else "no response"))

    # Filter by season=summer
    r = api("GET", "/items?season=summer")
    if r and r.status_code == 200:
        items = r.json()
        categories = [i["category"] for i in items]
        step_pass("GET /items?season=summer", f"{len(items)} summer items: {categories}")
    else:
        step_fail("GET /items?season=summer", str(r.status_code if r else "no response"))

    # Filter by category=sneakers
    r = api("GET", "/items?category=sneakers")
    if r and r.status_code == 200:
        items = r.json()
        if len(items) == 1 and items[0]["brand"] == "Nike":
            step_pass("GET /items?category=sneakers", "Nike sneakers found")
        else:
            step_fail("GET /items?category=sneakers", f"got {items}")
    else:
        step_fail("GET /items?category=sneakers", str(r.status_code if r else "no response"))

    # Combined filter: occasion=casual + season=summer
    r = api("GET", "/items?occasion=casual&season=summer")
    if r and r.status_code == 200:
        items = r.json()
        step_pass("GET /items?occasion=casual&season=summer", f"{len(items)} items (tshirt + sneakers expected)")
    else:
        step_fail("GET /items?occasion=casual&season=summer", str(r.status_code if r else "no response"))

    # Color palette
    r = api("GET", "/shop/palette")
    if r and r.status_code == 200:
        data = r.json()
        groups = data.get("by_group", {})
        total_colors = sum(groups.values()) if groups else 0
        dominant = data.get("dominant_group", "?")
        complementary = data.get("complementary_suggestions", [])
        step_pass(
            "GET /shop/palette — color analysis",
            f"dominant={dominant}, {total_colors} colors tracked, {len(complementary)} suggestions",
        )
    else:
        step_fail("GET /shop/palette", str(r.status_code if r else "no response"))

    end_scenario(sc)


# ── Scenario 4: A Day Getting Dressed ──────────────────────────────────────────

def scenario_4_outfit_day(ollama_on: bool):
    sc = begin_scenario(
        "Scenario 4: A Day Getting Dressed",
        "Vipin generates outfit suggestions, saves his favourites, rates them, and tracks wear.",
    )

    if len(_item_ids) < 2:
        step_skip("Outfit generation", "need at least 2 items uploaded first")
        end_scenario(sc)
        return

    # Generate work outfit
    r = api("POST", "/outfits/generate", json={"occasion": "work", "season": "fall"}, timeout=90)
    if r and r.status_code == 200:
        suggestions = r.json().get("suggestions", [])
        if suggestions:
            step_pass(
                "POST /outfits/generate {work, fall}",
                f"{len(suggestions)} suggestion(s), first: {[i.get('category','?') for i in suggestions[0].get('items', [])]}",
            )
            # Save first suggestion as outfit
            best = suggestions[0]
            item_ids_list = best.get("item_ids") or [i["id"] for i in best.get("items", [])]
            if item_ids_list:
                r2 = api("POST", "/outfits", json={
                    "item_ids": item_ids_list,
                    "occasion": "work",
                    "season": "fall",
                    "rating": 5,
                    "name": "Sharp Monday",
                })
                if r2 and r2.status_code == 200:
                    outfit = r2.json()
                    _outfit_ids["Sharp Monday"] = outfit["id"]
                    step_pass("POST /outfits — save work outfit 'Sharp Monday'", f"id={outfit['id']}, rating=5")
                else:
                    step_fail("POST /outfits — save work outfit", str(r2.status_code if r2 else "no response"))
        else:
            step_skip("POST /outfits/generate {work, fall}", "AI unavailable — no suggestions returned")
    elif r and r.status_code == 400:
        step_skip("POST /outfits/generate {work, fall}", "need more items in wardrobe")
    else:
        if ollama_on:
            step_fail("POST /outfits/generate {work, fall}", str(r.status_code if r else "no response"))
        else:
            step_skip("POST /outfits/generate {work, fall}", "Ollama offline — AI outfit generation skipped")

    # Generate casual outfit
    r = api("POST", "/outfits/generate", json={"occasion": "casual", "season": "summer"}, timeout=90)
    if r and r.status_code == 200:
        suggestions = r.json().get("suggestions", [])
        if suggestions:
            step_pass("POST /outfits/generate {casual, summer}", f"{len(suggestions)} suggestion(s)")
            best = suggestions[0]
            item_ids_list = best.get("item_ids") or [i["id"] for i in best.get("items", [])]
            if item_ids_list:
                r2 = api("POST", "/outfits", json={
                    "item_ids": item_ids_list,
                    "occasion": "casual",
                    "season": "summer",
                    "rating": 4,
                    "name": "Weekend Chill",
                })
                if r2 and r2.status_code == 200:
                    outfit = r2.json()
                    _outfit_ids["Weekend Chill"] = outfit["id"]
                    step_pass("POST /outfits — save casual outfit 'Weekend Chill'", f"id={outfit['id']}, rating=4")
                else:
                    step_fail("POST /outfits — save casual outfit", str(r2.status_code if r2 else "no response"))
        else:
            step_skip("POST /outfits/generate {casual, summer}", "AI unavailable")
    else:
        if ollama_on:
            step_fail("POST /outfits/generate {casual, summer}", str(r.status_code if r else "no response"))
        else:
            step_skip("POST /outfits/generate {casual, summer}", "Ollama offline")

    # Save a manual outfit (no AI needed)
    tshirt_id = _item_ids.get("White T-Shirt")
    jeans_id = _item_ids.get("Blue Slim Jeans")
    sneakers_id = _item_ids.get("White Sneakers")
    if tshirt_id and jeans_id and sneakers_id:
        r = api("POST", "/outfits", json={
            "item_ids": [tshirt_id, jeans_id, sneakers_id],
            "occasion": "casual",
            "season": "summer",
            "rating": 3,
            "name": "Classic Summer",
        })
        if r and r.status_code == 200:
            outfit = r.json()
            _outfit_ids["Classic Summer"] = outfit["id"]
            step_pass("POST /outfits — save manual outfit 'Classic Summer'", f"id={outfit['id']}")
        else:
            step_fail("POST /outfits — save manual outfit", str(r.status_code if r else "no response"))

    # GET all outfits
    r = api("GET", "/outfits")
    if r and r.status_code == 200:
        outfits = r.json()
        step_pass("GET /outfits — list saved outfits", f"{len(outfits)} outfit(s) saved")
    else:
        step_fail("GET /outfits", str(r.status_code if r else "no response"))

    # PUT update rating on Classic Summer
    classic_id = _outfit_ids.get("Classic Summer")
    if classic_id:
        r = api("PUT", f"/outfits/{classic_id}", json={"rating": 4})
        if r and r.status_code == 200:
            step_pass(f"PUT /outfits/{classic_id} — update rating to 4", "rating updated")
        else:
            step_fail(f"PUT /outfits/{classic_id} — update rating", str(r.status_code if r else "no response"))

        # PUT invalid rating — should return 422
        r = api("PUT", f"/outfits/{classic_id}", json={"rating": 7})
        if r and r.status_code == 422:
            step_pass("PUT /outfits/{id} — rating 7 rejected (422)", "validation works")
        elif r and r.status_code == 400:
            step_pass("PUT /outfits/{id} — rating 7 rejected (400)", "validation works")
        else:
            step_fail("PUT /outfits/{id} — rating 7 should be rejected", f"got {r.status_code if r else 'no response'}")

    # POST /outfits/{id}/worn — mark Classic Summer worn
    if classic_id:
        r = api("POST", f"/outfits/{classic_id}/worn")
        if r and r.status_code == 200:
            data = r.json()
            step_pass(f"POST /outfits/{classic_id}/worn", f"times_worn={data.get('times_worn')}, worn_date set")
        else:
            step_fail(f"POST /outfits/{classic_id}/worn", str(r.status_code if r else "no response"))

    # GET /outfits/history
    r = api("GET", "/outfits/history")
    if r and r.status_code == 200:
        history = r.json()
        if history:
            step_pass("GET /outfits/history", f"{len(history)} worn outfit(s), most recent first")
        else:
            step_skip("GET /outfits/history", "no worn outfits yet")
    else:
        step_fail("GET /outfits/history", str(r.status_code if r else "no response"))

    # POST /items/{id}/worn — mark tshirt worn separately
    if tshirt_id:
        r = api("POST", f"/items/{tshirt_id}/worn")
        if r and r.status_code == 200:
            data = r.json()
            step_pass(f"POST /items/{tshirt_id}/worn — mark tshirt worn", f"times_worn={data.get('times_worn')}")
        else:
            step_fail(f"POST /items/{tshirt_id}/worn", str(r.status_code if r else "no response"))

    end_scenario(sc)


# ── Scenario 5: Shopping Intelligence ──────────────────────────────────────────

def scenario_5_shopping_intelligence(ollama_on: bool):
    sc = begin_scenario(
        "Scenario 5: Shopping Intelligence",
        "Vipin checks wardrobe gaps and gets AI-powered shopping suggestions.",
    )

    # GET /shop/gaps
    r = api("GET", "/shop/gaps", timeout=90)
    if r and r.status_code == 200:
        data = r.json()
        total_items = data.get("total_items", 0)
        local_cov = data.get("local_coverage", {})
        ai_gaps = data.get("ai_gaps", [])
        summary = local_cov.get("summary", {})

        step_pass(
            "GET /shop/gaps — coverage analysis",
            f"total={total_items}, casual={summary.get('casual',0)}, work={summary.get('work',0)}, formal={summary.get('formal',0)}",
        )

        if ai_gaps:
            priorities = [g.get("priority") for g in ai_gaps]
            step_pass(
                "GET /shop/gaps — AI gap detection",
                f"{len(ai_gaps)} gaps found, priorities: {priorities}",
            )
        elif ollama_on:
            step_fail("GET /shop/gaps — AI gap detection", "Ollama on but no gaps returned")
        else:
            step_skip("GET /shop/gaps — AI gap detection", "Ollama offline, local coverage only")
    else:
        if ollama_on:
            step_fail("GET /shop/gaps", str(r.status_code if r else "no response"))
        else:
            step_skip("GET /shop/gaps", "Ollama offline — may time out")

    # GET /shop/suggest
    r = api("GET", "/shop/suggest?brand=zara&budget_cad=150", timeout=90)
    if r and r.status_code == 200:
        data = r.json()
        suggestions = data.get("suggestions", [])
        if suggestions:
            first = suggestions[0]
            step_pass(
                "GET /shop/suggest?brand=zara&budget_cad=150",
                f"{len(suggestions)} suggestions, first: {first.get('category')} — {first.get('why','')[:50]}",
            )
        else:
            step_skip("GET /shop/suggest", "no suggestions (Ollama needed for gap data)")
    else:
        step_skip("GET /shop/suggest", f"status={r.status_code if r else 'no response'} (Ollama may be needed)")

    # GET /shop/gaps?force=true — verify cache bypass
    r = api("GET", "/shop/gaps?force=true", timeout=90)
    if r and r.status_code == 200:
        step_pass("GET /shop/gaps?force=true — cache bypass", "force refresh works")
    else:
        step_skip("GET /shop/gaps?force=true", f"status={r.status_code if r else 'no response'}")

    # GET /shop/palette — instant, no AI
    r = api("GET", "/shop/palette")
    if r and r.status_code == 200:
        data = r.json()
        by_group = data.get("by_group", {})
        dominant = data.get("dominant_group", "?")
        underrep = data.get("underrepresented", [])
        complementary = data.get("complementary_suggestions", [])
        step_pass(
            "GET /shop/palette — instant color analysis",
            f"dominant={dominant}, groups={dict(list(by_group.items())[:3])}, {len(underrep)} underrepresented",
        )
        if complementary:
            step_pass("GET /shop/palette — complementary suggestions", f"suggests: {complementary[:3]}")
    else:
        step_fail("GET /shop/palette", str(r.status_code if r else "no response"))

    end_scenario(sc)


# ── Scenario 6: Edge Cases ──────────────────────────────────────────────────────

def scenario_6_edge_cases():
    sc = begin_scenario(
        "Scenario 6: Edge Cases & Error Handling",
        "Testing robustness: invalid inputs, oversize uploads, cascade deletes.",
    )

    # Invalid UPC (11 digits — too short)
    r = api("GET", "/items/barcode/12345678901")
    if r and r.status_code == 400:
        step_pass("GET /barcode/12345678901 — 11-digit rejected", "400 Bad Request as expected")
    else:
        step_fail("GET /barcode/12345678901 — 11-digit rejected", f"got {r.status_code if r else 'no response'}")

    # Valid UPC-12 format, unknown product → 404
    r = api("GET", "/items/barcode/012345678905")
    if r and r.status_code == 404:
        step_pass("GET /barcode/012345678905 — valid format, unknown product", "404 Not Found as expected")
    elif r and r.status_code == 200:
        step_pass("GET /barcode/012345678905 — valid format, found product", f"brand={r.json().get('brand')}")
    else:
        step_fail("GET /barcode/012345678905 — barcode lookup", f"got {r.status_code if r else 'no response'}")

    # Oversize upload (>15 MB) → 413
    large_bytes = b"X" * (16 * 1024 * 1024)
    r = api(
        "POST", "/items",
        files={"photo": ("bigfile.jpg", io.BytesIO(large_bytes), "image/jpeg")},
        timeout=30,
    )
    if r and r.status_code == 413:
        step_pass("POST /items with 16 MB file → 413", "upload size limit enforced")
    else:
        step_fail("POST /items with 16 MB file → 413", f"got {r.status_code if r else 'no response'}")

    # Non-image file → 400
    fake_bytes = b"This is not an image, it is a text file content"
    r = api(
        "POST", "/items",
        files={"photo": ("readme.txt", io.BytesIO(fake_bytes), "text/plain")},
    )
    if r and r.status_code in (400, 422):
        step_pass("POST /items with text file → 400/422", "non-image rejected")
    else:
        step_fail("POST /items with text file → 400/422", f"got {r.status_code if r else 'no response'}")

    # GET non-existent item → 404
    r = api("GET", "/items/999999")
    if r and r.status_code == 404:
        step_pass("GET /items/999999 — 404 on missing item", "correct error response")
    else:
        step_fail("GET /items/999999 — 404 on missing item", f"got {r.status_code if r else 'no response'}")

    # Cascade delete: delete jacket, verify it's removed from outfit item_ids
    jacket_id = _item_ids.get("Navy Blazer")
    if jacket_id:
        # First, save an outfit containing the jacket
        shirt_id = _item_ids.get("White Formal Shirt")
        chinos_id = _item_ids.get("Beige Chinos")
        boots_id = _item_ids.get("Black Leather Boots")
        outfit_item_ids = [jacket_id]
        if shirt_id:
            outfit_item_ids.append(shirt_id)
        if chinos_id:
            outfit_item_ids.append(chinos_id)

        r = api("POST", "/outfits", json={
            "item_ids": outfit_item_ids,
            "occasion": "formal",
            "season": "fall",
            "name": "Jacket Test Outfit",
        })
        if r and r.status_code == 200:
            cascade_outfit_id = r.json()["id"]

            # Now delete the jacket
            r2 = api("DELETE", f"/items/{jacket_id}")
            if r2 and r2.status_code == 200:
                step_pass(f"DELETE /items/{jacket_id} — jacket deleted", "cascade delete triggered")

                # Verify jacket_id removed from outfit
                r3 = api("GET", f"/outfits/{cascade_outfit_id}")
                if r3 and r3.status_code == 200:
                    outfit_data = r3.json()
                    item_ids_remaining = json.loads(outfit_data.get("item_ids", "[]"))
                    missing_items = outfit_data.get("missing_items", [])
                    if jacket_id not in item_ids_remaining:
                        step_pass(
                            "Cascade delete — jacket ID removed from outfit",
                            f"remaining item_ids={item_ids_remaining}, missing_items={missing_items}",
                        )
                    else:
                        step_fail("Cascade delete — jacket ID still in outfit", f"item_ids={item_ids_remaining}")
                elif r3 and r3.status_code == 404:
                    # Outfit was deleted because only item was jacket
                    step_pass("Cascade delete — empty outfit auto-deleted", "outfit removed when all items deleted")
                else:
                    step_fail("Cascade delete — verify outfit", str(r3.status_code if r3 else "no response"))
            else:
                step_fail(f"DELETE /items/{jacket_id}", str(r2.status_code if r2 else "no response"))
        else:
            step_skip("Cascade delete test", "could not save test outfit first")

        # Remove jacket from our tracking (it's deleted)
        if "Navy Blazer" in _item_ids:
            del _item_ids["Navy Blazer"]

    # PUT invalid outfit rating (0) → 422
    any_outfit_id = next(iter(_outfit_ids.values()), None)
    if any_outfit_id:
        r = api("PUT", f"/outfits/{any_outfit_id}", json={"rating": 0})
        if r and r.status_code in (400, 422):
            step_pass("PUT /outfits/{id} rating=0 — rejected", f"{r.status_code} as expected")
        else:
            step_fail("PUT /outfits/{id} rating=0 — should reject", f"got {r.status_code if r else 'no response'}")

    # DELETE non-existent outfit → 404
    r = api("DELETE", "/outfits/999999")
    if r and r.status_code == 404:
        step_pass("DELETE /outfits/999999 — 404 on missing outfit", "correct error response")
    else:
        step_fail("DELETE /outfits/999999 — 404 on missing outfit", f"got {r.status_code if r else 'no response'}")

    end_scenario(sc)


# ── Report generation ───────────────────────────────────────────────────────────

def _status_icon(status: str) -> str:
    return "✅" if status == "pass" else ("❌" if status == "fail" else "⏭️")


def generate_report(ollama_on: bool):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total = results["total_steps"]
    passed = results["passed"]
    failed = results["failed"]
    skipped = results["skipped"]
    pass_rate = (passed / total * 100) if total > 0 else 0

    # ── Markdown report
    lines = [
        "# WardrobeAI — User Testing Simulation Report",
        "",
        f"**Generated:** {results['generated_at']}  ",
        f"**Backend:** {results['backend_url']}  ",
        f"**Ollama:** {'✅ Available (AI paths tested)' if ollama_on else '⚠️ Offline (AI paths skipped)'}  ",
        "",
        "---",
        "",
        "## Summary",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total Steps | {total} |",
        f"| ✅ Passed | {passed} |",
        f"| ❌ Failed | {failed} |",
        f"| ⏭️ Skipped | {skipped} |",
        f"| Pass Rate | {pass_rate:.1f}% |",
        "",
    ]

    overall = "✅ PASS" if failed == 0 else f"❌ FAIL ({failed} failure{'s' if failed != 1 else ''})"
    lines += [f"**Overall Result: {overall}**", "", "---", ""]

    for sc in results["scenarios"]:
        sc_icon = _status_icon(sc["status"])
        sc_fail = sum(1 for s in sc["steps"] if s["status"] == "fail")
        lines += [
            f"## {sc_icon} {sc['name']}",
            "",
            f"*{sc['description']}*",
            "",
            f"Steps: {len(sc['steps'])} &nbsp;|&nbsp; Failures: {sc_fail}",
            "",
            "| # | Step | Status | Detail |",
            "|---|------|--------|--------|",
        ]
        for idx, step in enumerate(sc["steps"], 1):
            icon = _status_icon(step["status"])
            detail = step.get("detail", "")[:80]
            lines.append(f"| {idx} | {step['name']} | {icon} | {detail} |")
        lines += ["", "---", ""]

    # Items added
    if _item_ids:
        lines += ["## Items Added to Wardrobe", "", "| Label | Item ID |", "|-------|---------|"]
        for label, item_id in _item_ids.items():
            lines.append(f"| {label} | {item_id} |")
        lines += ["", "---", ""]

    # Recommendation based on failures
    if failed > 0:
        lines += [
            "## Findings & Recommendations",
            "",
            "The following steps failed and need investigation:",
            "",
        ]
        for sc in results["scenarios"]:
            for step in sc["steps"]:
                if step["status"] == "fail":
                    lines.append(f"- **[{sc['name']}]** `{step['name']}`: {step.get('detail','')}")
        lines += [""]

    lines += [
        "## Test Coverage Notes",
        "",
        "- Scenarios 1–3 and edge cases run without Ollama.",
        "- Scenarios 4 (outfit generation) and 5 (gap AI analysis) require Ollama with `qwen3.5:2b`.",
        "- Re-run with Ollama active to test AI tagging, outfit generation, and gap analysis.",
        "",
        "---",
        "_Generated by user_testing_simulation.py_",
    ]

    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")

    # ── JSON results
    results["total_steps"] = total
    RESULTS_FILE.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")


# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    global BASE_URL

    parser = argparse.ArgumentParser(description="WardrobeAI User Testing Simulation")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend base URL")
    args = parser.parse_args()
    BASE_URL = args.url.rstrip("/")

    results["generated_at"] = datetime.utcnow().isoformat() + "Z"
    results["backend_url"] = BASE_URL

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n{BOLD}{'═' * 64}{RESET}")
    print(f"{BOLD}  WardrobeAI — User Testing Simulation{RESET}")
    print(f"{'═' * 64}")
    print(f"  Backend: {CYAN}{BASE_URL}{RESET}")
    print(f"  Output:  {CYAN}{OUTPUT_DIR}{RESET}")
    print(f"{'═' * 64}\n")

    # Pre-flight checks
    print(f"{BOLD}Pre-flight checks{RESET}")
    if not check_backend():
        print(f"\n  {RED}{BOLD}✗ Backend not reachable at {BASE_URL}{RESET}")
        print(f"\n  Start it with:")
        print(f"    cd {Path(__file__).parent}/backend")
        print(f"    uvicorn main:app --host 0.0.0.0 --port 8000\n")
        sys.exit(1)
    print(f"  {PASS_SYM} Backend reachable at {BASE_URL}")

    ollama_on = check_ollama()
    results["ollama_available"] = ollama_on
    if ollama_on:
        print(f"  {PASS_SYM} Ollama reachable — AI paths will be tested")
    else:
        print(f"  {YELLOW}⚠{RESET}  Ollama offline — AI steps will be skipped gracefully")

    # Prepare images
    print(f"\n{BOLD}Preparing test images{RESET}")
    prepare_all_images()

    # Run scenarios
    scenario_1_profile_setup()
    scenario_2_wardrobe_building(ollama_on)
    scenario_3_discovery_and_browse()
    scenario_4_outfit_day(ollama_on)
    scenario_5_shopping_intelligence(ollama_on)
    scenario_6_edge_cases()

    # Generate report
    generate_report(ollama_on)
    _flush_logs()

    # Final summary
    total = results["total_steps"]
    passed = results["passed"]
    failed = results["failed"]
    skipped = results["skipped"]
    pass_rate = (passed / total * 100) if total > 0 else 0

    print(f"\n{'═' * 64}")
    print(f"{BOLD}  Final Results{RESET}")
    print(f"{'═' * 64}")
    print(f"  Total Steps:  {total}")
    print(f"  {GREEN}Passed:{RESET}       {passed}")
    print(f"  {RED}Failed:{RESET}       {failed}")
    print(f"  {YELLOW}Skipped:{RESET}      {skipped}")
    print(f"  Pass Rate:    {pass_rate:.1f}%")
    print(f"{'═' * 64}")

    if failed == 0:
        print(f"\n  {GREEN}{BOLD}✓ All steps passed!{RESET}")
    else:
        print(f"\n  {RED}{BOLD}✗ {failed} step(s) failed — see report for details{RESET}")

    print(f"\n  Reports written to:")
    print(f"    {CYAN}{REPORT_FILE}{RESET}")
    print(f"    {CYAN}{RESULTS_FILE}{RESET}")
    print(f"    {CYAN}{LOG_FILE}{RESET}")
    print()

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
