"""
Color palette intelligence service — powered by Sanzo Wada's
"A Dictionary of Color Combinations" (348 curated palettes, 159 colors).

Maps clothing colors to nearest Sanzo Wada color via CIE76 LAB distance,
then uses the 348 expert-curated palettes for harmony scoring.
No Ollama calls — pure Python logic, instant.
"""
import json
import math
from collections import Counter
from functools import lru_cache
from pathlib import Path

# ── Load Sanzo Wada data ────────────────────────────────────────────────────

_DATA_PATH = Path(__file__).parent / "sanzo_wada_data.json"

with open(_DATA_PATH) as _f:
    SANZO_COLORS: list[dict] = json.load(_f)

# Build palette lookup: palette_id → list of color dicts
PALETTES: dict[int, list[dict]] = {}
for _c in SANZO_COLORS:
    for _pid in _c["combinations"]:
        PALETTES.setdefault(_pid, []).append(_c)

# Build color → set of palette IDs for fast lookup
_COLOR_PALETTES: dict[str, set[int]] = {}
for _c in SANZO_COLORS:
    _COLOR_PALETTES[_c["name"]] = set(_c["combinations"])

# Sanzo swatch chapters (0-5) roughly map to color families
_SWATCH_NAMES = {
    0: "pinks_reds",
    1: "oranges_yellows",
    2: "greens",
    3: "blues",
    4: "purples_violets",
    5: "browns_neutrals",
}

# ── Clothing color name → hex mapping (from frontend/lib/colors.js) ─────────
# Used to resolve AI-tagged color names to hex for LAB conversion

_CLOTHING_COLOR_HEX: dict[str, str] = {
    "black": "#1a1a1a", "white": "#f5f5f5", "grey": "#808080", "gray": "#808080",
    "charcoal": "#36454f", "offwhite": "#faf0e6", "cream": "#fffdd0",
    "ivory": "#fffff0", "beige": "#f5f0e8", "nude": "#e3bc9a",
    "navy": "#1a2744", "blue": "#2980b9", "cobalt": "#0047ab",
    "royalblue": "#4169e1", "slate": "#708090", "indigo": "#4b0082",
    "denim": "#1560bd", "teal": "#008080", "cyan": "#00bcd4",
    "lightblue": "#add8e6", "skyblue": "#87ceeb", "powderblue": "#b0e0e6",
    "red": "#c0392b", "burgundy": "#6d2b3d", "maroon": "#800000",
    "wine": "#722f37", "crimson": "#dc143c", "rust": "#b45309",
    "brick": "#cb4154", "orange": "#e67e22", "coral": "#ff7f50",
    "terracotta": "#e2725b", "pink": "#e91e8c", "hotpink": "#ff69b4",
    "blush": "#de5d83", "salmon": "#fa8072",
    "brown": "#7a4f2e", "camel": "#c19a6b", "khaki": "#c3b091",
    "olive": "#6b6b2f", "tan": "#d2b48c", "sand": "#c2b280",
    "taupe": "#483c32", "mocha": "#967969", "chocolate": "#7b3f00",
    "mustard": "#e1ad01", "forestgreen": "#228b22", "huntergreen": "#355e3b",
    "yellow": "#f1c40f", "lime": "#32cd32", "green": "#27ae60",
    "purple": "#8e44ad", "violet": "#7f00ff", "lavender": "#e6e6fa",
    "magenta": "#ff00ff", "fuchsia": "#ff00ff", "mint": "#98ff98",
    "turquoise": "#40e0d0", "gold": "#ffd700", "silver": "#c0c0c0",
}


# ── LAB conversion utilities ────────────────────────────────────────────────

def _hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _rgb_to_lab(r: int, g: int, b: int) -> tuple[float, float, float]:
    """Convert sRGB to CIE L*a*b* (D50 illuminant for consistency with Sanzo data)."""
    # sRGB → linear RGB
    def linearize(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    rl, gl, bl = linearize(r), linearize(g), linearize(b)

    # Linear RGB → XYZ (D50 adapted)
    x = rl * 0.4360747 + gl * 0.3850649 + bl * 0.1430804
    y = rl * 0.2225045 + gl * 0.7168786 + bl * 0.0606169
    z = rl * 0.0139322 + gl * 0.0971045 + bl * 0.7141733

    # XYZ → Lab (D50 reference: 0.9642, 1.0, 0.8251)
    xr, yr, zr = x / 0.9642, y / 1.0, z / 0.8251

    def f(t):
        return t ** (1/3) if t > 0.008856 else (7.787 * t) + 16/116

    L = 116 * f(yr) - 16
    a = 500 * (f(xr) - f(yr))
    b_val = 200 * (f(yr) - f(zr))
    return L, a, b_val


def _lab_distance(lab1: tuple, lab2: tuple) -> float:
    """CIE76 color difference (Euclidean in L*a*b*)."""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(lab1, lab2)))


