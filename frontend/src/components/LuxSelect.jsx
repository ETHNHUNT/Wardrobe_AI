import { ChevronDown } from 'lucide-react'

/**
 * Luxury-styled native select wrapper.
 * Keeps native <select> for perfect mobile UX (OS picker on iOS/Android).
 * Visually elevated with gold focus ring and custom chevron.
 *
 * Usage:
 *   <LuxSelect
 *     value={form.category}
 *     onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
 *     options={CATEGORIES}        // string[] or { value, label }[]
 *     placeholder="Select category…"
 *     required
 *   />
 */
export default function LuxSelect({
  value,
  onChange,
  options = [],
  placeholder,
  required,
  className = '',
  id,
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className={`lux-select ${className}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => {
          if (typeof opt === 'string') {
            return (
              <option key={opt} value={opt}>
                {opt}
              </option>
            )
          }
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          )
        })}
      </select>
      <ChevronDown
        size={15}
        strokeWidth={1.5}
        style={{
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
