# Task: WebGL Outfit Gallery with Sticky Image Effect

## Overview
Replace the "Saved Outfits" tab grid in `OutfitBuilder.jsx` with a WebGL-powered
horizontal drag gallery using a sticky image distortion effect (Three.js + GSAP).
Users drag left/right to browse saved outfits. The gallery loops infinitely.

Read `CLAUDE.md` fully before starting. All theme variables, API patterns,
component conventions, and stack details are defined there.

---

## Prerequisites

### Install Three.js
```bash
cd frontend
npm install three
```

GSAP is already installed at v3.14. Do NOT install Popmotion or any other animation library.

---

## File 1 — CREATE: `frontend/src/components/OutfitGallery.jsx`

### Component Signature
```jsx
export default function OutfitGallery({ outfits })
```

`outfits` is an array of enriched SavedOutfit objects. Each outfit has:
- `id` — number
- `occasion` — string or null
- `season` — string or null
- `rating` — number 1-5 or null
- `items` — array of full ClothingItem objects (already enriched by backend)

### Image URL Pattern
```js
const API_URL = import.meta.env.VITE_API_URL;
const thumbnail = `${API_URL}/images/${outfit.items[0]?.photo_path}`;
```
If `outfit.items` is empty or undefined, skip rendering that plane's texture (do not crash).

### Layout
- Container: `w-full` with `height: 60vh`, `position: relative`
- WebGL canvas fills entire container (mounted via `useRef`)
- Below canvas: outfit metadata overlay (occasion + season + dot indicators)
- Cursor: `grab` default, `grabbing` on active drag

---

## Three.js Scene Setup

### Renderer
```js
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(containerWidth, containerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // NEVER skip this line
// renderer.domElement — append to container ref, remove on cleanup
```

### Camera
```js
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
camera.position.z = 1.5;
```

### Geometry
```js
// IMPORTANT: PlaneGeometry only — PlaneBufferGeometry is deprecated since r125
new THREE.PlaneGeometry(1.2, 1.5, 60, 60)
// 60x60 subdivisions are required for smooth vertex deformation — do not reduce
```

### Texture Loading
```js
const loader = new THREE.TextureLoader();
loader.load(url, (tex) => {
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false; // saves VRAM — important for GTX 1050Ti
  material.uniforms.u_texture.value = tex;
});
```

---

## Three Planes (Circular Buffer Pattern)

Maintain exactly 3 planes in the scene at all times:
- **Plane 0** (left): previous outfit — positioned at `x = -1.5`
- **Plane 1** (center): current outfit — positioned at `x = 0`
- **Plane 2** (right): next outfit — positioned at `x = +1.5`

### Infinite Loop Index Helper
```js
const wrap = (i, total) => ((i % total) + total) % total;
```

When navigation triggers:
1. Update `currentIndex` using `wrap()`
2. Reload texture for all 3 planes with new `wrap(currentIndex - 1)`, `wrap(currentIndex)`, `wrap(currentIndex + 1)`
3. Update React state for dot indicators

---

## Vertex Shader

