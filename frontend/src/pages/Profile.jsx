import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import axios from 'axios'

const COMMON_BRANDS = ['Zara', 'H&M', 'Uniqlo', 'Mango', 'Gap', 'Levi\'s', 'Nike', 'Adidas', 'Puma', 'Reebok', 'Gucci', 'Armani', 'Calvin Klein', 'Tommy Hilfiger', 'Ralph Lauren', 'Other']
const SIZE_OPTIONS  = ['XXS', 'XS', 'S', 'S/M', 'M', 'L', 'L/XL', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40', '42']

const API_URL = import.meta.env.VITE_API_URL

const MEASUREMENT_FIELDS = [
  { key: 'height_cm',     label: 'Height (cm)'     },
  { key: 'weight_kg',     label: 'Weight (kg)'     },
  { key: 'chest_cm',      label: 'Chest (cm)'      },
  { key: 'waist_cm',      label: 'Waist (cm)'      },
  { key: 'hips_cm',       label: 'Hips (cm)'       },
  { key: 'inseam_cm',     label: 'Inseam (cm)'     },
  { key: 'shoulder_cm',   label: 'Shoulder (cm)'   },
  { key: 'arm_length_cm', label: 'Arm Length (cm)' },
  { key: 'neck_cm',       label: 'Neck (cm)'       },
]

const INPUT_STYLE = {
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.08)',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
}
const INPUT_FOCUS_STYLE = '1px solid rgba(200,169,126,0.55)'
const INPUT_FOCUS_SHADOW = '0 0 0 3px rgba(200,169,126,0.06)'

function parseBrandSizes(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr || '{}')
    return Object.entries(obj).map(([brand, size]) => ({ brand, size }))
  } catch {
    return []
  }
}
function brandSizesToJson(list) {
  const obj = {}
  for (const { brand, size } of list) {
    if (brand.trim()) obj[brand.trim()] = size
  }
  return JSON.stringify(obj)
}

