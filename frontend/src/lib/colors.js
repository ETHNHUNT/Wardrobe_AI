// Canonical color map for wardrobe color swatch rendering.
// Superset of all COLOR_MAP / COLOR_CSS definitions previously duplicated across
// Wardrobe.jsx, Shop.jsx, ItemCard.jsx, and ItemDetailModal.jsx.
export const COLOR_MAP = {
  black: '#1a1a1a', white: '#f0ede8', grey: '#9e9e9e', gray: '#9e9e9e',
  beige: '#f5f0e8', cream: '#fff8e7', offwhite: '#f5f0e8', charcoal: '#444',
  navy: '#1a2744', blue: '#2563eb', royalblue: '#4169e1', cobalt: '#0047ab',
  teal: '#008080', slate: '#708090', indigo: '#4b0082', denim: '#1560bd',
  lightblue: '#87ceeb', skyblue: '#87ceeb',
  red: '#dc2626', burgundy: '#800020', maroon: '#800000', orange: '#f97316',
  rust: '#b45309', terracotta: '#c2673c', brick: '#9c3b3b', pink: '#ec4899',
  brown: '#7c3f00', camel: '#c19a6b', khaki: '#c3b091', olive: '#6b6b35',
  tan: '#d2b48c', stone: '#918474', sand: '#c2b280', taupe: '#8b7d7b',
  yellow: '#fde047', lime: '#84cc16', purple: '#9333ea', violet: '#8b5cf6',
  coral: '#f87171', mint: '#6ee7b7', cyan: '#22d3ee', green: '#16a34a',
  ivory: '#fffff0',
}

// Resolves a color name to a CSS color string.
// Normalizes case, spaces, and hyphens before lookup (e.g. "light blue" → "lightblue").
export function getColorCSS(name) {
  const key = (name ?? '').toLowerCase().replace(/[\s\-]+/g, '')
  return COLOR_MAP[key] ?? name ?? '#888'
}
