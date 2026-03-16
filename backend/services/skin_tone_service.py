"""
Skin tone color recommendations — focused on Indian skin tones.

Encodes fashion color theory: which clothing colors flatter different
skin tone + undertone combinations, and which to avoid.
Used by outfit generation, shopping suggestions, and color palette analysis.
"""

# ── Skin tone × undertone → color rules ──────────────────────────────────────
# Based on fashion research for Indian skin tones:
# - ~70% of Indians have warm undertones
# - Depth ranges: fair → light-medium → medium (wheatish) → olive → deep (dusky)
# - "best" colors create striking contrast / complement the undertone
# - "good" colors work well but less dramatically
# - "avoid" colors wash out, blend with skin, or clash with undertone

SKIN_TONE_RULES: dict[tuple[str, str], dict] = {
    ("fair", "warm"): {
        "best": ["peach", "coral", "warm pink", "camel", "olive", "rust", "terracotta"],
        "good": ["mustard", "teal", "burgundy", "cream", "gold", "salmon"],
        "avoid": ["neon", "icy blue", "washed-out beige", "pale grey"],
    },
    ("fair", "cool"): {
        "best": ["lavender", "icy blue", "emerald", "berry", "silver", "slate"],
        "good": ["navy", "plum", "mint", "dusty rose", "charcoal", "white"],
        "avoid": ["orange", "mustard", "warm brown", "gold", "rust"],
    },
    ("medium", "warm"): {
        "best": ["emerald", "teal", "burnt orange", "mustard", "maroon", "cobalt"],
        "good": ["rust", "olive", "cream", "warm grey", "burgundy", "terracotta"],
        "avoid": ["pale pastels", "neon yellow", "beige", "washed-out pink"],
    },
    ("medium", "cool"): {
        "best": ["royal blue", "emerald", "deep purple", "ruby red", "pewter", "teal"],
        "good": ["navy", "berry", "cool grey", "white", "charcoal", "plum"],
        "avoid": ["orange", "warm yellow", "rust", "gold", "camel"],
    },
    ("olive", "warm"): {
        "best": ["teal", "berry", "deep coral", "rich brown", "warm white", "cobalt"],
        "good": ["burgundy", "forest green", "cream", "rust", "magenta"],
        "avoid": ["mustard", "yellow-orange", "yellow-green", "khaki", "olive"],
    },
    ("olive", "cool"): {
        "best": ["plum", "sapphire", "magenta", "cool red", "silver", "fuchsia"],
        "good": ["emerald", "berry", "charcoal", "white", "navy"],
        "avoid": ["yellow", "orange", "olive green", "khaki", "gold"],
    },
    ("deep", "warm"): {
        "best": ["cobalt", "emerald", "white", "hot pink", "gold", "mustard", "bright coral"],
        "good": ["ruby red", "tangerine", "cream", "rich purple", "teal", "orange"],
        "avoid": ["pale pastels", "dusty brown", "dark navy", "muted earth"],
    },
    ("deep", "cool"): {
        "best": ["fuchsia", "royal purple", "white", "sapphire", "electric blue", "bright pink"],
        "good": ["silver", "icy pink", "emerald", "true red", "lavender"],
        "avoid": ["muted earth", "beige", "dull brown", "dark charcoal", "khaki"],
    },
}


def _normalize_tone(skin_tone: str) -> str:
    """Map skin tone aliases to canonical form."""
    t = skin_tone.lower().strip().replace("-", "-")
    if t in ("light-medium", "light medium", "lightmedium"):
        return "medium"  # Same color rules apply
    if t in ("dusky", "dark"):
        return "deep"
    return t


def get_flattering_colors(skin_tone: str, undertone: str) -> dict:
    """Get best/good/avoid color lists for a skin tone + undertone combo.

    For neutral undertone, unions warm + cool 'best' lists with no 'avoid'.
    """
    tone = _normalize_tone(skin_tone)
    ut = undertone.lower().strip()

    if ut == "neutral":
        warm = SKIN_TONE_RULES.get((tone, "warm"), {})
        cool = SKIN_TONE_RULES.get((tone, "cool"), {})
        # Neutral can wear both warm and cool colors well
        best = list(set(warm.get("best", []) + cool.get("best", [])))
        good = list(set(warm.get("good", []) + cool.get("good", [])))
        return {"best": best, "good": good, "avoid": []}

    rules = SKIN_TONE_RULES.get((tone, ut))
    if rules:
        return dict(rules)

    # Fallback: universally flattering for Indian skin
    return {
        "best": ["navy", "emerald", "maroon", "teal", "white"],
        "good": ["cobalt", "burgundy", "cream", "olive", "charcoal"],
        "avoid": [],
    }


def score_color_for_skin(color_name: str, skin_tone: str, undertone: str) -> float:
    """Score how well a color flatters the user's skin.

    Returns: 1.0 (best), 0.7 (good), 0.4 (neutral/unknown), 0.1 (avoid).
    """
    if not skin_tone or not undertone:
        return 0.5  # No skin data → neutral

    rules = get_flattering_colors(skin_tone, undertone)
    norm = color_name.lower().strip().replace("-", " ").replace("_", " ")

    # Check against each list with fuzzy substring matching
    for best_color in rules.get("best", []):
        if best_color in norm or norm in best_color:
            return 1.0

    for good_color in rules.get("good", []):
        if good_color in norm or norm in good_color:
            return 0.7

    for avoid_color in rules.get("avoid", []):
        if avoid_color in norm or norm in avoid_color:
            return 0.1

    return 0.4  # Unknown → slight positive


def get_skin_match_label(score: float) -> str:
    """Convert numeric skin score to human-readable label."""
    if score >= 0.9:
        return "Great for your skin tone"
    elif score >= 0.6:
        return "Good match"
    elif score >= 0.3:
        return "Neutral"
    else:
        return "May not flatter your skin tone"


def get_skin_tone_context_for_ai(skin_tone: str | None, undertone: str | None) -> str:
    """Generate natural language context for AI prompts.

    Returns a string to inject into outfit/gap/shopping prompts.
    Returns empty string if no skin data available.
    """
    if not skin_tone or not undertone:
        return ""

    rules = get_flattering_colors(skin_tone, undertone)
    best = ", ".join(rules["best"][:6])
    avoid = ", ".join(rules["avoid"][:4]) if rules["avoid"] else "none"

    return (
        f"The user has {skin_tone} skin with {undertone} undertones (Indian complexion). "
        f"Colors that flatter this skin tone: {best}. "
        f"Colors to avoid: {avoid}."
    )


def get_skin_tone_color_guidance_for_ai(skin_tone: str | None, undertone: str | None) -> str:
    """Generate color rules section for outfit generation prompt."""
    if not skin_tone or not undertone:
        return "Choose colors that create good contrast and harmony."

    rules = get_flattering_colors(skin_tone, undertone)
    best = ", ".join(rules["best"][:5])
    avoid = ", ".join(rules["avoid"][:3]) if rules["avoid"] else "none in particular"

    return (
        f"Prioritize items in these flattering colors: {best}. "
        f"Avoid outfits dominated by: {avoid}. "
        f"Neutrals (black, white, grey, navy) are always safe anchors."
    )
