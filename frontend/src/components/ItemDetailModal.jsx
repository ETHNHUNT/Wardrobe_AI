import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Tag, Pencil, CheckCircle2 } from 'lucide-react'
import axios from 'axios'
import LuxSelect from './LuxSelect'
import { parseJson } from '../lib/utils'

const API_URL = import.meta.env.VITE_API_URL

const CATEGORIES = ['tshirt', 'shirt', 'polo', 'jacket', 'hoodie', 'sweater', 'jeans', 'chinos', 'trousers', 'shorts', 'shoes', 'sneakers', 'boots', 'formal_shoes', 'accessory', 'other']
const FIT_TYPES  = ['slim', 'regular', 'oversized', 'relaxed']
const OCCASIONS  = ['casual', 'work', 'formal', 'sport', 'outdoor']
const SEASONS    = ['spring', 'summer', 'fall', 'winter']

const INPUT_STYLE = {
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const COLOR_MAP = {
  black: '#1a1a1a', white: '#f5f5f5', navy: '#1e2a4a', grey: '#808080',
  gray: '#808080', beige: '#d4b896', khaki: '#c3b091', brown: '#7a4f2e',
  burgundy: '#6d2b3d', red: '#c0392b', blue: '#2980b9', lightblue: '#87ceeb',
  green: '#27ae60', olive: '#6b6b2f', yellow: '#f1c40f', orange: '#e67e22',
  pink: '#e91e8c', purple: '#8e44ad', cream: '#fffdd0', camel: '#c19a6b',
  tan: '#d2b48c', charcoal: '#36454f', teal: '#008080', mint: '#98ff98',
  denim: '#1560bd', indigo: '#4b0082', maroon: '#800000', ivory: '#fffff0',
}
function resolveColor(name) {
  const lower = (name ?? '').toLowerCase().replace(/[\s-]/g, '')
  return COLOR_MAP[lower] ?? name
}

function toggleArr(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

export default function ItemDetailModal({ item, onClose, onDeleted, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [retagging, setRetagging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [form, setForm] = useState({
    category:   item.category ?? '',
    fit_type:   item.fit_type ?? '',
    brand:      item.brand ?? '',
    size_label: item.size_label ?? '',
    colors:     parseJson(item.colors).join(', '),
    occasions:  parseJson(item.occasions),
    seasons:    parseJson(item.seasons),
    notes:      item.notes ?? '',
  })

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload = {
        category:   form.category || 'other',
        fit_type:   form.fit_type || null,
        brand:      form.brand || null,
        size_label: form.size_label || null,
        notes:      form.notes || null,
        colors:     form.colors ? form.colors.split(',').map((s) => s.trim()).filter(Boolean) : [],
        occasions:  form.occasions,
        seasons:    form.seasons,
      }
      const { data } = await axios.put(`${API_URL}/items/${item.id}`, payload)
      onUpdated && onUpdated(data)
      setEditing(false)
    } catch {
      setError('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRetag() {
    setRetagging(true)
    setError('')
    try {
      const { data } = await axios.post(`${API_URL}/items/${item.id}/tag`)
      onUpdated && onUpdated(data)
      // Refresh form fields with newly tagged values
      setForm({
        category:   data.category ?? '',
        fit_type:   data.fit_type ?? '',
        brand:      data.brand ?? '',
        size_label: data.size_label ?? '',
        colors:     parseJson(data.colors).join(', '),
        occasions:  parseJson(data.occasions),
        seasons:    parseJson(data.seasons),
        notes:      data.notes ?? '',
      })
    } catch {
      setError('Re-tagging failed. Is Ollama running?')
    } finally {
      setRetagging(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await axios.delete(`${API_URL}/items/${item.id}`)
      onDeleted && onDeleted(item.id)
      onClose()
    } catch {
      setError('Failed to delete item.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const colors  = parseJson(item.colors)

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      />

      {/* Bottom sheet */}
      <motion.div
        key="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid rgba(255,255,255,0.07)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--accent)' }}>
              {item.category?.replace('_', ' ')}
            </p>
            {item.brand && (
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.brand}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl" style={{ color: 'var(--text-muted)' }}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Photo */}
        {item.photo_path && item.photo_path !== 'tmp' && (
          <div className="px-5 pb-4">
            <img
              src={`${API_URL}/images/${item.photo_path}`}
              alt={item.category}
              className="w-full max-h-64 object-contain rounded-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#0f0f0f' }}
            />
          </div>
        )}

        {/* Color swatches */}
        {colors.length > 0 && (
          <div className="px-5 pb-3 flex gap-2 items-center">
            {colors.map((c, i) => (
              <span
                key={i}
                title={c}
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: resolveColor(c), boxShadow: '0 0 0 1px rgba(255,255,255,0.15)' }}
              />
            ))}
            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
              {colors.join(', ')}
            </span>
          </div>
        )}

        {/* Quick info chips */}
        <div className="px-5 pb-4 flex flex-wrap gap-1.5">
          {item.fit_type && (
            <span className="text-[10px] px-2.5 py-1 rounded-full capitalize"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {item.fit_type}
            </span>
          )}
          {item.size_label && (
            <span className="text-[10px] px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Size {item.size_label}
            </span>
          )}
          {parseJson(item.occasions).map((o) => (
            <span key={o} className="text-[10px] px-2.5 py-1 rounded-full capitalize"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(200,169,126,0.2)' }}>
              {o}
            </span>
          ))}
          {parseJson(item.seasons).map((s) => (
            <span key={s} className="text-[10px] px-2.5 py-1 rounded-full capitalize"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {s}
            </span>
          ))}
        </div>

        {item.notes && (
          <div className="px-5 pb-3">
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{item.notes}</p>
          </div>
        )}

        <div className="px-5 pb-1 text-xs" style={{ color: 'rgba(107,101,96,0.5)' }}>
          Worn {item.times_worn ?? 0} time{(item.times_worn ?? 0) !== 1 ? 's' : ''}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-2 p-3 rounded-xl text-xs" style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
            {error}
          </div>
        )}

        {/* ── Edit form ── */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pt-3 pb-2 space-y-4 overflow-hidden"
            >
              <div>
                <label className="block text-xs tracking-wider uppercase mb-2" style={{ color: 'var(--accent)' }}>Category</label>
                <LuxSelect value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} options={CATEGORIES} placeholder="Select…" />
              </div>
              <div>
                <label className="block text-xs tracking-wider uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Fit Type</label>
                <LuxSelect value={form.fit_type} onChange={(e) => setForm((p) => ({ ...p, fit_type: e.target.value }))} options={FIT_TYPES} placeholder="Select…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Brand</label>
                  <input type="text" value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                    placeholder="Zara, H&M…" className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={INPUT_STYLE} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Size</label>
                  <input type="text" value={form.size_label} onChange={(e) => setForm((p) => ({ ...p, size_label: e.target.value }))}
                    placeholder="M, 32…" className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={INPUT_STYLE} />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Colors</label>
                <input type="text" value={form.colors} onChange={(e) => setForm((p) => ({ ...p, colors: e.target.value }))}
                  placeholder="navy, white" className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={INPUT_STYLE} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>Occasions</label>
                <div className="flex flex-wrap gap-2">
                  {OCCASIONS.map((o) => {
                    const active = form.occasions.includes(o)
                    return (
                      <button key={o} type="button" onClick={() => setForm((p) => ({ ...p, occasions: toggleArr(p.occasions, o) }))}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
                        style={active ? { backgroundColor: 'var(--accent)', color: '#0C0C0C' } : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {o}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>Seasons</label>
                <div className="flex flex-wrap gap-2">
                  {SEASONS.map((s) => {
                    const active = form.seasons.includes(s)
                    return (
                      <button key={s} type="button" onClick={() => setForm((p) => ({ ...p, seasons: toggleArr(p.seasons, s) }))}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
                        style={active ? { backgroundColor: 'var(--accent)', color: '#0C0C0C' } : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2} placeholder="Any notes…" className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={INPUT_STYLE} />
              </div>
              <motion.button onClick={handleSave} disabled={saving} whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #C8A97E 0%, #9A7A52 100%)', color: '#0C0C0C' }}>
                <CheckCircle2 size={15} strokeWidth={2} />
                {saving ? 'Saving…' : 'Save Changes'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action buttons ── */}
        <div className="px-5 py-4 flex flex-col gap-2.5">
          <motion.button
            onClick={() => { setEditing((e) => !e); setError('') }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
            style={{ border: '1px solid rgba(200,169,126,0.3)', color: 'var(--accent)', backgroundColor: editing ? 'var(--accent-soft)' : 'transparent' }}
          >
            <Pencil size={14} strokeWidth={1.75} />
            {editing ? 'Cancel Edit' : 'Edit Tags'}
          </motion.button>

          <motion.button
            onClick={handleRetag}
            disabled={retagging}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}
          >
            <Tag size={14} strokeWidth={1.75} />
            {retagging ? 'Tagging… (up to 30s)' : 'Re-tag with AI'}
          </motion.button>

          <motion.button
            onClick={handleDelete}
            disabled={deleting}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              border: confirmDelete ? '1px solid rgba(248,113,113,0.5)' : '1px solid rgba(255,255,255,0.06)',
              color: confirmDelete ? '#F87171' : 'rgba(107,101,96,0.6)',
              backgroundColor: confirmDelete ? 'rgba(248,113,113,0.06)' : 'transparent',
            }}
          >
            <Trash2 size={14} strokeWidth={1.75} />
            {deleting ? 'Deleting…' : confirmDelete ? 'Tap again to confirm delete' : 'Delete Item'}
          </motion.button>
        </div>

        {/* Safe area spacer */}
        <div className="h-6" />
      </motion.div>
    </AnimatePresence>
  )
}
