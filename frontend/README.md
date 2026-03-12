# WardrobeAI — Frontend

React 19 + Vite 7 + Tailwind CSS. Mobile-first luxury dark UI.

---

## Dev Setup

```bash
npm install
npm run dev -- --host 0.0.0.0   # expose to LAN so phone can connect
```

Create `frontend/.env`:
```
VITE_API_URL=http://192.168.1.XXX:8000
```
Replace the IP with your PC's LAN IP (`ipconfig` → IPv4 under Wi-Fi adapter).

---

## Folder Structure

```
src/
├── main.jsx                React entry point
├── App.jsx                 Router, ToastProvider, SplashScreen, page transitions
├── index.css               CSS variables (theme), Tailwind base, keyframes
├── lib/
│   ├── utils.js            cn() class merger, parseJson() safe parser
│   ├── scenes.js           Spline 3D scene URL constants
│   ├── colors.js           Shared COLOR_MAP + getColorCSS() resolver
│   └── constants.js        CATEGORIES, OCCASIONS, SEASONS, FIT_TYPES,
│                           INPUT_STYLE, toggleArr(), isPhotoValid()
├── pages/
│   ├── Wardrobe.jsx        Main grid + filters + palette view
│   ├── AddItem.jsx         6-phase upload flow
│   ├── OutfitBuilder.jsx   Generate / Saved / History tabs
│   ├── Shop.jsx            Coverage rings + gap cards + suggestions
│   └── Profile.jsx         Body measurements + brand sizes
└── components/
    ├── Navbar.jsx           Fixed bottom 5-tab bar
    ├── ItemCard.jsx         Grid card: photo, swatches, worn badge
    ├── ItemDetailModal.jsx  Full-screen sheet: view / edit / retag / fit-check
    ├── OutfitCard.jsx       Outfit display: thumbnails, reason, stars
    ├── BarcodeScanner.jsx   @zxing camera barcode reader
    ├── PhaseIndicator.jsx   AddItem step progress bar
    ├── SplineScene.jsx      Lazy Spline 3D wrapper + error boundary
    ├── SplashScreen.jsx     First-launch splash, 2.4s auto-dismiss
    ├── Toast.jsx            Toast system + useToast() hook
    ├── ErrorBoundary.jsx    React class error boundary
    ├── LuxSelect.jsx        Styled native <select> with gold focus ring
    ├── TextShimmer.jsx      Gold shimmer heading animation
    ├── NoiseOverlay.jsx     Grain texture overlay
    └── GlassCard.jsx        Reusable glassmorphism container
```

---

## Styling Conventions

- **No raw hex values** — always reference CSS variables: `style={{ color: 'var(--accent)' }}`
- **Class merging** — use `cn()` from `lib/utils.js` for conditional Tailwind classes
- **Dropdowns** — use `<LuxSelect>` for all `<select>` elements (best mobile UX)
- **Inputs** — use `INPUT_STYLE` from `lib/constants.js` as the `style` prop base

Key theme variables (defined in `index.css`):

| Variable | Value | Usage |
|---|---|---|
| `--bg-primary` | `#0C0C0C` | Page backgrounds |
| `--bg-surface` | `#161616` | Cards, panels |
| `--bg-elevated` | `#1E1E1E` | Inputs, modals |
| `--text-primary` | `#F0EDE8` | Main text |
| `--text-muted` | `#6B6560` | Secondary text |
| `--accent` | `#C8A97E` | Gold — CTAs, active states |
| `--accent-soft` | `rgba(200,169,126,0.10)` | Subtle gold tint |

---

## Shared Utilities

**`lib/colors.js`** — Color swatch rendering
```js
import { getColorCSS, COLOR_MAP } from '../lib/colors'
// getColorCSS('navy') → '#1a2744'
```

**`lib/constants.js`** — Enum arrays + helpers
```js
import { CATEGORIES, OCCASIONS, SEASONS, FIT_TYPES,
         INPUT_STYLE, toggleArr, isPhotoValid } from '../lib/constants'
```

**`components/Toast.jsx`** — Toast notifications
```js
import { useToast } from '../components/Toast'
const { toast } = useToast()
toast({ message: 'Saved', type: 'success', duration: 2500 })
// type: 'success' | 'error' | 'default'
```

---

## Adding a New Page

1. Create `src/pages/YourPage.jsx`
2. Add route in `App.jsx`
3. Add tab icon in `Navbar.jsx` if it needs a nav entry
4. Update `projectstructure.md` in the same commit (CLAUDE.md rule)