```glsl
uniform float u_progress;
uniform float u_direction;
uniform float u_offset;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;

  float maxDist = length(vec2(0.5));
  float normalizedDist = length(uv - 0.5) / maxDist;

  // direction 0 = press (corners push forward)
  // direction 1 = release (corners pull back)
  float stickOut = normalizedDist;
  float stickIn  = -normalizedDist;
  float stickEffect = mix(stickOut, stickIn, u_direction);

  float progress = smoothstep(0.0, 1.0, u_progress);
  pos.z += stickEffect * u_offset * progress;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

---

## Fragment Shader

```glsl
uniform sampler2D u_texture;
uniform float u_smoothVelocity;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  float shift = u_smoothVelocity * 0.0015;
  uv.x -= sin(uv.y) / 100.0 * u_smoothVelocity;

  vec4 color;
  color.r = texture2D(u_texture, uv + vec2(shift, 0.0)).r;
  color.g = texture2D(u_texture, uv).g;
  color.b = texture2D(u_texture, uv - vec2(shift, 0.0)).b;
  color.a = 1.0;

  gl_FragColor = color;
}
```

---

## ShaderMaterial Uniforms (per plane)

```js
uniforms: {
  u_texture:         { value: null },
  u_progress:        { value: 0.0 },
  u_direction:       { value: 0.0 },
  u_offset:          { value: 0.4 },
  u_smoothVelocity:  { value: 0.0 },
}
```

Each plane gets its **own ShaderMaterial instance** — do not share materials between planes.

---

## Animation — GSAP Only

### On Press (mousedown / touchstart)
```js
// Apply to center plane (Plane 1) only
plane1.mat.uniforms.u_direction.value = 0;
gsap.to(plane1.uniforms_proxy, {
  progress: 1,
  duration: 0.6,
  ease: 'elastic.out(1, 0.5)',
  onUpdate: () => {
    plane1.mat.uniforms.u_progress.value = plane1.uniforms_proxy.progress;
  }
});
```

### On Release (mouseup / touchend)
```js
plane1.mat.uniforms.u_direction.value = 1;
gsap.to(plane1.uniforms_proxy, {
  progress: 0,
  duration: 0.5,
  ease: 'elastic.out(1, 0.3)',
  onUpdate: () => {
    plane1.mat.uniforms.u_progress.value = plane1.uniforms_proxy.progress;
  }
});
```

### Plane Position Slide
```js
// On drag move — slide all 3 planes
planes.forEach((p, i) => {
  gsap.to(p.mesh.position, {
    x: (i - 1) * 1.5 + (dragDelta / containerWidth) * 1.5,
    duration: 0.1,
    ease: 'none'
  });
});

// On release — snap back
planes.forEach((p, i) => {
  gsap.to(p.mesh.position, {
    x: (i - 1) * 1.5,
    duration: 0.5,
    ease: 'power3.out'
  });
});
```

---

## Drag Logic

Store everything in `stateRef.current` (not useState — avoids re-renders):

```js
stateRef.current = {
  isDragging: false,
  dragStartX: 0,
  dragDeltaX: 0,
  currentIndex: 0,
  smoothVelocity: 0,
  prevProgress: 0,
  progress: 0,
  renderer, scene, camera, planes, rafId
}
```

**Drag threshold:** `containerWidth * 0.25` — must exceed 25% to trigger navigation.

**Event listeners — both mouse and touch:**
```js
el.addEventListener('mousedown',  onPointerDown);
el.addEventListener('mousemove',  onPointerMove);
el.addEventListener('mouseup',    onPointerUp);
el.addEventListener('touchstart', onPointerDown, { passive: true });
el.addEventListener('touchmove',  onPointerMove,  { passive: true });
el.addEventListener('touchend',   onPointerUp);
```

For touch events use: `e.touches[0].clientX`

---

## RAF Loop — Velocity Smoothing

```js
const animate = () => {
  rafId = requestAnimationFrame(animate);

  const rawVelocity     = Math.abs(s.progress - s.prevProgress) * 60;
  s.smoothVelocity      = s.smoothVelocity + (rawVelocity - s.smoothVelocity) * 0.15;
  s.prevProgress        = s.progress;

  planes.forEach(p => {
    p.mat.uniforms.u_smoothVelocity.value = s.smoothVelocity;
  });

  renderer.render(scene, camera);
};
```

---

## Metadata Overlay (Below Canvas)

```jsx
<div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
  <p className="font-display text-[var(--accent)] tracking-widest uppercase text-sm">
    {outfits[activeIndex]?.occasion ?? 'Saved Outfit'}
  </p>
  <p className="text-[var(--text-muted)] text-xs mt-1">
    {outfits[activeIndex]?.season ?? ''}
  </p>
  {outfits[activeIndex]?.rating && (
    <p className="text-[var(--accent)] text-xs mt-1">
      {'★'.repeat(outfits[activeIndex].rating)}{'☆'.repeat(5 - outfits[activeIndex].rating)}
    </p>
  )}
  <div className="flex justify-center gap-2 mt-3">
    {outfits.map((_, i) => (
      <div
        key={i}
        className={cn(
          'h-1 rounded-full transition-all duration-300',
          i === activeIndex ? 'w-4 bg-[var(--accent)]' : 'w-1 bg-[var(--text-muted)]'
        )}
      />
    ))}
  </div>
