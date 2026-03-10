/**
 * Invisible grain texture overlay — a luxury web design staple.
 * Used by: Stone Island, SSENSE, Dover Street Market, Maison Margiela.
 * Opacity 0.04 — barely perceptible but adds depth and tactility.
 * Zero performance cost: CSS SVG filter, fixed position, pointer-events-none.
 */
export default function NoiseOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n' color-interpolation-filters='linearRGB'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '250px 250px',
      }}
    />
  )
}
