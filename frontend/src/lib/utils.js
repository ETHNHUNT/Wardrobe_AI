import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function parseJson(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

// Parse a comma-separated color string (used in edit forms) into a clean array.
// e.g. "navy, white , " → ["navy", "white"]
export function parseColorString(str) {
  if (!str) return []
  return str.split(',').map((s) => s.trim()).filter(Boolean)
}
