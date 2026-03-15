#!/bin/bash
# WardrobeAI Full Verification Script
# =====================================
# Runs all test loops without any manual intervention.
# Usage: bash scripts/verify.sh [--keep-db]
#
# Loops:
#   1 — Existing test_api.py (baseline)
#   2 — Adversarial test suite
#   3 — Combined re-run (if either loop had failures)
#   4 — Stress battery (10 items, filters, cascades)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$REPO_ROOT/backend"
KEEP_DB="${1:-}"
UVICORN_PID=""
LOOP1_STATUS=0
LOOP2_STATUS=0
LOOP3_STATUS=0
LOOP4_STATUS=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${NC}[verify] $*"; }
ok()    { echo -e "${GREEN}[verify] ✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}[verify] ~ $*${NC}"; }
err()   { echo -e "${RED}[verify] ✗ $*${NC}"; }

cleanup_backend() {
    if [ -n "$UVICORN_PID" ] && kill -0 "$UVICORN_PID" 2>/dev/null; then
        log "Stopping uvicorn (PID $UVICORN_PID)..."
        kill "$UVICORN_PID" 2>/dev/null || true
        wait "$UVICORN_PID" 2>/dev/null || true
    fi
    # Belt-and-suspenders: kill any leftover uvicorn on port 8000
    pkill -f "uvicorn main:app" 2>/dev/null || true
}

trap cleanup_backend EXIT

# ── Setup ──────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  WardrobeAI Verification Suite"
echo "════════════════════════════════════════════════════════════"

cd "$BACKEND_DIR"

# Kill any existing uvicorn on 8000
pkill -f "uvicorn main:app" 2>/dev/null || true
sleep 0.5

# Fresh DB unless --keep-db passed
if [ "$KEEP_DB" != "--keep-db" ]; then
    log "Clearing database and images for clean slate..."
    rm -f wardrobe.db
    rm -rf data/images/
    ok "Clean slate ready"
fi

# Start backend
log "Starting uvicorn backend..."
uvicorn main:app --host 127.0.0.1 --port 8000 > /tmp/uvicorn_verify.log 2>&1 &
UVICORN_PID=$!
log "Uvicorn started with PID $UVICORN_PID"

# Wait for backend to be ready (max 20s)
READY=0
for i in $(seq 1 20); do
    if curl -s http://localhost:8000/profile > /dev/null 2>&1; then
        READY=1
        ok "Backend ready after ${i}s"
        break
    fi
    sleep 1
done

if [ "$READY" -eq 0 ]; then
    err "Backend did not start within 20s. Log:"
    cat /tmp/uvicorn_verify.log
    exit 1
fi

# ── Loop 1: Existing test_api.py ───────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  LOOP 1 — test_api.py (baseline)"
echo "════════════════════════════════════════════════════════════"

python test_api.py && LOOP1_STATUS=0 || LOOP1_STATUS=$?

if [ "$LOOP1_STATUS" -eq 0 ]; then
    ok "Loop 1: ALL PASS"
else
    err "Loop 1: FAILURES DETECTED (exit code $LOOP1_STATUS)"
fi

# ── Loop 2: Adversarial tests ──────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  LOOP 2 — test_adversarial.py (adversarial)"
echo "════════════════════════════════════════════════════════════"

python test_adversarial.py && LOOP2_STATUS=0 || LOOP2_STATUS=$?

if [ "$LOOP2_STATUS" -eq 0 ]; then
    ok "Loop 2: ALL PASS"
else
    err "Loop 2: FAILURES DETECTED (exit code $LOOP2_STATUS)"
fi

# ── Loop 3: Combined re-run (always run) ──────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  LOOP 3 — Combined re-run (both suites)"
echo "════════════════════════════════════════════════════════════"

python test_api.py && LOOP3A_STATUS=0 || LOOP3A_STATUS=$?
python test_adversarial.py && LOOP3B_STATUS=0 || LOOP3B_STATUS=$?

if [ "${LOOP3A_STATUS:-0}" -eq 0 ] && [ "${LOOP3B_STATUS:-0}" -eq 0 ]; then
    ok "Loop 3: ALL PASS"
    LOOP3_STATUS=0
else
    err "Loop 3: FAILURES — test_api.py=$LOOP3A_STATUS adversarial=$LOOP3B_STATUS"
    LOOP3_STATUS=1
fi

# ── Loop 4: Stress battery ─────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  LOOP 4 — Stress battery (10 items, filters, cascades)"
echo "════════════════════════════════════════════════════════════"

python - <<'PYEOF'
import io, json, sys
import httpx
from PIL import Image

