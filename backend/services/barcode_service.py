"""
Thin backward-compatible wrapper.
Delegates all logic to product_lookup_service (Iteration 2).
"""
from services.product_lookup_service import lookup_product


async def lookup_upc(upc: str) -> dict | None:
    """Backward-compatible wrapper — delegates to multi-source lookup_product()."""
    return await lookup_product(upc)
