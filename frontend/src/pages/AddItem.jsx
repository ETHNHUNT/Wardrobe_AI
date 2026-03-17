import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, CheckCircle2, RotateCcw, Barcode, Tag } from 'lucide-react'
import axios from 'axios'
import BarcodeScanner from '../components/BarcodeScanner'
import SplineScene from '../components/SplineScene'
import LuxSelect from '../components/LuxSelect'
import PhaseIndicator from '../components/PhaseIndicator'
import { parseJson, parseColorString } from '../lib/utils'
import { SCENES } from '../lib/scenes'
import { CATEGORIES, FIT_TYPES, OCCASIONS, SEASONS, INPUT_STYLE, toggleArr } from '../lib/constants'

const API_URL = import.meta.env.VITE_API_URL

// State machine: idle → previewing → uploading → done | manual_form
export default function AddItem() {
  const navigate = useNavigate()
  const fileInputRef  = useRef(null)
  const streamRef     = useRef(null)
  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const previewUrlRef = useRef(null)

  const [phase, setPhase]                       = useState('idle')
  const [barcodeInfo, setBarcodeInfo]           = useState(null)
  const [preview, setPreview]                   = useState(null)
  const [photoFile, setPhotoFile]               = useState(null)
  const [savedItem, setSavedItem]               = useState(null)
  const [error, setError]                       = useState('')
  const [onlineLookupResult, setOnlineLookupResult] = useState(null)
  // Iteration 2: label scan mode — camera captures label photo instead of clothing
  const [labelScanMode, setLabelScanMode] = useState(false)
  const [labelScanResult, setLabelScanResult] = useState(null)
  const [labelScanLoading, setLabelScanLoading] = useState(false)

  const [manualForm, setManualForm] = useState({
    category: '', fit_type: '', brand: '', size_label: '',
    colors: '', notes: '', occasions: [], seasons: [],
    // Iteration 1: garment specs
    material: '',
    garment_measurements: { chest_width_cm: '', body_length_cm: '', sleeve_cm: '', waist_cm: '' },
  })
  const [savingManual, setSavingManual] = useState(false)

  useEffect(() => {
    return () => {
      stopCamera()
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  function setPreviewUrl(url) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = url
    setPreview(url)
  }

  // ── Camera ──────────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setPhase('camera')
    } catch (err) {
      const isPermission = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
      if (isPermission) {
        setError('Camera permission denied. Please allow camera access in your browser settings, or use "Upload from Gallery" below.')
      } else {
        // No camera available — silently fall back to file picker
        fileInputRef.current?.click()
      }
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function capturePhoto() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) { setError('Failed to capture photo. Please try again.'); return }
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
    setBarcodeInfo(null)
    setPhase('idle')
  }

  // ── Barcode ──────────────────────────────────────────────────────────────
  async function handleBarcodeScanned(upc) {
    setError('')
    try {
      const { data } = await axios.get(`${API_URL}/items/barcode/${upc}`)
      setBarcodeInfo(data)
      setManualForm((prev) => ({
        ...prev,
        brand:      data.brand ?? '',
        size_label: data.size  ?? '',
        colors:     data.color ?? '',
        notes:      data.title ?? '',
      }))
    } catch {
      setBarcodeInfo({})
    }
    setPhase('idle')
  }

  // ── Label scan (Iteration 2) ─────────────────────────────────────────────
  async function handleLabelPhotoCapture(file) {
    setLabelScanLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const { data } = await axios.post(`${API_URL}/items/scan-label`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setLabelScanResult(data)
      // Pre-fill the manual form with whatever the label had
      if (data && Object.keys(data).length > 0) {
        setManualForm((prev) => ({
          ...prev,
          brand:      data.brand    ?? prev.brand,
          size_label: data.size     ?? prev.size_label,
          material:   data.material ?? prev.material,
          notes:      data.other_text ? `Label: ${data.other_text}` : prev.notes,
        }))
      }
    } catch {
      setLabelScanResult({})
    } finally {
      setLabelScanLoading(false)
    }
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  async function uploadPhoto() {
    if (!photoFile) return
    setPhase('uploading')
    setError('')

    const formData = new FormData()
    formData.append('photo', photoFile)
    if (barcodeInfo && Object.keys(barcodeInfo).length > 0) {
      const meta = {}
      if (barcodeInfo.brand) meta.brand      = barcodeInfo.brand
      if (barcodeInfo.size)  meta.size_label = barcodeInfo.size
      if (barcodeInfo.color) meta.colors     = [barcodeInfo.color]
      if (barcodeInfo.title) meta.notes      = barcodeInfo.title
      formData.append('metadata', JSON.stringify(meta))
    }

    try {
      const { data } = await axios.post(`${API_URL}/items`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSavedItem(data)

      const needsManual = !data.ai_tagged || data.category === 'unknown'
      if (needsManual) {
        setManualForm((prev) => ({
          ...prev,
          category:   data.category !== 'unknown' ? data.category : '',
          fit_type:   data.fit_type   ?? '',
          brand:      data.brand      ?? '',
          size_label: data.size_label ?? '',
          occasions:  parseJson(data.occasions),
          seasons:    parseJson(data.seasons),
        }))
      }

      // Show online_lookup phase if backend found product data
      if (data.product_url || data.source_description) {
        setOnlineLookupResult({ url: data.product_url, description: data.source_description })
        setPhase('online_lookup')
        setTimeout(() => setPhase(needsManual ? 'manual_form' : 'done'), 3000)
      } else {
        setPhase(needsManual ? 'manual_form' : 'done')
      }
    } catch {
      setError('Upload failed. Make sure the backend is running.')
      setPhase('previewing')
    }
  }

  // ── Manual form ──────────────────────────────────────────────────────────
  function toggleArrayItem(key, value) {
    setManualForm((prev) => ({ ...prev, [key]: toggleArr(prev[key], value) }))
  }

  async function saveManualTags(e) {
    e.preventDefault()
    if (!savedItem) return
    setSavingManual(true)
    try {
      // Build garment_measurements: only include fields that have a numeric value
      const gm = {}
      for (const [k, v] of Object.entries(manualForm.garment_measurements)) {
        const n = parseFloat(v)
        if (!isNaN(n) && n > 0) gm[k] = n
      }
      const payload = {
        category:   manualForm.category   || 'other',
        fit_type:   manualForm.fit_type   || null,
        brand:      manualForm.brand      || null,
        size_label: manualForm.size_label || null,
        notes:      manualForm.notes      || null,
        material:   manualForm.material   || null,
        colors:     parseColorString(manualForm.colors),
        occasions:  manualForm.occasions,
        seasons:    manualForm.seasons,
        ...(Object.keys(gm).length > 0 && { garment_measurements: gm }),
      }
      await axios.put(`${API_URL}/items/${savedItem.id}`, payload)
      setPhase('done')
    } catch {
      setError('Failed to save tags. Try again.')
    } finally {
      setSavingManual(false)
    }
  }

  // ── Render phases ─────────────────────────────────────────────────────────

  if (phase === 'barcode') {
    return <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setPhase('idle')} />
  }

  if (phase === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 20 }}
          className="mb-6"
        >
          <CheckCircle2 size={64} strokeWidth={1.25} style={{ color: 'var(--accent)' }} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl font-light mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Item Added
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Your clothing has been saved to your wardrobe.
          </p>
        </motion.div>
        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={() => { setPhase('idle'); setPreview(null); setPhotoFile(null); setSavedItem(null) }}
            className="flex-1 py-3.5 rounded-2xl text-sm font-medium transition-colors duration-150"
            style={{ border: '1px solid rgba(200,169,126,0.4)', color: 'var(--accent)' }}
          >
            Add Another
          </button>
          <motion.button
            onClick={() => navigate('/')}
            whileTap={{ scale: 0.97 }}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #C8A97E 0%, #9A7A52 100%)', color: '#0C0C0C' }}
          >
            View Wardrobe
          </motion.button>
        </div>
      </div>
    )
  }

  if (phase === 'online_lookup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="absolute top-0 left-0 right-0">
          <PhaseIndicator phase={phase} />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-sm rounded-2xl p-5 mt-16"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(200,169,126,0.15)' }}
        >
          <p className="text-[10px] tracking-[0.32em] uppercase mb-3" style={{ color: 'var(--accent)' }}>
            Found Online
          </p>
          {onlineLookupResult?.description && (
            <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-primary)' }}>
              {onlineLookupResult.description}
            </p>
          )}
          {onlineLookupResult?.url && (
            <a
              href={onlineLookupResult.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs underline underline-offset-2 mb-3"
              style={{ color: 'var(--accent)' }}
            >
              View product source ↗
            </a>
          )}
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Continuing automatically…
          </p>
        </motion.div>
      </div>
    )
  }

  if (phase === 'uploading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="absolute top-0 left-0 right-0">
          <PhaseIndicator phase={phase} />
        </div>
        {/* Concentric pulsing rings */}
        <div className="relative flex items-center justify-center mb-10" style={{ width: 140, height: 140 }}>
          <div className="absolute rounded-full ring-pulse-3" style={{ width: 132, height: 132, border: '1px solid rgba(200,169,126,0.1)' }} />
          <div className="absolute rounded-full ring-pulse-2" style={{ width: 96, height: 96, border: '1px solid rgba(200,169,126,0.2)' }} />
          <div className="absolute rounded-full ring-pulse-1" style={{ width: 60, height: 60, border: '1px solid rgba(200,169,126,0.35)' }} />
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid rgba(200,169,126,0.4)' }}>
            <Camera size={16} style={{ color: 'var(--accent)' }} />
          </div>
        </div>
        <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: 'var(--accent)' }}>
          Analyzing
        </p>
        <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
          AI is tagging your item. First run may take up to 30 seconds.
        </p>
      </div>
    )
  }

  if (phase === 'manual_form') {
    return (
      <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <PhaseIndicator phase={phase} />
        <div className="px-5 pt-4 pb-5">
          <p className="text-[10px] tracking-[0.32em] uppercase mb-1.5" style={{ color: 'var(--accent)' }}>Manual Tag</p>
          <h1 className="text-3xl serif-display" style={{ color: 'var(--text-primary)' }}>
            Tag Your Item
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            AI couldn't auto-tag this photo. Fill in the details below.
          </p>
        </div>

        {preview && (
          <div className="px-5 pb-5">
            <img src={preview} alt="Uploaded item" className="w-28 h-36 object-cover rounded-2xl mx-auto" style={{ border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }} />
          </div>
        )}

        <form onSubmit={saveManualTags} className="px-5 pb-8 space-y-5">
          <div>
            <label className="block text-xs tracking-wider uppercase mb-2" style={{ color: 'var(--accent)' }}>Category *</label>
            <LuxSelect
              value={manualForm.category}
              onChange={(e) => setManualForm((p) => ({ ...p, category: e.target.value }))}
              options={CATEGORIES}
              placeholder="Select category…"
              required
            />
          </div>

          <div>
            <label className="block text-xs tracking-wider uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Fit Type</label>
            <LuxSelect
              value={manualForm.fit_type}
              onChange={(e) => setManualForm((p) => ({ ...p, fit_type: e.target.value }))}
              options={FIT_TYPES}
              placeholder="Select fit…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Brand</label>
              <input type="text" value={manualForm.brand}
                onChange={(e) => setManualForm((p) => ({ ...p, brand: e.target.value }))}
                placeholder="Zara, H&M…" className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={INPUT_STYLE} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Size</label>
              <input type="text" value={manualForm.size_label}
                onChange={(e) => setManualForm((p) => ({ ...p, size_label: e.target.value }))}
                placeholder="M, L, 32…" className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={INPUT_STYLE} />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Colors</label>
            <input type="text" value={manualForm.colors}
              onChange={(e) => setManualForm((p) => ({ ...p, colors: e.target.value }))}
              placeholder="navy, white (comma-separated)"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={INPUT_STYLE} />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>Occasions</label>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => {
                const active = manualForm.occasions.includes(o)
                return (
                  <button key={o} type="button" onClick={() => toggleArrayItem('occasions', o)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
                    style={active
                      ? { backgroundColor: 'var(--accent)', color: '#0C0C0C', fontWeight: 600 }
                      : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                    }
                  >{o}</button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>Seasons</label>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map((s) => {
                const active = manualForm.seasons.includes(s)
                return (
                  <button key={s} type="button" onClick={() => toggleArrayItem('seasons', s)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
                    style={active
                      ? { backgroundColor: 'var(--accent)', color: '#0C0C0C', fontWeight: 600 }
                      : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                    }
                  >{s}</button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Material / Fabric</label>
            <input type="text" value={manualForm.material}
              onChange={(e) => setManualForm((p) => ({ ...p, material: e.target.value }))}
              placeholder="100% cotton, polyester blend…"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={INPUT_STYLE} />
          </div>

          {/* Garment Measurements — plain Tailwind, no animation needed (static form fields) */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Garment Measurements <span style={{ color: 'rgba(107,101,96,0.5)' }}>(cm, measured flat)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'chest_width_cm', label: 'Chest Width' },
                { key: 'body_length_cm', label: 'Body Length' },
                { key: 'sleeve_cm',      label: 'Sleeve' },
                { key: 'waist_cm',       label: 'Waist / Hip' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(107,101,96,0.7)' }}>{label}</label>
                  <input
                    type="number" min="0" step="0.5"
                    value={manualForm.garment_measurements[key]}
                    onChange={(e) => setManualForm((p) => ({
                      ...p,
                      garment_measurements: { ...p.garment_measurements, [key]: e.target.value }
                    }))}
                    placeholder="cm"
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    style={INPUT_STYLE}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <textarea value={manualForm.notes}
              onChange={(e) => setManualForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2} placeholder="Any notes about this item…"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={INPUT_STYLE} />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

          <motion.button type="submit" disabled={savingManual} whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl text-sm font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #C8A97E 0%, #9A7A52 100%)', color: '#0C0C0C' }}
          >
            {savingManual ? 'Saving…' : 'Save Item'}
          </motion.button>
        </form>
      </div>
    )
  }

  if (phase === 'camera') {
    return (
      <div className="min-h-screen bg-black flex flex-col pb-20">
        <video ref={videoRef} autoPlay playsInline className="flex-1 w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex items-center justify-around p-6 bg-black">
          <button onClick={() => { stopCamera(); setPhase('idle') }} className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Cancel
          </button>
          <motion.button
            onClick={capturePhoto}
            whileTap={{ scale: 0.92 }}
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ border: '3px solid white', backgroundColor: 'rgba(255,255,255,0.15)' }}
          >
            <div className="w-11 h-11 rounded-full bg-white" />
          </motion.button>
          <div className="w-14" />
        </div>
      </div>
    )
  }

  if (phase === 'previewing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="absolute top-0 left-0 right-0">
          <PhaseIndicator phase={phase} />
        </div>
        <motion.img
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          src={preview} alt="Preview"
          className="max-h-96 rounded-2xl object-contain mb-6"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.65)' }}
        />
        {error && <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>}
        <div className="flex gap-3 w-full max-w-sm">
          <button onClick={retake}
            className="flex-1 py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}
          >
            <RotateCcw size={14} />
            Retake
          </button>
          <motion.button onClick={uploadPhoto} whileTap={{ scale: 0.97 }}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #C8A97E 0%, #9A7A52 100%)', color: '#0C0C0C' }}
          >
            Use Photo
          </motion.button>
        </div>
      </div>
    )
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <PhaseIndicator phase={phase} />
      <div className="px-5 pt-4 pb-6">
        <p className="text-[10px] tracking-[0.32em] uppercase mb-2" style={{ color: 'var(--accent)' }}>Add to Wardrobe</p>
        <h1 className="text-3xl serif-display" style={{ color: 'var(--text-primary)' }}>New Item</h1>
      </div>

      {/* 3D scene — idle phase only, non-interactive */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{ height: 200, pointerEvents: 'none', overflow: 'hidden' }}
      >
        <SplineScene
          scene={SCENES.addItemIdle}
          style={{ width: '100%', height: '100%' }}
        />
      </motion.div>

      <div className="px-5 flex flex-col gap-3">
        {barcodeInfo && Object.keys(barcodeInfo).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-2xl px-4 py-3"
            style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }}
          >
            <p className="text-xs font-semibold mb-0.5" style={{ color: '#4ADE80' }}>Barcode Scanned</p>
            {barcodeInfo.title && <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{barcodeInfo.title}</p>}
            {barcodeInfo.brand && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{barcodeInfo.brand}{barcodeInfo.size ? ` · ${barcodeInfo.size}` : ''}</p>}
            <p className="text-xs mt-1" style={{ color: 'rgba(74,222,128,0.6)' }}>Now take a photo of the item below</p>
          </motion.div>
        )}

        <motion.button onClick={startCamera} whileTap={{ scale: 0.97 }}
          className="w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #C8A97E 0%, #9A7A52 100%)', color: '#0C0C0C' }}
        >
          <Camera size={20} strokeWidth={2} />
          Take Photo
        </motion.button>

        <motion.button onClick={() => fileInputRef.current?.click()} whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-sm font-medium"
          style={{ border: '1.5px dashed rgba(255,255,255,0.14)', color: 'var(--text-muted)' }}
        >
          <Upload size={18} strokeWidth={1.75} />
          Upload from Gallery
        </motion.button>

        <motion.button onClick={() => setPhase('barcode')} whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-sm font-medium"
          style={{ border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}
        >
          <Barcode size={18} strokeWidth={1.75} />
          Scan Barcode
        </motion.button>

        {/* Iteration 2: Scan clothing label/tag — camera captures label, Ollama OCR extracts brand/size/material */}
        <motion.button
          onClick={() => { setLabelScanMode(true); fileInputRef.current?.click() }}
          whileTap={{ scale: 0.97 }}
          disabled={labelScanLoading}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-sm font-medium disabled:opacity-50"
          style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}
        >
          <Tag size={18} strokeWidth={1.75} />
          {labelScanLoading ? 'Reading label…' : 'Scan Label / Care Tag'}
        </motion.button>

        {/* Label scan result — Framer Motion AnimatePresence (single element appearing on success) */}
        <AnimatePresence>
          {labelScanResult !== null && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="w-full rounded-2xl px-4 py-3"
              style={Object.keys(labelScanResult).length > 0
                ? { backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }
                : { backgroundColor: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }
              }
            >
              {Object.keys(labelScanResult).length > 0 ? (
                <>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#4ADE80' }}>Label Read</p>
                  {labelScanResult.brand    && <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{labelScanResult.brand}</p>}
                  {labelScanResult.size     && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Size: {labelScanResult.size}</p>}
                  {labelScanResult.material && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{labelScanResult.material}</p>}
                  <p className="text-xs mt-1" style={{ color: 'rgba(74,222,128,0.6)' }}>Pre-filled in form below</p>
                </>
              ) : (
                <p className="text-xs" style={{ color: '#F87171' }}>Couldn't read label clearly. Fill in manually.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (labelScanMode) {
              setLabelScanMode(false)
              handleLabelPhotoCapture(file)
              e.target.value = ''  // Reset so same file can be selected again
            } else {
              handleFileSelect(e)
            }
          }}
        />

        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)', opacity: 0.55 }}>
          AI will automatically tag your item.<br />
          First scan may take up to 30 seconds.
        </p>
      </div>
    </div>
  )
}
