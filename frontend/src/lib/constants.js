// Shared enum-like arrays, style constants, and utility functions previously
// duplicated across AddItem.jsx, ItemDetailModal.jsx, Wardrobe.jsx, OutfitBuilder.jsx, and Shop.jsx.

export const CATEGORIES = [
  'tshirt', 'shirt', 'polo', 'jacket', 'hoodie', 'sweater',
  'jeans', 'chinos', 'trousers', 'shorts', 'shoes', 'sneakers',
  'boots', 'formal_shoes', 'accessory', 'other',
]

export const OCCASIONS = ['casual', 'work', 'formal', 'sport', 'outdoor']

export const SEASONS = ['spring', 'summer', 'fall', 'winter']

export const FIT_TYPES = ['slim', 'regular', 'oversized', 'relaxed']

// Base input style for all text/number/textarea fields across the app.
// Note: Profile.jsx has a variant with an extra transition property — kept local there.
export const INPUT_STYLE = {
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.08)',
}

// Toggle a value in/out of an array (immutable).
export function toggleArr(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

// Returns true if an item has a real photo (not null and not the 'tmp' placeholder).
export function isPhotoValid(item) {
  return Boolean(item?.photo_path && item.photo_path !== 'tmp')
}
