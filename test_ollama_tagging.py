#!/usr/bin/env python3
"""
Standalone test: verifies Ollama qwen3.5:2b can tag a clothing image.
Run from the repo root: python test_ollama_tagging.py

Creates a synthetic navy-blue JPEG (no network needed) and calls
tag_clothing_image() directly. Exits 0 on PASS, 1 on FAIL.
"""
import asyncio
import json
import sys
from pathlib import Path

# Add backend to Python path
sys.path.insert(0, str(Path(__file__).parent / "backend"))
from services.ai_service import tag_clothing_image  # noqa: E402

TEST_IMAGE = Path("test_shirt.jpg")


def create_test_image() -> None:
    """Create a 400x600 navy-blue JPEG to simulate a clothing photo."""
    from PIL import Image

    img = Image.new("RGB", (400, 600), color=(0, 0, 128))
    img.save(TEST_IMAGE, "JPEG", quality=85)
    print(f"Created synthetic test image: {TEST_IMAGE} ({TEST_IMAGE.stat().st_size} bytes)")


async def main() -> None:
    if not TEST_IMAGE.exists():
        create_test_image()

    print(f"\nSending {TEST_IMAGE} to Ollama ({{}})...".format("qwen3.5:2b"))
    print("First run may take 15-30s while the model loads into VRAM.\n")

    result = await tag_clothing_image(str(TEST_IMAGE))

    if not result:
        print("=" * 60)
        print("FAIL — tag_clothing_image returned an empty dict.")
        print()
        print("Troubleshooting:")
        print("  1. Is Ollama running?  →  ollama serve")
        print("  2. Is model pulled?    →  ollama pull qwen3.5:2b")
        print("  3. Is Ollama reachable at http://localhost:11434 ?")
        print("=" * 60)
        sys.exit(1)

    print("=" * 60)
    print("PASS — AI returned valid JSON:")
    print(json.dumps(result, indent=2))

    required_keys = {"category", "colors", "occasions", "seasons"}
    missing = required_keys - set(result.keys())
    if missing:
        print(f"\nWARNING — response is missing expected keys: {missing}")
        print("AI tagging will still work but some fields may be empty.")
    else:
        print(f"\nAll required keys present: {sorted(required_keys)}")

    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