# ── Nearest Sanzo color matching ────────────────────────────────────────────

@lru_cache(maxsize=512)
def find_nearest_sanzo_color(color_name: str) -> dict | None:
    """Map a clothing color name to the nearest Sanzo Wada color via LAB distance.

    Returns the Sanzo color dict (name, hex, rgb, lab, combinations, swatch) or None.
    """
    norm = color_name.lower().strip().replace("-", "").replace("_", "").replace(" ", "")

    # Try direct hex lookup from our clothing color map
    hex_val = _CLOTHING_COLOR_HEX.get(norm)
    if not hex_val:
        # Try with spaces/hyphens variants
        for key, val in _CLOTHING_COLOR_HEX.items():
            if key.replace(" ", "") == norm:
                hex_val = val
                break

    if not hex_val:
        return None

    r, g, b = _hex_to_rgb(hex_val)
    target_lab = _rgb_to_lab(r, g, b)

    best = None
    best_dist = float("inf")
    for sc in SANZO_COLORS:
        dist = _lab_distance(target_lab, tuple(sc["lab"]))
        if dist < best_dist:
            best_dist = dist
            best = sc

    return best


# ── Color compatibility scoring (Sanzo palette-based) ───────────────────────

def are_colors_compatible(color_a: str, color_b: str) -> float:
    """Score pairwise compatibility: 0.0 (clash) → 1.0 (perfect).

    Based on shared Sanzo Wada palettes between nearest matches.
    """
    sc_a = find_nearest_sanzo_color(color_a)
    sc_b = find_nearest_sanzo_color(color_b)

    if sc_a is None or sc_b is None:
        return 0.4  # Unknown color → slight positive

    if sc_a["name"] == sc_b["name"]:
        return 0.7  # Same color — tonal, works but less interesting

    pals_a = _COLOR_PALETTES[sc_a["name"]]
    pals_b = _COLOR_PALETTES[sc_b["name"]]

    shared = len(pals_a & pals_b)
    if shared == 0:
        return 0.15  # No shared palettes — not proven by Sanzo

    max_pals = max(len(pals_a), len(pals_b), 1)
    return min(0.5 + (shared / max_pals) * 0.5, 1.0)


def get_palette_harmony_score(colors: list[str]) -> float:
    """Score overall color harmony for a set of colors (e.g., an outfit).

    Checks if all colors appear together in any single Sanzo palette.
    Full palette match = 1.0, N-1 match = 0.8, pairwise average otherwise.
    """
    if len(colors) < 2:
        return 1.0

    sanzo_matches = []
    for c in colors:
        sc = find_nearest_sanzo_color(c)
        if sc:
            sanzo_matches.append(sc)

    if len(sanzo_matches) < 2:
        return 0.4  # Can't evaluate with <2 recognized colors

    # Check for full palette match
    palette_sets = [_COLOR_PALETTES.get(sc["name"], set()) for sc in sanzo_matches]
    common = palette_sets[0]
    for ps in palette_sets[1:]:
        common = common & ps

    if common:
        return 1.0  # All colors appear in at least one Sanzo palette

    # Check N-1 match (drop one color, see if rest share a palette)
    n = len(sanzo_matches)
    for skip in range(n):
        subset = [palette_sets[i] for i in range(n) if i != skip]
        sub_common = subset[0]
        for ps in subset[1:]:
            sub_common = sub_common & ps
        if sub_common:
            return 0.8

    # Fallback: average pairwise compatibility
    scores = []
    for i in range(len(colors)):
        for j in range(i + 1, len(colors)):
            scores.append(are_colors_compatible(colors[i], colors[j]))
    return sum(scores) / len(scores) if scores else 0.3


# ── Palette analysis ────────────────────────────────────────────────────────

