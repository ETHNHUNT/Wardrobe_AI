"""
Iteration 3 — Color palette intelligence service.

Groups clothing colors into families, finds underrepresented groups,
suggests complementary colors to buy, and scores color-pair compatibility.
No Ollama calls — pure Python logic, instant.
"""
import json
from collections import Counter

# ── Color group definitions ───────────────────────────────────────────────────

COLOR_GROUPS: dict[str, list[str]] = {
    "neutrals": [
        "black", "white", "grey", "gray", "charcoal", "offwhite", "off-white",
        "cream", "ivory", "beige", "nude", "stone", "ecru", "silver",
    ],
    "cool": [
        "navy", "blue", "cobalt", "royal blue", "royalblue", "slate", "indigo",
        "denim", "teal", "cyan", "lightblue", "light blue", "steel blue",
        "powder blue", "electric blue", "midnight blue", "sky blue",
    ],
    "warm": [
        "red", "burgundy", "maroon", "wine", "crimson", "rust", "brick",
        "orange", "coral", "terracotta", "pink", "hot pink", "blush", "salmon",
        "tomato", "scarlet",
    ],
    "earth": [
        "brown", "camel", "khaki", "olive", "tan", "sand", "taupe", "mocha",
        "chocolate", "coffee", "sienna", "hazel", "mustard", "army green",
        "forest green", "hunter green", "dark green",
    ],
    "bright": [
        "yellow", "lime", "green", "purple", "violet", "lavender", "magenta",
        "fuchsia", "mint", "turquoise", "neon", "electric", "gold",
    ],
}

# Compatible group pairs (unordered) — items from these groups pair well together
_COMPATIBLE_PAIRS: list[frozenset] = [
    frozenset({"neutrals", "cool"}),
    frozenset({"neutrals", "warm"}),
    frozenset({"neutrals", "earth"}),
    frozenset({"neutrals", "bright"}),
    frozenset({"cool", "earth"}),
    frozenset({"warm", "earth"}),
    # Within neutrals always compatible
    frozenset({"neutrals", "neutrals"}),
]

# ── Color resolution ──────────────────────────────────────────────────────────

def _normalize(color: str) -> str:
    return color.lower().strip().replace("-", " ").replace("_", " ")


def get_color_group(color: str) -> str | None:
    """Map a color name to its group. Returns None if unrecognized."""
    norm = _normalize(color)
    # Remove spaces for matching
    compact = norm.replace(" ", "")
    for group, members in COLOR_GROUPS.items():
        for m in members:
            if norm == m or compact == m.replace(" ", ""):
                return group
    # Partial match fallback
    for group, members in COLOR_GROUPS.items():
        for m in members:
            if m in norm or norm in m:
                return group
    return None


# ── Palette analysis ──────────────────────────────────────────────────────────

