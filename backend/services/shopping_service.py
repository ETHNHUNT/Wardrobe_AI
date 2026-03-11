import json
from urllib.parse import quote_plus
from services.compatibility_service import score_item_compatibility, build_candidate_from_gap_item

OCCASIONS = ["casual", "work", "formal", "sport", "outdoor"]

# Size thresholds for tops (chest_cm) and bottoms (waist_cm)
_SIZE_THRESHOLDS = [
    (88, "XS"),
    (96, "S"),
    (104, "M"),
    (112, "L"),
    (120, "XL"),
]


def _cm_to_size(cm: float) -> str:
    for threshold, label in _SIZE_THRESHOLDS:
        if cm < threshold:
            return label
    return "XXL"


def _infer_category_from_string(name: str) -> str:
    """Map a free-text item name from AI output to a ClothingItem category string."""
    name = name.lower()
    if any(w in name for w in ["shirt", "tee", "t-shirt", "tshirt", "polo", "sweater", "hoodie", "jacket", "blazer", "coat", "top"]):
        return "shirt"   # tops → chest measurement
    if any(w in name for w in ["trouser", "chino", "jean", "pant", "short", "bottom"]):
        return "jeans"   # bottoms → waist measurement
    if any(w in name for w in ["shoe", "sneaker", "boot", "loafer", "oxford", "sandal"]):
        return "shoes"
    return "other"


def compute_local_coverage(items: list[dict]) -> dict:
    """
    Count how many wardrobe items cover each occasion.
    Flags occasions with fewer than 2 items.
    Runs instantly with no AI dependency.
    """
    counts = {occ: 0 for occ in OCCASIONS}
    for item in items:
        try:
            item_occasions = json.loads(item.get("occasions", "[]") or "[]")
        except (json.JSONDecodeError, TypeError):
            item_occasions = []
        for occ in item_occasions:
            if occ in counts:
                counts[occ] += 1
    flagged = [occ for occ, count in counts.items() if count < 2]
    return {"counts": counts, "flagged": flagged}


def infer_size(category: str, profile: dict, brand: str | None) -> str:
    """
    Return a human-readable size recommendation string.
    Priority: stored brand preference > body measurement inference > fallback.
    """
    # 1. Check stored brand preference
    if brand:
        try:
            brand_sizes = json.loads(profile.get("brand_sizes", "{}") or "{}")
            # Case-insensitive brand lookup
            for stored_brand, size in brand_sizes.items():
                if stored_brand.lower() == brand.lower():
                    return f"Size {size} (from your {stored_brand} preference)"
        except (json.JSONDecodeError, TypeError):
            pass

    # 2. Infer from body measurements
    if category in ("shirt", "tshirt", "polo", "jacket", "hoodie", "sweater"):
        chest = profile.get("chest_cm", 0) or 0
        if chest == 0:
            return "Add chest measurement to profile for size advice"
        return f"Size {_cm_to_size(chest)} (inferred from chest {chest:.0f}cm)"

    if category in ("jeans", "chinos", "trousers", "shorts"):
        waist = profile.get("waist_cm", 0) or 0
        if waist == 0:
            return "Add waist measurement to profile for size advice"
        return f"Size {_cm_to_size(waist)} (inferred from waist {waist:.0f}cm)"

    if category in ("shoes", "sneakers", "boots", "formal_shoes"):
        return "Check your size chart"

    return "Check sizing chart"


def build_google_shopping_url(query: str) -> str:
    return f"https://www.google.com/shopping/search?q={quote_plus(query)}"


def build_suggestions(
    gaps: list[dict],
    profile: dict,
    brand: str | None,
    budget_cad: float | None,
    wardrobe_items: list[dict] | None = None,
) -> list[dict]:
    """
    Build shopping suggestion records from gap analysis output.
    One suggestion per missing item across all gaps.
    Sorted by compatibility × priority, then high → medium → low.
    Includes compatibility_score and matching_items when wardrobe_items provided.
    """
    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions = []

    for gap in gaps:
        occasion = gap.get("occasion", "")
        priority = gap.get("priority", "medium")
        for missing_item in gap.get("missing_items", []):
            # Build search query
            query_parts = [missing_item]
            if brand:
                query_parts.append(brand)
            if budget_cad:
                query_parts.append(f"under ${budget_cad:.0f} CAD")
            search_query = " ".join(query_parts)

            # Infer size from item name
            category = _infer_category_from_string(missing_item)
            size_note = infer_size(category, profile, brand)

            # Compatibility scoring (Iteration 4)
            compat = {"score": 0.0, "match_count": 0, "matching_items": []}
            if wardrobe_items:
                candidate = build_candidate_from_gap_item(missing_item, occasion)
                compat = score_item_compatibility(candidate, wardrobe_items)

            suggestions.append({
                "item": missing_item,
                "occasion": occasion,
                "priority": priority,
                "size_note": size_note,
                "search_query": search_query,
                "google_shopping_url": build_google_shopping_url(search_query),
                "compatibility_score": compat["score"],
                "match_count": compat["match_count"],
                "matching_items": compat["matching_items"],
            })

    # Sort: priority first, then by compatibility score descending
    suggestions.sort(key=lambda s: (
        priority_order.get(s["priority"], 1),
        -s["compatibility_score"],
    ))
    return suggestions
