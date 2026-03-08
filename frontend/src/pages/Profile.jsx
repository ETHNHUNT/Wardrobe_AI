import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

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
}
const INPUT_FOCUS_STYLE = '1px solid rgba(200,169,126,0.55)'

export default function Profile() {
  const [form, setForm] = useState({
    name: '',
    height_cm: '', weight_kg: '', chest_cm: '', waist_cm: '',
    hips_cm: '', inseam_cm: '', shoulder_cm: '', arm_length_cm: '', neck_cm: '',
    brand_sizes: '{}',
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [toastOk, setToastOk]   = useState(true)
  const [focused, setFocused]   = useState(null)
  const toastTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await axios.get(`${API_URL}/profile`)
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
          brand_sizes:    data.brand_sizes    ?? '{}',
        })
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

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
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
        <p className="text-xs tracking-[0.28em] uppercase mb-1.5" style={{ color: 'var(--accent)' }}>Your</p>
        <h1 className="text-2xl font-light" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Profile</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
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
            style={{ ...INPUT_STYLE, ...(focused === 'name' ? { border: INPUT_FOCUS_STYLE } : {}) }}
          />
        </div>

        {/* Measurements */}
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--accent)' }}>
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
                  style={{ ...INPUT_STYLE, ...(focused === key ? { border: INPUT_FOCUS_STYLE } : {}) }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Brand sizes */}
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] mb-1.5" style={{ color: 'var(--accent)' }}>
            Brand Sizes
          </label>
          <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            JSON format: {`{"Zara": "M", "H&M": "L"}`}
          </p>
          <textarea
            name="brand_sizes"
            value={form.brand_sizes}
            onChange={handleChange}
            onFocus={() => setFocused('brand_sizes')}
            onBlur={() => setFocused(null)}
            rows={3}
            className="w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none transition-colors duration-150"
            style={{ ...INPUT_STYLE, ...(focused === 'brand_sizes' ? { border: INPUT_FOCUS_STYLE } : {}) }}
            placeholder='{"Zara": "M", "H&M": "L"}'
          />
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
