import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

function parseJson(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

export default function ItemCard({ item, onClick, onWorn }) {
  const colors   = parseJson(item.colors)
  const [timesWorn, setTimesWorn] = useState(item.times_worn ?? 0)
  const [marking, setMarking]     = useState(false)
  const [wornFlash, setWornFlash] = useState(false)

  async function handleMarkWorn(e) {
    e.stopPropagation()
    if (marking) return
    setMarking(true)
    try {
      const { data } = await axios.post(`${API_URL}/items/${item.id}/worn`)
      setTimesWorn(data.times_worn)
      setWornFlash(true)
      setTimeout(() => setWornFlash(false), 800)
      onWorn && onWorn(item.id, data.times_worn)
    } catch {
      // silently ignore
    } finally {
      setMarking(false)
    }
  }

  return (
    <motion.div
      whileHover={{ y: -3, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      whileTap={{ scale: 0.975 }}
      onClick={() => onClick && onClick(item)}
      className="rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 1px 12px rgba(0,0,0,0.45)',
      }}
    >
      {/* Photo */}
      <div className="aspect-[3/4] relative overflow-hidden" style={{ backgroundColor: '#111' }}>
        {item.photo_path && item.photo_path !== 'tmp' ? (
          <img
            src={`${API_URL}/images/${item.photo_path}`}
            alt={item.category}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.12)' }}>
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Times worn badge */}
        {timesWorn > 0 && (
          <motion.span
            initial={false}
            animate={{ scale: wornFlash ? 1.25 : 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--accent)', color: '#0C0C0C' }}
          >
            {timesWorn}×
          </motion.span>
        )}

        {/* Category label — bottom overlay on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
          }}
        >
          <span
            className="text-[9px] uppercase tracking-widest font-medium"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            {item.category}
          </span>
        </div>
      </div>

      {/* Info row */}
      <div className="px-2.5 pt-2 pb-1.5">
        <div className="flex items-center justify-between gap-1">
          {/* Color swatches */}
          <div className="flex gap-1">
            {colors.slice(0, 3).map((color, i) => (
              <span
                key={i}
                title={color}
                className="w-3.5 h-3.5 rounded-full inline-block"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* Mark worn button */}
          <motion.button
            onClick={handleMarkWorn}
            disabled={marking}
            title="Mark as worn today"
            whileTap={{ scale: 0.85 }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors duration-150 disabled:opacity-40"
            style={wornFlash
              ? { color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }
              : { color: 'var(--text-muted)' }
            }
          >
            <CheckCircle2 size={13} strokeWidth={1.75} />
            Worn
          </motion.button>
        </div>

        {item.brand && (
          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {item.brand}
          </p>
        )}
      </div>
    </motion.div>
  )
}