BASE = "http://localhost:8000"
PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
total = passed = failed = 0

def check(name, cond, detail=""):
    global total, passed, failed
    total += 1
    if cond:
        passed += 1
        print(f"  {PASS} {name}")
    else:
        failed += 1
        print(f"  {FAIL} {name}" + (f" — {detail}" if detail else ""))

def make_image():
    img = Image.new("RGB", (60, 60), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

client = httpx.Client(base_url=BASE, timeout=60)

# Upload 10 items with 2 distinct categories
print("\n  ── Uploading 10 items ──")
item_ids = []
for i in range(10):
    cat = "tshirt" if i < 5 else "jeans"
    occ = ["casual"] if i < 3 else ["work", "formal"]
    r = client.post("/items",
        files={"photo": ("img.jpg", make_image(), "image/jpeg")},
        data={"metadata": json.dumps({"category": cat, "occasions": occ, "seasons": ["spring"]})},
    )
    if r.status_code in (200, 201):
        item_ids.append(r.json()["id"])
    else:
        print(f"  Upload {i} failed: {r.status_code}")

check("All 10 items uploaded", len(item_ids) == 10, f"got {len(item_ids)}")

# GET /items — all 10 present
all_ids = {i["id"] for i in client.get("/items").json()}
check("All 10 items in GET /items", all(i in all_ids for i in item_ids))

# Filter by category
tshirts = client.get("/items?category=tshirt").json()
jeans = client.get("/items?category=jeans").json()
check("category=tshirt returns 5 (new) items (may be more if DB not clean)", len([i for i in tshirts if i["id"] in item_ids]) == 5, f"got {len(tshirts)} total")
check("category=jeans returns 5 (new) items", len([i for i in jeans if i["id"] in item_ids]) == 5, f"got {len(jeans)} total")

# GET /shop/gaps — valid response
r = client.get("/shop/gaps?force=true", timeout=30)
check("GET /shop/gaps returns 200 with items in wardrobe", r.status_code == 200)
data = r.json()
check("total_items >= 10", data.get("total_items", 0) >= 10, f"got {data.get('total_items')}")
cov = data.get("local_coverage", {})
check("casual coverage >= 3", cov.get("counts", {}).get("casual", 0) >= 3, f"counts={cov.get('counts')}")

# GET /shop/palette — has color data
r = client.get("/shop/palette")
check("GET /shop/palette returns 200", r.status_code == 200)

# Delete 5 items and verify wardrobe shrinks
for item_id in item_ids[:5]:
    r = client.delete(f"/items/{item_id}")
    check(f"DELETE item {item_id} returns 200", r.status_code == 200)

remaining = {i["id"] for i in client.get("/items").json()}
for item_id in item_ids[:5]:
    check(f"Deleted item {item_id} gone from wardrobe", item_id not in remaining)
for item_id in item_ids[5:]:
    check(f"Kept item {item_id} still in wardrobe", item_id in remaining)

# Cleanup remaining 5
for item_id in item_ids[5:]:
    client.delete(f"/items/{item_id}")

client.close()

print(f"\n  Results: {passed} passed, {failed} failed / {total} total")
sys.exit(1 if failed > 0 else 0)
PYEOF
LOOP4_STATUS=$?

if [ "$LOOP4_STATUS" -eq 0 ]; then
    ok "Loop 4: ALL PASS"
else
    err "Loop 4: FAILURES DETECTED"
fi

# ── Final Report ───────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  FINAL REPORT"
echo "════════════════════════════════════════════════════════════"
echo ""

print_status() {
    local loop="$1"
    local status="$2"
    if [ "$status" -eq 0 ]; then
        echo -e "  ${GREEN}✓ Loop $loop: PASS${NC}"
    else
        echo -e "  ${RED}✗ Loop $loop: FAIL (exit $status)${NC}"
    fi
}

print_status "1 (baseline test_api.py)" "$LOOP1_STATUS"
print_status "2 (adversarial tests)" "$LOOP2_STATUS"
print_status "3 (combined re-run)" "$LOOP3_STATUS"
print_status "4 (stress battery)" "$LOOP4_STATUS"

echo ""
OVERALL=$((LOOP1_STATUS + LOOP2_STATUS + LOOP3_STATUS + LOOP4_STATUS))
if [ "$OVERALL" -eq 0 ]; then
    echo -e "  ${GREEN}ALL LOOPS PASSED — app is verified ✓${NC}"
else
    echo -e "  ${RED}SOME LOOPS FAILED — see output above for details${NC}"
fi
echo ""

exit $OVERALL
