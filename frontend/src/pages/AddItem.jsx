import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

const CATEGORIES = ['tshirt', 'shirt', 'polo', 'jacket', 'hoodie', 'sweater', 'jeans', 'chinos', 'trousers', 'shorts', 'shoes', 'sneakers', 'boots', 'formal_shoes', 'accessory', 'other']
const FIT_TYPES = ['slim', 'regular', 'oversized', 'relaxed']
const OCCASIONS = ['casual', 'work', 'formal', 'sport', 'outdoor']
const SEASONS = ['spring', 'summer', 'fall', 'winter']

// State machine: idle → previewing → uploading → done | manual_form
export default function AddItem() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const previewUrlRef = useRef(null)

  const [phase, setPhase] = useState('idle') // idle | camera | previewing | uploading | done | manual_form
  const [preview, setPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [savedItem, setSavedItem] = useState(null)
  const [error, setError] = useState('')

  // Manual form state
  const [manualForm, setManualForm] = useState({
    category: '',
    fit_type: '',
    brand: '',
    size_label: '',
    colors: '',
    notes: '',
    occasions: [],
    seasons: [],
  })
  const [savingManual, setSavingManual] = useState(false)

  // Stop camera and revoke any object URL on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  function setPreviewUrl(url) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = url
    setPreview(url)
  }

  // ── Camera ──────────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setPhase('camera')
    } catch {
      // Fallback to file picker if camera not available
      fileInputRef.current?.click()
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Failed to capture photo. Please try again.')
        return
      }
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      stopCamera()
      setPhotoFile(file)
      setPreviewUrl(URL.createObjectURL(blob))
      setPhase('previewing')
    }, 'image/jpeg', 0.9)
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setPhase('previewing')
  }

  function retake() {
    setPhotoFile(null)
    setPreview(null)
    setError('')
    setPhase('idle')
  }

  // ── Upload & AI tagging ─────────────────────────────────────────────────
  async function uploadPhoto() {
    if (!photoFile) return
    setPhase('uploading')
    setError('')

    const formData = new FormData()
    formData.append('photo', photoFile)

    try {
      const { data } = await axios.post(`${API_URL}/items`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSavedItem(data)

      if (!data.ai_tagged || data.category === 'unknown') {
        // Pre-fill manual form with whatever AI returned
        setManualForm((prev) => ({
          ...prev,
          category: data.category !== 'unknown' ? data.category : '',
          fit_type: data.fit_type ?? '',
          brand: data.brand ?? '',
          size_label: data.size_label ?? '',
          occasions: tryParseArray(data.occasions),
          seasons: tryParseArray(data.seasons),
        }))
        setPhase('manual_form')
      } else {
        setPhase('done')
      }
    } catch (err) {
      setError('Upload failed. Make sure the backend is running.')
      setPhase('previewing')
    }
  }

  function tryParseArray(str) {
    try { return JSON.parse(str) } catch { return [] }
  }

  // ── Manual form ─────────────────────────────────────────────────────────
  function toggleArrayItem(key, value) {
    setManualForm((prev) => {
      const arr = prev[key]
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      }
    })
  }

  async function saveManualTags(e) {
    e.preventDefault()
    if (!savedItem) return
    setSavingManual(true)
    try {
      const payload = {
        category: manualForm.category || 'other',
        fit_type: manualForm.fit_type || null,
        brand: manualForm.brand || null,
        size_label: manualForm.size_label || null,
        notes: manualForm.notes || null,
        colors: JSON.stringify(manualForm.colors ? manualForm.colors.split(',').map((s) => s.trim()) : []),
        occasions: JSON.stringify(manualForm.occasions),
        seasons: JSON.stringify(manualForm.seasons),
      }
      await axios.put(`${API_URL}/items/${savedItem.id}`, payload)
      setPhase('done')
    } catch (err) {
      setError('Failed to save tags. Try again.')
    } finally {
      setSavingManual(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 pb-20">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Item added!</h2>
        <p className="text-gray-500 text-sm mb-8">Your clothing has been saved to your wardrobe.</p>
        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={() => { setPhase('idle'); setPreview(null); setPhotoFile(null); setSavedItem(null) }}
            className="flex-1 border border-indigo-600 text-indigo-600 font-semibold py-3 rounded-xl"
          >
            Add Another
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 bg-indigo-600 text-white font-semibold py-3 rounded-xl"
          >
            View Wardrobe
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'uploading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 pb-20">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-lg font-semibold text-gray-800 mb-1">AI is analyzing your item…</h2>
        <p className="text-sm text-gray-400 text-center">First run may take up to 30 seconds while the model loads.</p>
      </div>
    )
  }

  if (phase === 'manual_form') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Tag Your Item</h1>
          <p className="text-sm text-gray-400 mt-0.5">AI couldn't auto-tag this photo. Fill in the details below.</p>
        </div>

        {preview && (
          <div className="px-4 pt-4">
            <img src={preview} alt="Uploaded item" className="w-32 h-40 object-cover rounded-xl shadow-sm mx-auto" />
          </div>
        )}

        <form onSubmit={saveManualTags} className="px-4 py-4 space-y-5">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={manualForm.category}
              onChange={(e) => setManualForm((p) => ({ ...p, category: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-900"
            >
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Fit type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fit Type</label>
            <select
              value={manualForm.fit_type}
              onChange={(e) => setManualForm((p) => ({ ...p, fit_type: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-900"
            >
              <option value="">Select fit…</option>
              {FIT_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Brand & size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Brand</label>
              <input
                type="text"
                value={manualForm.brand}
                onChange={(e) => setManualForm((p) => ({ ...p, brand: e.target.value }))}
                placeholder="Zara, H&M…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Size</label>
              <input
                type="text"
                value={manualForm.size_label}
                onChange={(e) => setManualForm((p) => ({ ...p, size_label: e.target.value }))}
                placeholder="M, L, 32…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900"
              />
            </div>
          </div>

          {/* Colors */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Colors</label>
            <input
              type="text"
              value={manualForm.colors}
              onChange={(e) => setManualForm((p) => ({ ...p, colors: e.target.value }))}
              placeholder="navy, white (comma-separated)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white text-gray-900"
            />
          </div>

          {/* Occasions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Occasions</label>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggleArrayItem('occasions', o)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    manualForm.occasions.includes(o)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Seasons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Seasons</label>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleArrayItem('seasons', s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    manualForm.seasons.includes(s)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={manualForm.notes}
              onChange={(e) => setManualForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Any notes about this item…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white text-gray-900"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={savingManual}
            className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl disabled:opacity-60"
          >
            {savingManual ? 'Saving…' : 'Save Item'}
          </button>
        </form>
      </div>
    )
  }

  if (phase === 'camera') {
    return (
      <div className="min-h-screen bg-black flex flex-col pb-20">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="flex-1 w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex items-center justify-around p-6 bg-black">
          <button
            onClick={() => { stopCamera(); setPhase('idle') }}
            className="text-white text-sm"
          >
            Cancel
          </button>
          <button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-colors"
          />
          <div className="w-16" />
        </div>
      </div>
    )
  }

  if (phase === 'previewing') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 pb-20">
        <img src={preview} alt="Preview" className="max-h-96 rounded-2xl shadow-md object-contain mb-6" />
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <div className="flex gap-3 w-full max-w-sm">
          <button onClick={retake} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl">
            Retake
          </button>
          <button onClick={uploadPhoto} className="flex-1 bg-indigo-600 text-white font-semibold py-3 rounded-xl">
            Use Photo
          </button>
        </div>
      </div>
    )
  }

  // idle
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Add Item</h1>
        <p className="text-sm text-gray-400 mt-0.5">Take a photo or upload from your gallery</p>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-16 gap-4">
        {/* Camera button */}
        <button
          onClick={startCamera}
          className="w-full max-w-sm bg-indigo-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Take Photo
        </button>

        {/* File upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-sm border-2 border-dashed border-gray-300 text-gray-600 font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload from Gallery
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <p className="text-xs text-gray-400 text-center mt-2">
          AI will automatically tag your item.<br />
          First scan may take up to 30 seconds.
        </p>
      </div>
    </div>
  )
}
