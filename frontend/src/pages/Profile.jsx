import { useEffect, useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

const MEASUREMENT_FIELDS = [
  { key: 'height_cm', label: 'Height (cm)' },
  { key: 'weight_kg', label: 'Weight (kg)' },
  { key: 'chest_cm', label: 'Chest (cm)' },
  { key: 'waist_cm', label: 'Waist (cm)' },
  { key: 'hips_cm', label: 'Hips (cm)' },
  { key: 'inseam_cm', label: 'Inseam (cm)' },
  { key: 'shoulder_cm', label: 'Shoulder (cm)' },
  { key: 'arm_length_cm', label: 'Arm Length (cm)' },
  { key: 'neck_cm', label: 'Neck (cm)' },
]

export default function Profile() {
  const [form, setForm] = useState({
    name: '',
    height_cm: '',
    weight_kg: '',
    chest_cm: '',
    waist_cm: '',
    hips_cm: '',
    inseam_cm: '',
    shoulder_cm: '',
    arm_length_cm: '',
    neck_cm: '',
    brand_sizes: '{}',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await axios.get(`${API_URL}/profile`)
        setForm({
          name: data.name ?? '',
          height_cm: data.height_cm ?? '',
          weight_kg: data.weight_kg ?? '',
          chest_cm: data.chest_cm ?? '',
          waist_cm: data.waist_cm ?? '',
          hips_cm: data.hips_cm ?? '',
          inseam_cm: data.inseam_cm ?? '',
          shoulder_cm: data.shoulder_cm ?? '',
          arm_length_cm: data.arm_length_cm ?? '',
          neck_cm: data.neck_cm ?? '',
          brand_sizes: data.brand_sizes ?? '{}',
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
      // Convert numeric strings to floats; omit invalid values so backend keeps prior value
      const payload = { ...form }
      for (const field of MEASUREMENT_FIELDS) {
        const rawValue = payload[field.key]
        if (rawValue === '') {
          // Remove empty-string measurements so backend treats them as None
          delete payload[field.key]
          continue
        }
        const parsed = parseFloat(rawValue)
        if (Number.isFinite(parsed)) {
          payload[field.key] = parsed
        } else {
          delete payload[field.key]
        }
      }
      await axios.post(`${API_URL}/profile`, payload)
      setToast('Profile saved!')
      setTimeout(() => setToast(''), 3000)
    } catch (err) {
      console.error('Failed to save profile:', err)
      setToast('Save failed — check backend connection.')
      setTimeout(() => setToast(''), 4000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-400 mt-0.5">Measurements used for outfit and shopping recommendations</p>
      </div>

      <form onSubmit={handleSave} className="px-4 py-4 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Measurements */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Body Measurements</h2>
          <div className="grid grid-cols-2 gap-3">
            {MEASUREMENT_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="number"
                  name={key}
                  value={form[key]}
                  onChange={handleChange}
                  step="0.1"
                  min="0"
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Brand sizes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Brand Sizes
            <span className="ml-2 text-xs text-gray-400 font-normal">JSON format: {`{"Zara": "M", "H&M": "L"}`}</span>
          </label>
          <textarea
            name="brand_sizes"
            value={form.brand_sizes}
            onChange={handleChange}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder='{"Zara": "M", "H&M": "L"}'
          />
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-gray-900 text-white text-sm text-center py-3 rounded-xl shadow-lg z-50 transition-opacity">
          {toast}
        </div>
      )}
    </div>
  )
}
