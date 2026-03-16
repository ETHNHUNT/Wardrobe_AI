"""
Iteration 2 — Multi-source product lookup service.

Tries barcode databases in order and returns the first successful result.
Falls back gracefully on every failure so the caller never crashes.

Result format (all fields optional):
{
    "brand": str | None,
    "title": str | None,
    "size": str | None,
    "color": str | None,
    "material": str | None,
    "description": str | None,
    "garment_measurements": dict | None,   # e.g. {"chest_width_cm": 54}
    "category": str | None,               # clothing category hint
    "source": str,                         # which source returned data
}
"""
import os
import re
import json
import base64
import httpx

from services.ai_service import parse_ai_json, OLLAMA_URL, MODEL, gemini_available, _gemini_vision


# ── Source 1: UPCItemDB (existing, no auth) ──────────────────────────────────

async def _lookup_upcitemdb(upc: str) -> dict | None:
    url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={upc}"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
        data = resp.json()
        if data.get("code") != "OK" or not data.get("items"):
            return None
        p = data["items"][0]
        result = {
            "brand":       p.get("brand") or None,
            "title":       p.get("title") or None,
            "size":        p.get("size") or None,
            "color":       p.get("color") or None,
            "description": p.get("description") or None,
            "material":    None,
            "garment_measurements": None,
            "category":    None,
            "source":      "upcitemdb",
        }
        return result if any(v for k, v in result.items() if k not in ("source", "garment_measurements", "material", "category")) else None
    except Exception:
        return None


# ── Source 2: Open GTIN Database (free, no auth) ─────────────────────────────

async def _lookup_opengtindb(upc: str) -> dict | None:
    url = f"https://api.opengtindb.org/?ean={upc}&lang=en&mtype=json"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
        data = resp.json()
        # opengtindb returns {"error": ...} on failure
        if data.get("error") or not data.get("products"):
            return None
        p = data["products"][0]
        title = p.get("description") or p.get("name") or None
        brand = p.get("vendor") or None
        if not title and not brand:
            return None
        return {
            "brand":       brand,
            "title":       title,
            "size":        None,
            "color":       None,
            "description": p.get("comments") or None,
            "material":    None,
            "garment_measurements": None,
            "category":    None,
            "source":      "opengtindb",
        }
    except Exception:
        return None


# ── Source 3: Barcode Spider / barcodelookup.com (requires free API key) ─────

async def _lookup_barcodelookup(upc: str) -> dict | None:
    api_key = os.getenv("BARCODE_LOOKUP_KEY", "")
    if not api_key:
        return None  # Skip if key not configured
    url = f"https://api.barcodelookup.com/v3/products?barcode={upc}&formatted=y&key={api_key}"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
        data = resp.json()
        products = data.get("products", [])
        if not products:
            return None
        p = products[0]
        # Extract material from description/features
        material = None
        description = p.get("description", "") or ""
        material_match = re.search(r'(\d+%\s*\w+(?:\s*,\s*\d+%\s*\w+)*)', description, re.I)
        if material_match:
            material = material_match.group(1)

        return {
            "brand":       p.get("brand") or None,
            "title":       p.get("title") or p.get("product_name") or None,
            "size":        p.get("size") or None,
            "color":       p.get("color") or None,
            "description": description or None,
            "material":    material,
            "garment_measurements": None,
            "category":    p.get("category") or None,
            "source":      "barcodelookup",
        }
    except Exception:
        return None


# ── Source 4: GS1 prefix fallback (extract brand from barcode prefix only) ───

# Well-known GS1 company prefixes → brand name (partial list for major fashion brands)
_GS1_PREFIXES = {
    "885609": "Nike",
    "194502": "Nike",
    "194503": "Nike",
    "193654": "Adidas",
    "4057288": "Adidas",
    "4064878": "Adidas",
    "8718941": "H&M",
    "3614273": "Zara",
    "8422470": "Zara",
    "8718868": "Uniqlo",
    "4549738": "Uniqlo",
    "8718847": "Mango",
    "8422462": "Pull&Bear",
    "8436011": "Bershka",
}

def _extract_from_upc_prefix(upc: str) -> dict | None:
    """Last resort: try to extract brand from GS1 prefix. Returns minimal dict or None."""
    for prefix, brand in _GS1_PREFIXES.items():
        if upc.startswith(prefix):
            return {
                "brand":       brand,
                "title":       None,
                "size":        None,
                "color":       None,
                "description": None,
                "material":    None,
                "garment_measurements": None,
                "category":    None,
                "source":      "gs1_prefix",
            }
    return None


# ── Public API ────────────────────────────────────────────────────────────────

async def lookup_product(upc: str) -> dict | None:
    """
    Try all sources in order, return first successful result.
    Returns None if nothing found in any source.
    """
    for source_fn in (_lookup_upcitemdb, _lookup_opengtindb, _lookup_barcodelookup):
        result = await source_fn(upc)
        if result:
            return result

    # GS1 prefix is synchronous
    return _extract_from_upc_prefix(upc)


# ── Label photo OCR via Ollama vision ────────────────────────────────────────

_LABEL_PROMPT = """You are an expert at reading clothing labels and care tags.
Look at this photo of a clothing label/tag and extract all text information you can read.
Return ONLY valid JSON with no markdown:

{
  "brand": "brand name if visible, else null",
  "size": "size label if visible (XS/S/M/L/XL/XXL or numeric), else null",
  "material": "fabric composition exactly as written (e.g. 100% Cotton, 95% Cotton 5% Elastane), else null",
  "country": "country of manufacture if visible, else null",
  "care_instructions": ["brief care icons or instructions if visible"],
  "other_text": "any other relevant text on label"
}"""


async def lookup_from_label_photo(image_path: str) -> dict:
    """
    Use Ollama vision (primary) or Gemini (fallback) to OCR a clothing label photo.
    Returns dict with extracted fields. Returns {} on failure.
    Does NOT create a ClothingItem — just returns enrichment data.
    """
    raw = ""

    # Try Ollama first
    try:
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode()

        payload = {
            "model": MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": _LABEL_PROMPT,
                    "images": [image_data],
                }
            ],
            "stream": False,
            "options": {"temperature": 0.05},
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)

        raw = resp.json()["message"]["content"]
    except Exception:
        pass

    # Gemini fallback
    if not raw and gemini_available():
        try:
            raw = await _gemini_vision(image_path, _LABEL_PROMPT)
        except Exception:
            pass

    if not raw:
        return {}

    result = parse_ai_json(raw)
    return result if isinstance(result, dict) else {}
