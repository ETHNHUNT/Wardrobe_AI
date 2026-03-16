/**
 * QuickWearModal — "Log Today's Wear" bottom sheet
 *
 * Framer Motion: spring-physics bottom sheet (y: "100%" → 0 → "100%")
 * GSAP: horizontal stagger for item list rows (x: -16 → 0, visually distinct
 *        from the vertical stagger used in Wardrobe grid)
 * lucide-react: Zap (trigger), X (close), CheckCircle2 (selected state)
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, Zap } from 'lucide-react'
import { Icon } from '@iconify/react'
import { gsap } from 'gsap'
import axios from 'axios'
import { parseJson } from '../lib/utils'
import { getColorCSS } from '../lib/colors'
import { isPhotoValid, CATEGORY_ICONS } from '../lib/constants'
import { useToast } from './Toast'

const API_URL = import.meta.env.VITE_API_URL

export default function QuickWearModal({ isOpen, onClose, onLogged }) {
  const [items, setItems]         = useState([])
  const [selected, setSelected]   = useState(new Set())
  const [loading, setLoading]     = useState(false)
  const [logging, setLogging]     = useState(false)
  const listRef = useRef(null)
  const { toast } = useToast()

  // Fetch wardrobe items when modal opens
  useEffect(() => {
    if (!isOpen) { setSelected(new Set()); return }
    let cancelled = false
    setLoading(true)
    axios.get(`${API_URL}/items`)
      .then(({ data }) => { if (!cancelled) setItems(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen])

  // GSAP horizontal stagger — after items load
  // Horizontal slide (x) vs existing vertical (y) stagger in Wardrobe grid — intentionally distinct
  useEffect(() => {
    if (!loading && items.length && listRef.current) {
      const rows = listRef.current.querySelectorAll('.qw-row')
      if (rows.length) {
        gsap.fromTo(
          rows,
          { x: -16, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.3, stagger: 0.04, ease: 'power2.out', clearProps: 'all' }
        )
      }
    }
  }, [loading, items])

  function toggleItem(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleLogWear() {
    if (selected.size === 0) return
    setLogging(true)
    try {
      const item_ids = Array.from(selected)
      // Save as outfit
      const { data: outfit } = await axios.post(`${API_URL}/outfits`, { item_ids })
      // Mark as worn (cascades to all items)
      await axios.post(`${API_URL}/outfits/${outfit.id}/worn`)
      toast({ message: `Logged ${item_ids.length} item${item_ids.length > 1 ? 's' : ''} as worn today`, type: 'success', duration: 3000 })
      onLogged && onLogged()
      onClose()
    } catch {
      toast({ message: 'Could not log today\'s wear', type: 'error' })
    } finally {
      setLogging(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="qw-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />

          {/* Bottom sheet */}
          <motion.div
            key="qw-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid rgba(200,169,126,0.12)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Handle + header */}
            <div className="px-5 pt-4 pb-3 flex-shrink-0">
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Log Today's Wear
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Select what you're wearing today
                  </p>
                </div>
                <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto px-5 pb-2" style={{ scrollbarWidth: 'none' }}>
              {loading ? (
                <div className="space-y-3 py-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl shimmer" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No items in wardrobe yet
                </p>
              ) : (
                <div ref={listRef} className="space-y-2 py-1">
                  {items.map((item) => {
                    const isSelected = selected.has(item.id)
                    const colors = parseJson(item.colors)
                    const icon = CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS.other
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className="qw-row w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-150 text-left"
                        style={{
                          backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                          border: isSelected
                            ? '1px solid rgba(200,169,126,0.4)'
                            : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: '#0f0f0f' }}>
                          {isPhotoValid(item) ? (
                            <img
                              src={`${API_URL}/images/${item.photo_path}`}
                              alt={item.category}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"
                              style={{ color: 'rgba(200,169,126,0.4)' }}>
                              <Icon icon={icon} width={20} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate capitalize"
                            style={{ color: 'var(--text-primary)' }}>
                            {item.brand || item.category?.replace('_', ' ')}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {colors.slice(0, 3).map((c, i) => (
                              <span key={i} className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: getColorCSS(c), boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }} />
                            ))}
                            {item.size_label && (
                              <span className="text-[9px] ml-0.5" style={{ color: 'var(--text-muted)' }}>
                                {item.size_label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Checkmark */}
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <CheckCircle2 size={18} style={{ color: 'var(--accent)' }} />
                          ) : (
                            <div className="w-[18px] h-[18px] rounded-full"
                              style={{ border: '1.5px solid rgba(255,255,255,0.15)' }} />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer CTA */}
            <div className="px-5 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <motion.button
                onClick={handleLogWear}
                disabled={selected.size === 0 || logging}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #C8A97E 0%, #9A7A52 100%)', color: '#0C0C0C' }}
              >
                {logging ? (
                  <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: '#0C0C0C', borderTopColor: 'transparent' }} />
                ) : (
                  <>
                    <Zap size={16} strokeWidth={2} />
                    Log Wear{selected.size > 0 ? ` (${selected.size})` : ''}
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
