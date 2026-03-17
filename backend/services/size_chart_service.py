"""
size_chart_service.py — Brand size chart lookup and personal size recommendation.

Loads size_charts.json once at module import.
All functions synchronous and pure after init.
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger("wardrobeai.size_chart")

_DATA_PATH = Path(__file__).parent.parent / "data" / "size_charts.json"

try:
    with open(_DATA_PATH) as _f:
        _DATA: dict = json.load(_f)
    _CHARTS: dict = _DATA.get("brands", {})
    logger.info("Size charts loaded for brands: %s", list(_CHARTS.keys()))
except Exception as _e:
    logger.warning("Could not load size_charts.json: %s — size chart features disabled", _e)
    _DATA = {}
    _CHARTS = {}


def get_available_brands() -> list[str]:
    """Return list of brands with size chart data."""
    return list(_CHARTS.keys())


def get_size_chart(brand: str) -> dict | None:
    """Return the full size chart for a brand. Case-insensitive lookup.
    Returns None if brand not in data.
    """
    if not brand:
        return None
    brand_lower = brand.lower()
    for key, chart in _CHARTS.items():
        if key.lower() == brand_lower:
            return {"brand": key, **chart}
    return None


def _find_best_size(
    ranges: dict[str, dict],
    measurement_key: str,
    value: float,
) -> tuple[str | None, str | None]:
    """Find which size label's [min, max] range contains value.

    Returns (recommended_size, next_size_up).
    next_size_up is set when value is within 2 cm of the range upper boundary.
    Both are None if value is outside all ranges.
    """
    if not value or value <= 0:
        return None, None

    size_labels = list(ranges.keys())
    recommended = None
    next_size = None

    for i, label in enumerate(size_labels):
        bounds = ranges[label].get(measurement_key, [])
        if len(bounds) != 2:
            continue
        low, high = bounds
        if low <= value <= high:
            recommended = label
            # Flag next size if within 2cm of upper boundary
            if value >= high - 2 and i + 1 < len(size_labels):
                next_size = size_labels[i + 1]
            break

    return recommended, next_size


def recommend_size(
    brand: str,
    garment_type: str,
    body_measurements: dict,
) -> dict:
    """Compare body measurements against brand size chart ranges.

    garment_type: "tops" or "bottoms"
    body_measurements: dict from UserProfile.model_dump() or similar

    Returns:
    {
        "brand": str,
        "garment_type": str,
        "recommended_size": str | None,
        "next_size": str | None,
        "fit_note": str,
        "measurement_used": str,
        "your_measurement": float | None,
    }
    """
    chart = get_size_chart(brand)

    result_base = {
        "brand": brand,
        "garment_type": garment_type,
        "recommended_size": None,
        "next_size": None,
        "fit_note": "",
        "measurement_used": "",
        "your_measurement": None,
    }

    if not chart:
        result_base["fit_note"] = (
            f"No size chart available for {brand}. "
            f"Try: {', '.join(get_available_brands()[:4])}."
        )
        return result_base

    size_ranges = chart.get(garment_type)
    if not size_ranges:
        result_base["fit_note"] = f"No {garment_type} chart available for {brand}."
        return result_base

    # Choose primary measurement
    if garment_type == "tops":
        primary_key = "chest_cm"
        fallback_key = "waist_cm"
    else:
        primary_key = "waist_cm"
        fallback_key = "hips_cm"

    primary_val = body_measurements.get(primary_key) or 0
    fallback_val = body_measurements.get(fallback_key) or 0

    measurement_key = primary_key
    measurement_val = primary_val

    # Use fallback if primary is missing or zero
    if (not measurement_val or measurement_val <= 0) and fallback_val > 0:
        measurement_key = fallback_key
        measurement_val = fallback_val

    if not measurement_val or measurement_val <= 0:
        result_base["fit_note"] = (
            f"Your {primary_key.replace('_', ' ')} is not set. "
            "Update your body measurements in Profile to get a size recommendation."
        )
        return result_base

    recommended, next_size = _find_best_size(size_ranges, measurement_key, measurement_val)

    result_base["measurement_used"] = measurement_key
    result_base["your_measurement"] = measurement_val
    result_base["recommended_size"] = recommended
    result_base["next_size"] = next_size

    brand_notes = chart.get("notes", "")

    if recommended:
        note = f"Based on your {measurement_key.replace('_', ' ')} ({measurement_val} cm), size {recommended} at {brand}."
        if next_size:
            note += f" You're near the upper boundary — consider {next_size} for a relaxed fit."
        if brand_notes:
            note += f" Note: {brand_notes}"
        result_base["fit_note"] = note
    else:
        note = (
            f"Your {measurement_key.replace('_', ' ')} ({measurement_val} cm) "
            f"is outside {brand}'s standard size range. "
        )
        if brand_notes:
            note += brand_notes
        result_base["fit_note"] = note

    return result_base
