"""
Iteration 4 — Wardrobe Compatibility Scoring

Scores how well a candidate item (to buy) integrates with existing wardrobe items.
Uses color compatibility, occasion/season overlap, and category complementarity.
"""

import json
from services.color_service import score_color_compatibility

# Category groups for complementarity scoring
_TOPS = {"tshirt", "shirt", "polo", "hoodie", "sweater", "jacket", "blazer", "coat", "top"}
_BOTTOMS = {"jeans", "chinos", "trousers", "shorts", "bottom"}
_SHOES = {"shoes", "sneakers", "boots", "formal_shoes"}
_ACCESSORIES = {"accessory", "belt", "watch", "scarf", "hat"}


def _get_cat_group(category: str) -> str:
    cat = (category or "other").lower()
    if cat in _TOPS:
        return "tops"
    if cat in _BOTTOMS:
        return "bottoms"
    if cat in _SHOES:
        return "shoes"
    if cat in _ACCESSORIES:
        return "accessories"
    return "other"


def _parse_json_list(value: str | list | None) -> list:
    if isinstance(value, list):
        return value
    if not value:
        return []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []


def _score_pair(candidate: dict, wardrobe_item: dict) -> float:
    """Score how well candidate pairs with a single wardrobe item (0.0 – 1.0)."""
    score = 0.0

    # Category complementarity (most important factor)
    a_group = _get_cat_group(candidate.get("category", "other"))
    b_group = _get_cat_group(wardrobe_item.get("category", "other"))
    if a_group != b_group and "other" not in (a_group, b_group):
        score += 0.40   # Different complementary categories — great pairing
    elif a_group == b_group and a_group == "tops":
        score += 0.10   # Same category tops can layer (jacket over shirt)
    else:
        score += 0.10

    # Color compatibility
    a_colors = _parse_json_list(candidate.get("colors"))
    b_colors = _parse_json_list(wardrobe_item.get("colors"))
    color_scores = []
    for ca in a_colors:
        for cb in b_colors:
            color_scores.append(score_color_compatibility(ca, cb))
    if color_scores:
        # Use the best color pair score (not average — we want peak compatibility)
        score += max(color_scores) * 0.30

    # Occasion overlap
    a_occ = set(_parse_json_list(candidate.get("occasions")))
    b_occ = set(_parse_json_list(wardrobe_item.get("occasions")))
    if a_occ & b_occ:
        score += 0.20

    # Season overlap
    a_sea = set(_parse_json_list(candidate.get("seasons")))
    b_sea = set(_parse_json_list(wardrobe_item.get("seasons")))
    if a_sea & b_sea:
        score += 0.10

    return min(score, 1.0)


def score_item_compatibility(candidate: dict, wardrobe_items: list[dict]) -> dict:
    """
    Score how well a candidate item integrates with the existing wardrobe.

    candidate: dict with keys: category, colors, occasions, seasons, fit_type
    wardrobe_items: list of existing ClothingItem dicts

    Returns:
    {
        "score": 0.78,           # 0–1 overall compatibility
        "match_count": 4,
        "matching_items": [      # top 6 best-matching existing items
            {"id": 3, "category": "jeans", "brand": "Levis", "colors": [...]}
        ]
    }
    """
    if not wardrobe_items:
        return {"score": 0.0, "match_count": 0, "matching_items": []}

    scored = []
    for item in wardrobe_items:
        pair_score = _score_pair(candidate, item)
        if pair_score >= 0.45:   # Threshold for "this pair works"
            scored.append((pair_score, item))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Overall score: fraction of wardrobe that works with this item
    overall = len(scored) / len(wardrobe_items)

    matching_items = []
    for _, item in scored[:6]:  # Top 6 matches
        matching_items.append({
            "id": item.get("id"),
            "category": item.get("category"),
            "brand": item.get("brand"),
            "colors": _parse_json_list(item.get("colors")),
            "photo_path": item.get("photo_path"),
        })

    return {
        "score": round(min(overall, 1.0), 2),
        "match_count": len(scored),
        "matching_items": matching_items,
    }


def build_candidate_from_gap_item(missing_item: str, occasion: str) -> dict:
    """
    Build a candidate dict from a gap item name for compatibility scoring.
    Infers category, occasions, and seasons from the item description.
    """
    name = missing_item.lower()

    # Category inference
    if any(w in name for w in ["shirt", "tee", "tshirt", "polo", "sweater", "hoodie", "jacket", "blazer"]):
        category = "shirt"
    elif any(w in name for w in ["trouser", "chino", "jean", "pant", "short"]):
        category = "jeans"
    elif any(w in name for w in ["shoe", "sneaker", "boot", "loafer"]):
        category = "shoes"
    elif "accessory" in name or any(w in name for w in ["belt", "tie", "watch"]):
        category = "accessory"
    else:
        category = "other"

    # Colors inference from name
    colors = []
    common_colors = ["black", "white", "navy", "grey", "brown", "beige", "blue", "red"]
    for color in common_colors:
        if color in name:
            colors.append(color)

    return {
        "category": category,
        "colors": colors,
        "occasions": [occasion] if occasion else [],
        "seasons": ["spring", "summer", "fall", "winter"],  # assume year-round by default
    }
