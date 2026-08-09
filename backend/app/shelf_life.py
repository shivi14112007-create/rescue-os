"""
Shelf-life estimation engine.

This is intentionally NOT a flat lookup table (produce -> fixed days).
Instead: base_shelf_life_days * storage_condition_multiplier - days_since_harvest.

This is what we point to for "Innovation" in the pitch - it's a simple,
explainable model, but it reasons over storage condition rather than
just returning a static number per fruit.

Extend this dict with more produce types as needed for the demo.
"""
from datetime import date

# Base shelf life in days, assuming room temperature storage.
# Values are reasonable real-world approximations for common Indian mandi produce.
BASE_SHELF_LIFE_DAYS = {
    "tomato": 7,
    "banana": 5,
    "mango": 6,
    "apple": 21,
    "potato": 30,
    "onion": 30,
    "spinach": 2,
    "cauliflower": 5,
    "grapes": 7,
    "papaya": 5,
}

# Multiplier applied to base shelf life depending on storage condition.
STORAGE_MULTIPLIERS = {
    "room_temp": 1.0,
    "cold_storage": 1.8,
    "refrigerated": 2.5,
}

DEFAULT_BASE_SHELF_LIFE = 5  # fallback for produce types not in our table


def estimate_remaining_shelf_life(
    produce_type: str,
    harvest_date: date,
    storage_condition: str,
    today: date | None = None,
) -> float:
    """
    Returns estimated remaining shelf life in days (can go negative if already expired).
    """
    today = today or date.today()

    base_days = BASE_SHELF_LIFE_DAYS.get(produce_type.lower(), DEFAULT_BASE_SHELF_LIFE)
    multiplier = STORAGE_MULTIPLIERS.get(storage_condition, 1.0)

    total_shelf_life = base_days * multiplier
    days_since_harvest = (today - harvest_date).days

    remaining = total_shelf_life - days_since_harvest
    return round(remaining, 1)


def classify_status(remaining_days: float) -> str:
    """Bucket the remaining days into a status for the dashboard UI."""
    if remaining_days <= 0:
        return "expired"
    elif remaining_days <= 1:
        return "urgent"
    elif remaining_days <= 3:
        return "risk"
    else:
        return "fresh"


def total_shelf_life_days(produce_type: str, storage_condition: str) -> float:
    """The full shelf life for this produce/storage combo (i.e. day 0 value)."""
    base_days = BASE_SHELF_LIFE_DAYS.get(produce_type.lower(), DEFAULT_BASE_SHELF_LIFE)
    multiplier = STORAGE_MULTIPLIERS.get(storage_condition, 1.0)
    return base_days * multiplier


def calculate_dynamic_discount(
    remaining_days: float,
    produce_type: str,
    storage_condition: str,
    floor_pct: int = 15,
    ceiling_pct: int = 70,
) -> int:
    """
    FEFO-style dynamic pricing: the discount scales smoothly with how much
    of the batch's shelf life has already elapsed, instead of jumping
    between a couple of fixed tiers. Used by the rule-based fallback so
    even a fully offline demo shows "smart" pricing, not a flat number.

    urgency = 0 (just harvested)         -> floor_pct discount
    urgency = 1 (shelf life exhausted)   -> ceiling_pct discount
    """
    total_days = total_shelf_life_days(produce_type, storage_condition)
    if total_days <= 0:
        return ceiling_pct

    urgency = 1 - (remaining_days / total_days)
    urgency = max(0.0, min(urgency, 1.0))  # clamp to [0, 1]

    return round(floor_pct + urgency * (ceiling_pct - floor_pct))