def get_palette_summary(items: list[dict]) -> dict:
    """
    Analyze all items' colors and return palette breakdown.

    Returns:
    {
        "by_group": {"neutrals": 12, "cool": 8, "warm": 2, "earth": 5, "bright": 1},
        "dominant_group": "neutrals",
        "underrepresented": ["warm", "bright"],
        "all_colors": ["navy", "white", "grey", ...]  # unique, most-common first
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
            group = get_color_group(color)
            if group:
                group_counts[group] += 1

    total = sum(group_counts.values()) or 1
    dominant = group_counts.most_common(1)[0][0] if group_counts else "neutrals"

    # Underrepresented: groups with <15% share of all tagged colors
    underrepresented = [
        g for g in COLOR_GROUPS
        if group_counts.get(g, 0) / total < 0.15
    ]

    return {
        "by_group":        dict(group_counts),
        "dominant_group":  dominant,
        "underrepresented": underrepresented,
        "all_colors":      [c for c, _ in color_counts.most_common()],
    }


def suggest_complementary_colors(palette_summary: dict) -> list[str]:
    """
    Return a short list of specific color names that would complement the existing palette.
    Logic: find underrepresented groups that pair well with the dominant group,
    then suggest 2-3 specific popular colors from those groups.
    """
    dominant = palette_summary.get("dominant_group", "neutrals")
    underrepresented = palette_summary.get("underrepresented", [])

    # Find which underrepresented groups are compatible with dominant
    compatible_under = [
        g for g in underrepresented
        if frozenset({dominant, g}) in _COMPATIBLE_PAIRS or g == dominant
    ]

    # If nothing compatible or nothing underrepresented, suggest from all compatible
    if not compatible_under:
        compatible_under = [
            g for g in COLOR_GROUPS
            if g != dominant and frozenset({dominant, g}) in _COMPATIBLE_PAIRS
        ]

    # Pick 2-3 representative colors from target groups
    COLOR_SUGGESTIONS: dict[str, list[str]] = {
        "warm":    ["burgundy", "rust", "terracotta"],
        "cool":    ["navy", "slate", "teal"],
        "earth":   ["camel", "olive", "tan"],
        "neutrals": ["grey", "beige", "white"],
        "bright":  ["mustard", "lavender", "coral"],
    }

    suggestions: list[str] = []
    for group in compatible_under[:2]:
        suggestions.extend(COLOR_SUGGESTIONS.get(group, [])[:2])

    return suggestions[:5]


# ── Color compatibility scoring ───────────────────────────────────────────────

def score_color_compatibility(color_a: str, color_b: str) -> float:
    """
    Score how well two colors pair together.
    Returns 0.0 (clash) → 0.5 (neutral) → 1.0 (perfect).
    """
    group_a = get_color_group(color_a)
    group_b = get_color_group(color_b)

    if group_a is None or group_b is None:
        return 0.5  # Unknown color → neutral

    if group_a == group_b == "neutrals":
        return 0.95  # Neutrals always work together

    pair = frozenset({group_a, group_b})
    if pair in _COMPATIBLE_PAIRS:
        # Same group (non-neutral) is tonal — works but less interesting
        if group_a == group_b:
            return 0.65
        return 0.85  # Different compatible groups = great pairing

    # Check if one is neutral (neutrals pair with everything)
    if "neutrals" in (group_a, group_b):
        return 0.80

    return 0.25  # Incompatible groups (e.g. bright + warm = risky)


# ── Dominant color extraction from image ─────────────────────────────────────

# CSS color name → hex (for finding nearest named color)
_CSS_COLORS: dict[str, tuple[int, int, int]] = {
    "black": (26, 26, 26),
    "white": (245, 245, 245),
    "grey": (128, 128, 128),
    "navy": (30, 42, 74),
    "blue": (41, 128, 185),
    "beige": (212, 184, 150),
    "brown": (122, 79, 46),
    "burgundy": (109, 43, 61),
    "red": (192, 57, 43),
    "olive": (107, 107, 47),
    "khaki": (195, 176, 145),
    "camel": (193, 154, 107),
    "tan": (210, 180, 140),
    "cream": (255, 253, 208),
    "charcoal": (54, 69, 79),
    "teal": (0, 128, 128),
    "orange": (230, 126, 34),
    "green": (39, 174, 96),
    "yellow": (241, 196, 15),
    "pink": (233, 30, 140),
    "purple": (142, 68, 173),
}


def _color_distance(rgb1: tuple, rgb2: tuple) -> float:
    return sum((a - b) ** 2 for a, b in zip(rgb1, rgb2)) ** 0.5


def extract_dominant_color_from_image(image_path: str) -> str | None:
    """
    Use Pillow to find the dominant non-background color in a clothing image.
    Returns a CSS color name or None on failure.
    """
    try:
        from PIL import Image

        img = Image.open(image_path).convert("RGB")
        # Resize for fast processing
        img = img.resize((64, 64))

        # Sample pixels, excluding very light (background) and very dark (shadow) pixels
        pixels = list(img.getdata())
        filtered = [
            p for p in pixels
            if not (p[0] > 220 and p[1] > 220 and p[2] > 220)  # skip near-white
            and not (p[0] < 30 and p[1] < 30 and p[2] < 30)    # skip near-black
        ]

        if not filtered:
            return None

        # Average of filtered pixels
        avg = tuple(int(sum(c[i] for c in filtered) / len(filtered)) for i in range(3))

        # Find nearest named color
        best = min(_CSS_COLORS.items(), key=lambda kv: _color_distance(avg, kv[1]))
        return best[0]

    except Exception:
        return None