export default function Profile() {
  const [form, setForm] = useState({
    name: '',
    height_cm: '', weight_kg: '', chest_cm: '', waist_cm: '',
    hips_cm: '', inseam_cm: '', shoulder_cm: '', arm_length_cm: '', neck_cm: '',
    brand_sizes: '{}',
  })
  const [brandList, setBrandList] = useState([])      // Iteration 5: structured brand sizes
  const [newBrand, setNewBrand]   = useState('')
  const [newSize, setNewSize]     = useState('M')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState('')
  const [toastOk, setToastOk]     = useState(true)
  const [focused, setFocused]     = useState(null)
  const toastTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await axios.get(`${API_URL}/profile`)
        const rawSizes = data.brand_sizes ?? '{}'
        setForm({
          name:           data.name           ?? '',
          height_cm:      data.height_cm      ?? '',
          weight_kg:      data.weight_kg      ?? '',
          chest_cm:       data.chest_cm       ?? '',
          waist_cm:       data.waist_cm       ?? '',
          hips_cm:        data.hips_cm        ?? '',
          inseam_cm:      data.inseam_cm      ?? '',
          shoulder_cm:    data.shoulder_cm    ?? '',
          arm_length_cm:  data.arm_length_cm  ?? '',
          neck_cm:        data.neck_cm        ?? '',
          brand_sizes:    rawSizes,
        })
        setBrandList(parseBrandSizes(rawSizes))
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function addBrandSize() {
    if (!newBrand.trim()) return
    setBrandList((prev) => {
      const filtered = prev.filter((b) => b.brand.toLowerCase() !== newBrand.trim().toLowerCase())
      return [...filtered, { brand: newBrand.trim(), size: newSize }]
    })
    setNewBrand('')
    setNewSize('M')
  }

  function removeBrandSize(brand) {
    setBrandList((prev) => prev.filter((b) => b.brand !== brand))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, brand_sizes: brandSizesToJson(brandList) }
      for (const field of MEASUREMENT_FIELDS) {
        const rawValue = payload[field.key]
        if (rawValue === '') { delete payload[field.key]; continue }
        const parsed = parseFloat(rawValue)
        if (Number.isFinite(parsed)) { payload[field.key] = parsed }
        else { delete payload[field.key] }
      }
      await axios.post(`${API_URL}/profile`, payload)
      setToastOk(true)
      setToast('Profile saved successfully')
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setToast(''), 3000)
    } catch (err) {
      console.error('Failed to save profile:', err)
      setToastOk(false)
      setToast('Save failed — check backend connection.')
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setToast(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-5 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.32em] uppercase mb-1.5" style={{ color: 'var(--accent)' }}>Your</p>
        <h1 className="text-3xl serif-display" style={{ color: 'var(--text-primary)' }}>Profile</h1>
        <p className="text-sm mt-1.5" style={{ color: 'rgba(107,101,96,0.7)' }}>
          Measurements used for outfit and shopping recommendations
        </p>
      </div>

      <form onSubmit={handleSave} className="px-5 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--accent)' }}>Name</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
            className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors duration-150"
            style={{ ...INPUT_STYLE, ...(focused === 'name' ? { border: INPUT_FOCUS_STYLE, boxShadow: INPUT_FOCUS_SHADOW } : {}) }}
          />
        </div>

        {/* Measurements */}
        <div>
          <h2 className="text-xs uppercase tracking-[0.22em] mb-4" style={{ color: 'var(--accent)', letterSpacing: '0.2em' }}>
            Body Measurements
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {MEASUREMENT_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </label>
                <input
                  type="number"
                  name={key}
                  value={form[key]}
                  onChange={handleChange}
                  onFocus={() => setFocused(key)}
                  onBlur={() => setFocused(null)}
                  step="0.1"
                  min="0"
                  placeholder="0"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors duration-150"
                  style={{ ...INPUT_STYLE, ...(focused === key ? { border: INPUT_FOCUS_STYLE, boxShadow: INPUT_FOCUS_SHADOW } : {}) }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Brand sizes — Iteration 5: structured UI replacing raw JSON textarea */}
        {/* Framer Motion for each row add/remove */}
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--accent)' }}>
            Brand Sizes
          </label>

          {/* Existing brand size rows */}
          <div className="space-y-2 mb-3">
            <AnimatePresence>
              {brandList.map(({ brand, size }) => (
                <motion.div
                  key={brand}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{brand}</span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(200,169,126,0.2)' }}>
                    {size}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBrandSize(brand)}
                    className="p-1 rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: 'rgba(248,113,113,0.6)' }}
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add new brand size row */}
          <div className="flex gap-2">
            <input
              type="text"
              list="brand-suggestions"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              onFocus={() => setFocused('new_brand')}
              onBlur={() => setFocused(null)}
              placeholder="Brand name…"
              className="flex-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ ...INPUT_STYLE, ...(focused === 'new_brand' ? { border: INPUT_FOCUS_STYLE, boxShadow: INPUT_FOCUS_SHADOW } : {}) }}
            />
            <datalist id="brand-suggestions">
              {COMMON_BRANDS.map((b) => <option key={b} value={b} />)}
            </datalist>
            <select
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              className="rounded-xl px-3 py-2.5 text-sm focus:outline-none appearance-none text-center"
              style={{ ...INPUT_STYLE, minWidth: 70, ...(focused === 'new_size' ? { border: INPUT_FOCUS_STYLE, boxShadow: INPUT_FOCUS_SHADOW } : {}) }}
              onFocus={() => setFocused('new_size')}
              onBlur={() => setFocused(null)}
            >
              {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <motion.button
              type="button"
              onClick={addBrandSize}
              whileTap={{ scale: 0.92 }}
              className="rounded-xl px-3 py-2.5 flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid rgba(200,169,126,0.2)', color: 'var(--accent)' }}
            >
              <Plus size={16} strokeWidth={2.5} />
            </motion.button>
          </div>
        </div>

        {/* Save button */}
        <motion.button
          type="submit"
          disabled={saving}
          whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #C8A97E 0%, #9A7A52 100%)', color: '#0C0C0C' }}
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </motion.button>
      </form>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-24 left-5 right-5 text-sm text-center py-3.5 rounded-2xl z-[200]"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: `1px solid ${toastOk ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
              color: toastOk ? '#4ADE80' : '#F87171',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