def get_palette_summary(items: list[dict]) -> dict:
    """Analyze wardrobe colors and return palette breakdown by Sanzo swatch chapter.

    Returns:
    {
        "by_group": {"pinks_reds": 3, "blues": 8, ...},
        "dominant_group": "blues",
        "underrepresented": ["pinks_reds", "greens"],
        "all_colors": ["navy", "white", "grey", ...]
    }
    """
    group_counts: Counter = Counter()
    color_counts: Counter = Counter()

    for item in items:
        try:
            colors = json.loads(item.get("colors", "[]")) if isinstance(item.get("colors"), str) else item.get("colors", [])
        except (json.JSONDecodeError, TypeError):
            colors = []
        for color in colors:
            color_counts[color] += 1
            sc = find_nearest_sanzo_color(color)
            if sc:
                group = _SWATCH_NAMES.get(sc["swatch"], "other")
                group_counts[group] += 1

    total = sum(group_counts.values()) or 1
    dominant = group_counts.most_common(1)[0][0] if group_counts else "browns_neutrals"

    underrepresented = [
        g for g in _SWATCH_NAMES.values()
        if group_counts.get(g, 0) / total < 0.15
    ]

    return {
        "by_group": dict(group_counts),
        "dominant_group": dominant,
        "underrepresented": underrepresented,
        "all_colors": [c for c, _ in color_counts.most_common()],
    }


def suggest_complementary_colors(wardrobe_colors: list[str], skin_profile: dict | None = None) -> list[dict]:
    """Suggest colors that would pair well with existing wardrobe via Sanzo palettes.

    Returns list of {name, hex, pairs_with_count} sorted by versatility.
    If skin_profile provided, filters out colors that are bad for the user's skin tone.
    """
    # Find all Sanzo colors in wardrobe
    wardrobe_sanzo = set()
    wardrobe_palette_ids = set()
    for c in wardrobe_colors:
        sc = find_nearest_sanzo_color(c)
        if sc:
            wardrobe_sanzo.add(sc["name"])
            wardrobe_palette_ids.update(sc["combinations"])

    # Score each Sanzo color by how many wardrobe palettes it shares
    candidates = []
    for sc in SANZO_COLORS:
        if sc["name"] in wardrobe_sanzo:
            continue  # Already in wardrobe

        shared = len(set(sc["combinations"]) & wardrobe_palette_ids)
        if shared > 0:
            candidates.append({
                "name": sc["name"],
                "hex": sc["hex"],
                "pairs_with_count": shared,
            })

    # Apply skin tone filter if available
    if skin_profile:
        from services.skin_tone_service import score_color_for_skin
        skin_tone = skin_profile.get("skin_tone")
        undertone = skin_profile.get("undertone")
        if skin_tone and undertone:
            candidates = [
                c for c in candidates
                if score_color_for_skin(c["name"], skin_tone, undertone) > 0.2
            ]

    candidates.sort(key=lambda c: c["pairs_with_count"], reverse=True)
    return candidates[:8]


# ── Dominant color extraction from image ─────────────────────────────────────

def extract_dominant_color_from_image(image_path: str) -> dict | None:
    """Extract dominant color from clothing photo using Pillow.

    Returns {name, hex, sanzo_name, sanzo_hex} or None on failure.
    """
    try:
        from PIL import Image

        img = Image.open(image_path).convert("RGB")
        img = img.resize((64, 64))

        pixels = list(img.getdata())
        filtered = [
            p for p in pixels
            if not (p[0] > 220 and p[1] > 220 and p[2] > 220)
            and not (p[0] < 30 and p[1] < 30 and p[2] < 30)
        ]

        if not filtered:
            return None

        avg = tuple(int(sum(c[i] for c in filtered) / len(filtered)) for i in range(3))

        # Find nearest named clothing color
        best_name = "grey"
        best_dist = float("inf")
        for name, hex_val in _CLOTHING_COLOR_HEX.items():
            rgb = _hex_to_rgb(hex_val)
            dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(avg, rgb)))
            if dist < best_dist:
                best_dist = dist
                best_name = name

        hex_str = _CLOTHING_COLOR_HEX.get(best_name, "#808080")

        # Also find nearest Sanzo color
        sc = find_nearest_sanzo_color(best_name)

        return {
            "name": best_name,
            "hex": hex_str,
            "sanzo_name": sc["name"] if sc else None,
            "sanzo_hex": sc["hex"] if sc else None,
        }

    except Exception:
        return None


# ── Legacy compatibility shims ───────────────────────────────────────────────
# These maintain backward compatibility with code that calls the old API

def get_color_group(color: str) -> str | None:
    """Map a color name to its Sanzo swatch group. Returns None if unrecognized."""
    sc = find_nearest_sanzo_color(color)
    if sc:
        return _SWATCH_NAMES.get(sc["swatch"], "other")
    return None


def score_color_compatibility(color_a: str, color_b: str) -> float:
    """Legacy shim — delegates to are_colors_compatible."""
    return are_colors_compatible(color_a, color_b)
