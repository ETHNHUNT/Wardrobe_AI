# Changelog

All notable changes to WardrobeAI are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-03-13

### Added — Phase 1: Core Foundation
- FastAPI + SQLite backend with SQLModel ORM
- Three data models: `UserProfile`, `ClothingItem`, `SavedOutfit`
- `/profile` GET/POST — body measurements + brand sizes
- `/items` POST — photo upload with Ollama qwen3.5:2b vision tagging
- `<think>` tag stripping for qwen3.5:2b output
- Manual fallback form when AI returns empty JSON
- Wardrobe grid: 2-col mobile / 4-col desktop

### Added — Phase 2: Intelligence
- `/outfits/generate` — AI suggests 3 outfits, enriched with full item objects
- Outfit Builder UI: Generate tab + Saved tab
- Filters by occasion + season on wardrobe and outfits
- "Wear Today?" quick suggestion (casual + current season)
- Star rating (1–5) on saved outfits
- `POST /items/{id}/worn` — worn-count tracking
- `preserve_existing=True` on retag: AI never clobbers manually edited fields

### Added — Phase 3: Shopping Intelligence
- Wardrobe gap analysis via Ollama (`analyze_gaps`)
- Instant local coverage scoring (`compute_local_coverage`) — no AI, no delay
- 30 s in-memory cache shared by `/shop/gaps` + `/shop/suggest`
- Shopping page: coverage rings, gap cards, Google Shopping links
- Size inference: brand preference → body measurements → category fallback

### Added — Phase 4: Polish
- Barcode scanning via `@zxing/library` (phone rear camera)
- PWA manifest — Add to Home Screen on iOS/Android
- Dark luxury theme: full CSS variable system
- 3D Spline scenes: splash screen, wardrobe hero, AddItem idle
- Framer Motion page transitions + GSAP stagger entrance animations
- `ItemDetailModal`: in-place edit, re-tag, delete
- `SplashScreen`: sessionStorage-gated, auto-dismiss 2.4 s
- `ErrorBoundary` protecting all pages
- `NoiseOverlay` grain texture
- `TextShimmer` gold sweep animation
- `GlassCard` glassmorphism container
- `LuxSelect` native select with gold focus ring

---

## Backlog (not yet implemented)

- Gemini 2.5 Flash-Lite fallback AI
- Color palette gap detection
- Versatility score per shopping suggestion
- Dedicated outfit history view