</div>
```

---

## useEffect Cleanup — CRITICAL

```js
return () => {
  cancelAnimationFrame(s.rafId);

  planes.forEach(p => {
    gsap.killTweensOf(p.mesh.position);
    gsap.killTweensOf(p.uniforms_proxy);
    p.mat.dispose();
    p.mesh.geometry.dispose();
    if (p.mat.uniforms.u_texture.value) {
      p.mat.uniforms.u_texture.value.dispose();
    }
  });

  renderer.dispose();
  if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);

  el.removeEventListener('mousedown',  onPointerDown);
  el.removeEventListener('mousemove',  onPointerMove);
  el.removeEventListener('mouseup',    onPointerUp);
  el.removeEventListener('touchstart', onPointerDown);
  el.removeEventListener('touchmove',  onPointerMove);
  el.removeEventListener('touchend',   onPointerUp);
};
```

---

## File 2 — MODIFY: `frontend/src/pages/OutfitBuilder.jsx`

### Add Import
```js
import OutfitGallery from '../components/OutfitGallery';
```

### Replace Saved Tab Content Only
Find the section rendering saved outfits. Replace the existing card grid/list with:

```jsx
{activeTab === 'saved' && (
  savedOutfits.length > 0
    ? <OutfitGallery outfits={savedOutfits} />
    : (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[var(--text-muted)] text-sm">No saved outfits yet</p>
        <p className="text-[var(--text-muted)] text-xs mt-1">
          Generate outfits and save the ones you like
        </p>
      </div>
    )
)}
```

**Do NOT touch:** Generate tab, outfit generation logic, API calls, filter dropdowns,
"Wear Today?" feature, or any other part of OutfitBuilder.jsx.

---

## Hard Constraints

- CSS: Use `var(--accent)`, `var(--bg-surface)`, `var(--text-muted)` — NEVER hardcode hex values
- Use `cn()` from `lib/utils.js` for all conditional Tailwind class merging
- Use `font-display` class for all display/heading text (Cormorant Garamond)
- Mobile-first — touch must work perfectly, phone is the primary device
- Geometry: `PlaneGeometry` only — `PlaneBufferGeometry` is deprecated, do not use it
- Animation: GSAP only — do NOT install or use Popmotion, anime.js, or any other library
- Do NOT create new routes, pages, or navigation elements
- Do NOT modify `OutfitCard.jsx` — it is still used in other places in the app
- Each plane must have its own ShaderMaterial instance — never share materials

---

## Verification Checklist

After implementation, verify every item:

- [ ] `npm run dev` starts with zero errors
- [ ] Saved tab renders WebGL canvas (not blank white or broken)
- [ ] Press on canvas — center image deforms with sticky Z displacement
- [ ] Drag left past 25% threshold — next outfit slides in with effect
- [ ] Drag right past 25% threshold — previous outfit slides in with effect
- [ ] Drag less than 25% and release — snaps back, no navigation
- [ ] After last outfit, drag left → wraps to first outfit (infinite loop)
- [ ] From first outfit, drag right → wraps to last outfit
- [ ] Dot indicators update on every navigation change
- [ ] Occasion + season label updates correctly per outfit
- [ ] Touch drag works on phone at `http://{LAN_IP}:5173`
- [ ] Navigate away from OutfitBuilder and back — zero console errors
- [ ] Generate tab still works — outfits can be generated and saved normally
