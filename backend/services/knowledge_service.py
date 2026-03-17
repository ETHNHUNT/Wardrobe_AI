"""
knowledge_service.py — Fashion knowledge base.

Loads fashion_knowledge.json once at module import.
All functions are synchronous and pure (no I/O after init).
Gracefully returns empty/None if the data file is missing.
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger("wardrobeai.knowledge")

_DATA_PATH = Path(__file__).parent.parent / "data" / "fashion_knowledge.json"

try:
    with open(_DATA_PATH) as _f:
        _KNOWLEDGE: dict = json.load(_f)
    logger.info("Fashion knowledge base loaded (%d style rules, %d fabrics)",
                len(_KNOWLEDGE.get("style_rules", [])),
                len(_KNOWLEDGE.get("fabric_properties", {})))
except Exception as _e:
    logger.warning("Could not load fashion_knowledge.json: %s — knowledge features disabled", _e)
    _KNOWLEDGE = {}


# ── Shoe pairings ─────────────────────────────────────────────────────────────

def get_shoe_pairings(category: str, fit_type: str | None = None) -> list[str]:
    """Return recommended shoe types for a given bottom category and fit.

    Checks fit_shoe_matrix first when fit_type is given, then falls back to
    shoe_pairings[category][fit_type], then shoe_pairings[category]["default"].
    Returns [] if category not in shoe_pairings.
    """
    if not _KNOWLEDGE:
        return []

    # fit_shoe_matrix gives broad fit-based rules regardless of category
    if fit_type:
        fit_matrix = _KNOWLEDGE.get("fit_shoe_matrix", {})
        if fit_type in fit_matrix:
            return fit_matrix[fit_type]

    shoe_pairings = _KNOWLEDGE.get("shoe_pairings", {})
    cat_data = shoe_pairings.get(category)
    if not cat_data:
        return []

    if fit_type and fit_type in cat_data:
        return cat_data[fit_type]
    return cat_data.get("default", [])


# ── Fabric properties ─────────────────────────────────────────────────────────

def get_fabric_properties(material: str) -> dict | None:
    """Fuzzy match material string against fabric_properties keys.

    Checks if any key word appears in the lowercased material string.
    e.g. "100% cotton" → cotton properties.
    Returns the properties dict or None if no match found.
    """
    if not _KNOWLEDGE or not material:
        return None

    material_lower = material.lower()
    fabric_db = _KNOWLEDGE.get("fabric_properties", {})
    for fabric_name, props in fabric_db.items():
        if fabric_name in material_lower:
            return {**props, "matched_fabric": fabric_name}
    return None


# ── Style rules ───────────────────────────────────────────────────────────────

def get_style_rules(categories: list[str] | None = None) -> list[dict]:
    """Return style rules optionally filtered to those relevant to given categories.

    A rule is included if rule["categories"] is empty (universal) or overlaps
    with the input categories list.
    """
    all_rules = _KNOWLEDGE.get("style_rules", [])
    if not categories:
        return all_rules

    cat_set = set(categories)
    return [
        r for r in all_rules
        if not r.get("categories") or cat_set & set(r.get("categories", []))
    ]


# ── Trends ────────────────────────────────────────────────────────────────────

def get_trends(season: str | None = None) -> dict:
    """Return seasonal trend data.

    If season is given (e.g. "spring"), fuzzy-matches to the closest seasonal_trends key.
    Always includes current_trends["2026"] in the response.
    Returns empty dict if no data.
    """
    if not _KNOWLEDGE:
        return {}

    current = _KNOWLEDGE.get("current_trends", {}).get("2026", {})
    seasonal_trends = _KNOWLEDGE.get("seasonal_trends", {})

    if not season:
        return {"current": current, "seasonal": seasonal_trends}

    season_lower = season.lower()
    matched_key = None
    for key in seasonal_trends:
        if season_lower in key:
            matched_key = key
            break

    return {
        "current": current,
        "seasonal": {matched_key: seasonal_trends[matched_key]} if matched_key else {},
    }


# ── Occasion rules ────────────────────────────────────────────────────────────

def get_occasion_rules(occasion: str) -> dict | None:
    """Return occasion dressing rules or None if occasion not found."""
    return _KNOWLEDGE.get("occasion_rules", {}).get(occasion)


# ── AI context builders ───────────────────────────────────────────────────────

def get_shoe_pairing_context_for_ai(
    bottom_categories: list[str],
    fit_types: list[str] | None = None,
) -> str:
    """Build a natural language string summarising shoe pairing advice for AI prompts.

    e.g. "Shoe pairing notes: For relaxed jeans: chunky sneakers, boots, wide-fit sneakers.
          2026 trend: baggy jeans + chunky sneakers is the defining look."
    Returns "" if no data.
    """
    if not _KNOWLEDGE or not bottom_categories:
        return ""

    lines = ["Shoe pairing notes:"]

    # Per-category suggestions
    seen_fits = set(fit_types or [])
    for cat in bottom_categories:
        for fit in (list(seen_fits) if seen_fits else [None]):
            shoes = get_shoe_pairings(cat, fit)
            if shoes:
                fit_label = f"{fit} " if fit else ""
                lines.append(f"  For {fit_label}{cat}: {', '.join(shoes[:3])}.")
                break

    # 2026 key combinations as trend nudge
    current = _KNOWLEDGE.get("current_trends", {}).get("2026", {})
    combos = current.get("key_combinations", [])
    relevant = [c for c in combos if any(cat in c for cat in bottom_categories)]
    if relevant:
        lines.append(f"2026 trend combos: {'; '.join(relevant[:2])}.")

    return "\n".join(lines) if len(lines) > 1 else ""


def get_style_rules_for_ai() -> str:
    """Return style rules as a concise natural-language block for AI outfit prompts.

    e.g. "Style rules: Pair fitted top with relaxed bottoms. One patterned piece per outfit..."
    Returns "" if no data.
    """
    rules = get_style_rules()
    if not rules:
        return ""
    rule_lines = [r.get("rule", "") for r in rules if r.get("rule")]
    if not rule_lines:
        return ""
    return "Style rules to apply: " + " | ".join(rule_lines[:6])


def get_trend_context_for_ai(season: str) -> str:
    """Return a short natural-language trend summary for AI outfit generation prompts.

    e.g. "Current trends for spring 2026: key colors: sage green, sky blue...
          Trending styles: relaxed fit, straight-leg jeans, chunky sneakers..."
    Returns "" if no data.
    """
    if not _KNOWLEDGE:
        return ""

    data = get_trends(season)
    current = data.get("current", {})
    seasonal_dict = data.get("seasonal", {})

    lines = []

    trending = current.get("trending", [])
    if trending:
        lines.append(f"Trending styles (2026): {', '.join(trending[:6])}.")

    fading = current.get("fading", [])
    if fading:
        lines.append(f"Avoid (fading trends): {', '.join(fading[:3])}.")

    if seasonal_dict:
        for key, sdata in seasonal_dict.items():
            s_colors = sdata.get("key_colors", [])
            s_items = sdata.get("key_items", [])
            if s_colors:
                lines.append(f"Key colors for {season}: {', '.join(s_colors[:5])}.")
            if s_items:
                lines.append(f"Key pieces for {season}: {', '.join(s_items[:5])}.")

    return " ".join(lines) if lines else ""
