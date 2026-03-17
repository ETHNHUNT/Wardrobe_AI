import json
from urllib.parse import quote_plus
from services.compatibility_service import score_item_compatibility, build_candidate_from_gap_item

OCCASIONS = ["casual", "work", "formal", "sport", "outdoor"]

_TOPS_CAT = {"tshirt", "shirt", "polo", "jacket", "hoodie", "sweater", "blazer", "coat", "top"}
_BOTTOMS_CAT = {"jeans", "chinos", "trousers", "shorts"}
_SHOES_CAT = {"shoes", "sneakers", "boots", "formal_shoes"}

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


def _build_outfit_ideas(candidate_name: str, candidate_category: str, matching_items: list[dict]) -> list[dict]:
    """Build 2-3 concrete outfit ideas pairing the new suggested item with existing wardrobe items.

    Pairs a top with a bottom (and optionally shoes) to form complete outfit ideas.
    Returns up to 3 ideas, each with a list of item dicts and a brief description.
    """
    ideas = []
    tops = [m for m in matching_items if m.get("category") in _TOPS_CAT]
    bottoms = [m for m in matching_items if m.get("category") in _BOTTOMS_CAT]
    shoes = [m for m in matching_items if m.get("category") in _SHOES_CAT]

    def _colors(item: dict) -> str:
        try:
            cols = json.loads(item.get("colors", "[]") or "[]")
            return cols[0] if cols else item.get("category", "")
        except (json.JSONDecodeError, TypeError):
            return item.get("category", "")

    def _label(item: dict) -> str:
        return item.get("brand") or item.get("category", "item")

    if candidate_category in _TOPS_CAT:
        # New item is a top — pair with each bottom
        for bottom in bottoms[:3]:
            pair_items = [bottom]
            desc = f"{candidate_name} + {_colors(bottom)} {_label(bottom)}"
            if shoes:
                pair_items.append(shoes[0])
                desc += f" + {_label(shoes[0])}"
            ideas.append({"items": pair_items, "description": desc})
    elif candidate_category in _BOTTOMS_CAT:
        # New item is a bottom — pair with each top
        for top in tops[:3]:
            pair_items = [top]
            desc = f"{_colors(top)} {_label(top)} + {candidate_name}"
            if shoes:
                pair_items.append(shoes[0])
                desc += f" + {_label(shoes[0])}"
            ideas.append({"items": pair_items, "description": desc})
    elif candidate_category in _SHOES_CAT:
        # New item is shoes — pair top+bottom together
        for i, top in enumerate(tops[:2]):
            if i < len(bottoms):
                bottom = bottoms[i]
                pair_items = [top, bottom]
                desc = f"{_colors(top)} {_label(top)} + {_colors(bottom)} {_label(bottom)} + {candidate_name}"
                ideas.append({"items": pair_items, "description": desc})
    else:
        # Generic: just list first 3 matching items
        for m in matching_items[:3]:
            ideas.append({"items": [m], "description": f"{_label(m)} with {candidate_name}"})

    return ideas[:3]


def build_suggestions(
    gaps: list[dict],
    profile: dict,
    brand: str | None,
    budget_cad: float | None,
    wardrobe_items: list[dict] | None = None,
    skin_tone: str | None = None,
    undertone: str | None = None,
) -> list[dict]:
    """
    Build shopping suggestion records from gap analysis output.
    One suggestion per missing item across all gaps.
    Sorted by compatibility × priority, then high → medium → low.
    Includes compatibility_score, matching_items, recommended_colors, and versatility_score.
    """
    from services.skin_tone_service import get_flattering_colors

    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions = []

    # Pre-compute flattering colors for skin tone recommendations
    flattering_rules = {}
    if skin_tone and undertone:
        flattering_rules = get_flattering_colors(skin_tone, undertone)

    total_wardrobe = max(len(wardrobe_items), 1) if wardrobe_items else 1

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

            # Compatibility scoring with skin tone awareness
            compat = {"score": 0.0, "match_count": 0, "matching_items": []}
            if wardrobe_items:
                candidate = build_candidate_from_gap_item(missing_item, occasion)
                compat = score_item_compatibility(
                    candidate, wardrobe_items,
                    skin_tone=skin_tone, undertone=undertone,
                )

            # Recommended colors: flattering + complementary to wardrobe
            recommended_colors = []
            if flattering_rules:
                recommended_colors = (flattering_rules.get("best", []) + flattering_rules.get("good", []))[:5]

            # Versatility score: fraction of wardrobe this pairs with
            versatility_score = round(compat["match_count"] / total_wardrobe, 2)

            # Outfit ideas: concrete combinations of new item with existing wardrobe
            outfit_ideas = _build_outfit_ideas(missing_item, category, compat["matching_items"])

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
                "recommended_colors": recommended_colors,
                "versatility_score": versatility_score,
                "outfit_ideas": outfit_ideas,
            })

    # Sort: priority first, then by compatibility score descending
    suggestions.sort(key=lambda s: (
        priority_order.get(s["priority"], 1),
        -s["compatibility_score"],
    ))
    return suggestions
