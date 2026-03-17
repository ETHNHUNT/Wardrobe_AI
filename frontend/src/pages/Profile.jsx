import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import axios from 'axios'
import { useToast } from '../components/Toast'
import { SKIN_TONES, UNDERTONES, SKIN_TONE_LABELS, UNDERTONE_LABELS } from '../lib/constants'

const COMMON_BRANDS = ['Zara', 'H&M', 'Uniqlo', 'Mango', 'Gap', 'Levi\'s', 'Nike', 'Adidas', 'Puma', 'Reebok', 'Gucci', 'Armani', 'Calvin Klein', 'Tommy Hilfiger', 'Ralph Lauren', 'Other']
const SIZE_OPTIONS  = ['XXS', 'XS', 'S', 'S/M', 'M', 'L', 'L/XL', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40', '42']
const SIZE_CHART_BRANDS = ['Zara', 'Uniqlo', 'H&M', 'Mango']

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
    skin_tone: '',
    undertone: '',
  })
  const [brandList, setBrandList] = useState([])      // Iteration 5: structured brand sizes
  const [newBrand, setNewBrand]   = useState('')
  const [newSize, setNewSize]     = useState('M')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [focused, setFocused]     = useState(null)
  const { toast } = useToast()

  // Brand Size Finder (v1.3)
  const [sizeBrand, setSizeBrand]         = useState('')
  const [sizeGarmentType, setSizeGarmentType] = useState('tops')
  const [sizeResult, setSizeResult]       = useState(null)
  const [sizeFetching, setSizeFetching]   = useState(false)
  const [sizeFetching2, setSizeFetching2] = useState(false) // for AI fetch new brand

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
          skin_tone:      data.skin_tone      ?? '',
          undertone:      data.undertone      ?? '',
        })
        setBrandList(parseBrandSizes(rawSizes))
      } catch (err) {
        console.error('[DEBUG] Failed to load profile:', err)
        toast({ message: 'Could not load profile — is the backend running?', type: 'error', duration: 4000 })
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

  async function handleSizeLookup() {
    if (!sizeBrand.trim()) return
    setSizeFetching(true)
    setSizeResult(null)
    try {
      const { data } = await axios.get(
        `${API_URL}/knowledge/size-chart/${encodeURIComponent(sizeBrand.trim())}`,
        { params: { garment_type: sizeGarmentType } }
      )
      setSizeResult(data)
    } catch {
      setSizeResult({ error: true })
    } finally {
      setSizeFetching(false)
    }
  }

  async function handleFetchNewBrand() {
    if (!sizeBrand.trim()) return
    setSizeFetching2(true)
    try {
      const { data } = await axios.post(
        `${API_URL}/knowledge/size-chart/${encodeURIComponent(sizeBrand.trim())}/fetch`
      )
      setSizeResult(data)
      toast({ message: `Size chart for ${sizeBrand} added!`, type: 'success', duration: 3000 })
    } catch {
      toast({ message: 'Could not fetch size chart — try again or add manually.', type: 'error', duration: 3000 })
    } finally {
      setSizeFetching2(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, brand_sizes: brandSizesToJson(brandList) }
      // Convert empty skin tone/undertone to null so backend doesn't store ""
      if (!payload.skin_tone) delete payload.skin_tone
      if (!payload.undertone) delete payload.undertone
      for (const field of MEASUREMENT_FIELDS) {
        const rawValue = payload[field.key]
        if (rawValue === '') { delete payload[field.key]; continue }
        const parsed = parseFloat(rawValue)
        if (Number.isFinite(parsed)) { payload[field.key] = parsed }
        else { delete payload[field.key] }
      }
      await axios.post(`${API_URL}/profile`, payload)
      toast({ message: 'Profile saved successfully', type: 'success', duration: 3000 })
    } catch (err) {
      console.error('Failed to save profile:', err)
      toast({ message: 'Save failed — check backend connection.', type: 'error', duration: 3000 })
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

        {/* Skin Tone & Undertone */}
        <div>
          <h2 className="text-xs uppercase tracking-[0.22em] mb-2" style={{ color: 'var(--accent)' }}>
            Skin Tone &amp; Undertone
          </h2>
          <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
            Used for personalized color recommendations in outfits and shopping
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Skin Tone
              </label>
              <select
                name="skin_tone"
                value={form.skin_tone}
                onChange={handleChange}
                onFocus={() => setFocused('skin_tone')}
                onBlur={() => setFocused(null)}
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none appearance-none"
                style={{ ...INPUT_STYLE, ...(focused === 'skin_tone' ? { border: INPUT_FOCUS_STYLE, boxShadow: INPUT_FOCUS_SHADOW } : {}) }}
              >
                <option value="">Not set</option>
                {SKIN_TONES.map((t) => (
                  <option key={t} value={t}>{SKIN_TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Undertone
              </label>
              <select
                name="undertone"
                value={form.undertone}
                onChange={handleChange}
                onFocus={() => setFocused('undertone')}
                onBlur={() => setFocused(null)}
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none appearance-none"
                style={{ ...INPUT_STYLE, ...(focused === 'undertone' ? { border: INPUT_FOCUS_STYLE, boxShadow: INPUT_FOCUS_SHADOW } : {}) }}
              >
                <option value="">Not set</option>
                {UNDERTONES.map((u) => (
                  <option key={u} value={u}>{UNDERTONE_LABELS[u]}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'rgba(107,101,96,0.5)' }}>
            Tip: Check wrist veins — green = warm, blue/purple = cool, both = neutral
          </p>
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

      {/* Brand Size Finder — outside the form so it doesn't submit on Enter */}
      <div className="px-5 pt-6 pb-10">
        <h2 className="text-xs uppercase tracking-[0.22em] mb-1.5" style={{ color: 'var(--accent)' }}>
          Brand Size Finder
        </h2>
        <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
          Find your recommended size based on your saved body measurements
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            list="size-finder-brands"
            value={sizeBrand}
            onChange={(e) => setSizeBrand(e.target.value)}
            onFocus={() => setFocused('size_brand')}
            onBlur={() => setFocused(null)}
            placeholder="Brand name…"
            className="flex-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            style={{ ...INPUT_STYLE, ...(focused === 'size_brand' ? { border: INPUT_FOCUS_STYLE, boxShadow: INPUT_FOCUS_SHADOW } : {}) }}
          />
          <datalist id="size-finder-brands">
            {SIZE_CHART_BRANDS.map((b) => <option key={b} value={b} />)}
          </datalist>

          <select
            value={sizeGarmentType}
            onChange={(e) => setSizeGarmentType(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm focus:outline-none appearance-none"
            style={{ ...INPUT_STYLE, minWidth: 90 }}
          >
            <option value="tops">Tops</option>
            <option value="bottoms">Bottoms</option>
          </select>

          <motion.button
            type="button"
            onClick={handleSizeLookup}
            disabled={!sizeBrand.trim() || sizeFetching}
            whileTap={{ scale: 0.92 }}
            className="rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid rgba(200,169,126,0.2)', color: 'var(--accent)' }}
          >
            {sizeFetching ? '…' : 'Find'}
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {sizeResult && !sizeResult.error && (
            <motion.div
              key="size-result"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl p-4"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid rgba(200,169,126,0.12)' }}
            >
              {sizeResult.recommendation?.recommended_size ? (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {sizeResult.recommendation.brand} — {sizeResult.recommendation.recommended_size}
                    </span>
                    {sizeResult.recommendation.next_size && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(200,169,126,0.08)', color: 'var(--text-muted)', border: '1px solid rgba(200,169,126,0.15)' }}>
                        or {sizeResult.recommendation.next_size}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {sizeResult.recommendation.fit_note}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                    {sizeResult.recommendation?.fit_note || `No size chart found for ${sizeResult.brand || sizeBrand}.`}
                  </p>
                  {sizeResult.available_brands?.length > 0 && (
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                      Available: {sizeResult.available_brands.join(', ')}
                    </p>
                  )}
                  <motion.button
                    type="button"
                    onClick={handleFetchNewBrand}
                    disabled={sizeFetching2}
                    whileTap={{ scale: 0.95 }}
                    className="mt-3 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
                    style={{ border: '1px solid rgba(200,169,126,0.25)', color: 'var(--accent)' }}
                  >
                    {sizeFetching2 ? 'Fetching via AI…' : `Fetch ${sizeBrand} chart via AI`}
                  </motion.button>
                </>
              )}
            </motion.div>
          )}
          {sizeResult?.error && (
            <motion.div
              key="size-error"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-xs p-3 rounded-xl"
              style={{ backgroundColor: 'rgba(248,113,113,0.06)', color: 'var(--danger)' }}
            >
              Could not fetch size chart. Check backend connection.
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}
