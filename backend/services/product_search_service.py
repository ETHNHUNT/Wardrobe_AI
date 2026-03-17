"""
product_search_service.py — Online product lookup via DuckDuckGo Instant Answer API.

Free, no API key required. Used to enrich newly added items with product data.
All functions are designed to NEVER raise exceptions — failures return None silently.
"""
import logging
from urllib.parse import quote_plus

import httpx

logger = logging.getLogger("wardrobeai.product_search")

_DDG_URL = "https://api.duckduckgo.com/"
_TIMEOUT = 5.0   # seconds — short so it never blocks the add flow significantly
_DESC_MAX = 200  # characters — cap stored description to avoid large SQLite blobs


def _build_search_query(
    brand: str,
    category: str,
    tags: list[str] | None = None,
) -> str:
    """Build a focused product search query.

    e.g. brand='Zara', category='chinos', tags=['slim-fit'] → 'Zara slim-fit chinos'
    """
    parts = [brand]
    if tags:
        # Take the first meaningful tag (e.g. "slim-fit", not generic ones)
        meaningful = [t for t in tags if len(t) > 3 and t not in ("new", "item", "piece")]
        if meaningful:
            parts.append(meaningful[0])
    parts.append(category)
    return " ".join(parts)


async def search_product_online(
    brand: str | None,
    category: str,
    tags: list[str] | None = None,
    colors: list[str] | None = None,
) -> dict | None:
    """Query DuckDuckGo Instant Answer API for product information.

    Only called when brand is not None — pointless without a brand name.
    Returns:
        {
            "product_url": str | None,
            "source_description": str | None,
            "source": "duckduckgo",
        }
    Returns None on any error or if brand is missing.
    Never raises exceptions.
    """
    if not brand:
        return None

    try:
        query = _build_search_query(brand, category, tags)
        params = {
            "q": query,
            "format": "json",
            "no_html": "1",
            "no_redirect": "1",
        }

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(_DDG_URL, params=params)

        if resp.status_code != 200:
            logger.debug("DDG search returned HTTP %s for query: %s", resp.status_code, query)
            return None

        data = resp.json()

        product_url = data.get("AbstractURL") or None
        description = data.get("AbstractText") or ""

        # If AbstractText is empty, try first RelatedTopic text
        if not description:
            related = data.get("RelatedTopics", [])
            for topic in related:
                if isinstance(topic, dict) and topic.get("Text"):
                    description = topic["Text"]
                    if not product_url:
                        product_url = topic.get("FirstURL") or None
                    break

        # Cap description length
        if description and len(description) > _DESC_MAX:
            description = description[:_DESC_MAX].rsplit(" ", 1)[0] + "…"

        if not product_url and not description:
            # DDG found nothing useful — build a Google Shopping fallback URL
            product_url = (
                f"https://www.google.com/search?tbm=shop&q={quote_plus(query)}"
            )
            description = None  # Don't store a description if we only have a search URL

        return {
            "product_url": product_url or None,
            "source_description": description or None,
            "source": "duckduckgo",
        }

    except Exception as e:
        logger.debug("Product search failed for brand=%s category=%s: %s", brand, category, e)
        return None
