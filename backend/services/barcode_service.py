import httpx


async def lookup_upc(upc: str) -> dict | None:
    """
    Look up a product by UPC using UPCItemDB free API (no auth required).
    Returns a dict with brand, title, size, color, category or None if not found.
    """
    url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={upc}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url)
            data = resp.json()
        except Exception:
            return None

    if data.get("code") != "OK" or not data.get("items"):
        return None

    product = data["items"][0]
    return {
        "brand": product.get("brand") or None,
        "title": product.get("title") or None,
        "size": product.get("size") or None,
        "color": product.get("color") or None,
        "description": product.get("description") or None,
    }
