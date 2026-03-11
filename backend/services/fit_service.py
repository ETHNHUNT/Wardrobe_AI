"""
Iteration 5 — Garment Fit Verification

Verifies whether a stored garment's actual measurements (chest_width_cm, waist_cm, etc.)
fit the user's body measurements, accounting for standard ease by fit_type.
"""

# Standard ease ranges: garment chest_width is laid flat.
# Wearing ease = (garment_chest_width × 2) - body_chest_cm
# Positive ease = breathing room, negative ease = too tight.
#
# Slim:     2–8 cm ease
# Regular:  6–14 cm ease
# Relaxed:  12–20 cm ease
# Oversized: 20+ cm ease

_EASE_RANGES = {
    "slim":     (2,  8),
    "regular":  (6, 14),
    "relaxed":  (12, 20),
    "oversized": (20, 40),
}
_DEFAULT_EASE = (4, 16)   # fallback if fit_type unknown


def _ease_verdict(ease_cm: float, fit_type: str | None) -> str:
    min_ease, max_ease = _EASE_RANGES.get((fit_type or "").lower(), _DEFAULT_EASE)
    if ease_cm < min_ease - 4:
        return "too_small"
    if ease_cm < min_ease:
        return "tight"
    if ease_cm > max_ease + 6:
        return "too_large"
    if ease_cm > max_ease:
        return "loose"
    return "perfect"


_VERDICT_LABEL = {
    "too_small": "Too Small",
    "tight":     "Slightly Tight",
    "perfect":   "Perfect Fit",
    "loose":     "Slightly Loose",
    "too_large": "Too Large",
}

_VERDICT_COLOR = {
    "too_small": "danger",
    "tight":     "warning",
    "perfect":   "success",
    "loose":     "warning",
    "too_large": "warning",
}


def verify_garment_fit(
    garment_measurements: dict,
    profile: dict,
    fit_type: str | None,
    category: str,
) -> dict:
    """
    Compare garment's actual measurements against user's body measurements.

    garment_measurements: {"chest_width_cm": 54, "waist_cm": 43, ...}
    profile: {"chest_cm": 100, "waist_cm": 85, ...}
    fit_type: "slim" | "regular" | "oversized" | "relaxed" | None
    category: clothing category string

    Returns:
    {
        "fits": True,
        "overall_verdict": "perfect",
        "overall_label": "Perfect Fit",
        "color": "success",
        "chest_verdict": "perfect",
        "waist_verdict": "ok",
        "notes": "..."
    }
    """
    verdicts = {}
    notes_parts = []

    # Chest / torso check
    garment_chest = garment_measurements.get("chest_width_cm")
    body_chest = profile.get("chest_cm", 0) or 0
    if garment_chest and body_chest:
        wearing_ease = (garment_chest * 2) - body_chest
        verdict = _ease_verdict(wearing_ease, fit_type)
        verdicts["chest"] = verdict
        notes_parts.append(
            f"Chest: {_VERDICT_LABEL[verdict].lower()} "
            f"({body_chest:.0f}cm body, {garment_chest * 2:.0f}cm wearing, {wearing_ease:+.0f}cm ease)"
        )

    # Waist check
    garment_waist = garment_measurements.get("waist_cm")
    body_waist = profile.get("waist_cm", 0) or 0
    if garment_waist and body_waist:
        # Bottoms: garment waist is the actual waist opening, not a flat measurement
        # For tops: waist taper × 2
        is_bottom = category.lower() in {"jeans", "chinos", "trousers", "shorts", "pants"}
        if is_bottom:
            wearing_ease = garment_waist - body_waist
        else:
            wearing_ease = (garment_waist * 2) - body_waist
        verdict = _ease_verdict(wearing_ease, fit_type)
        verdicts["waist"] = verdict
        notes_parts.append(
            f"Waist: {_VERDICT_LABEL[verdict].lower()} "
            f"({body_waist:.0f}cm body, {wearing_ease:+.0f}cm ease)"
        )

    if not verdicts:
        return {
            "fits": None,
            "overall_verdict": "unknown",
            "overall_label": "No Data",
            "color": "neutral",
            "notes": "Add garment measurements and body measurements to profile to check fit.",
        }

    # Overall verdict: worst of all verdicts
    priority = ["too_small", "too_large", "tight", "loose", "perfect"]
    worst = min(verdicts.values(), key=lambda v: priority.index(v) if v in priority else 99)

    fits = worst in ("perfect", "loose", "tight")

    return {
        "fits": fits,
        "overall_verdict": worst,
        "overall_label": _VERDICT_LABEL.get(worst, worst.replace("_", " ").title()),
        "color": _VERDICT_COLOR.get(worst, "neutral"),
        **{f"{k}_verdict": v for k, v in verdicts.items()},
        "notes": ". ".join(notes_parts) if notes_parts else "Fit check complete.",
    }
