import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import axios from 'axios'
import { parseJson } from '../lib/utils'
import { useToast } from './Toast'

const API_URL = import.meta.env.VITE_API_URL

// Map common color names to actual CSS color values for swatches
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

export default function ItemCard({ item, onClick, onWorn }) {
  const colors   = parseJson(item.colors)
  const [timesWorn, setTimesWorn] = useState(item.times_worn ?? 0)
  const [marking, setMarking]     = useState(false)
  const [wornFlash, setWornFlash] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!wornFlash) return
    const id = setTimeout(() => setWornFlash(false), 800)
    return () => clearTimeout(id)
  }, [wornFlash])

  async function handleMarkWorn(e) {
    e.stopPropagation()
    if (marking) return
    setMarking(true)
    try {
      const { data } = await axios.post(`${API_URL}/items/${item.id}/worn`)
      setTimesWorn(data.times_worn)
      setWornFlash(true)
      onWorn && onWorn(item.id, data.times_worn)
      toast({ message: `Marked worn — ${data.times_worn}× total`, type: 'success', duration: 2500 })
    } catch {
      toast({ message: 'Could not update worn count', type: 'error' })
    } finally {
      setMarking(false)
    }
  }

  return (
    <motion.div
      whileHover={{
        y: -4,
        boxShadow: '0 0 0 1.5px rgba(200,169,126,0.32), 0 12px 36px rgba(0,0,0,0.6)',
        transition: { type: 'spring', stiffness: 380, damping: 26 },
      }}
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
      <div className="aspect-[3/4] relative overflow-hidden" style={{ backgroundColor: '#0f0f0f' }}>
        {item.photo_path && item.photo_path !== 'tmp' ? (
          <img
            src={`${API_URL}/images/${item.photo_path}`}
            alt={item.category}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.1)' }}>
            <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Times worn badge — gold pill */}
        {timesWorn > 0 && (
          <motion.span
            initial={false}
            animate={{ scale: wornFlash ? 1.3 : 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: 'var(--accent)',
              color: '#0C0C0C',
              letterSpacing: '0.04em',
            }}
          >
            {timesWorn}×
          </motion.span>
        )}

        {/* Category label — bottom gradient overlay, visible on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
        >
          <span
            className="text-[9px] uppercase"
            style={{ color: 'rgba(255,255,255,0.58)', letterSpacing: '0.14em' }}
          >
            {item.category?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Info row */}
      <div className="px-2.5 pt-2 pb-2">
        <div className="flex items-center justify-between gap-1">
          {/* Color swatches — ring style for depth */}
          <div className="flex gap-1.5">
            {colors.slice(0, 3).map((color, i) => (
              <span
                key={i}
                title={color}
                className="w-3 h-3 rounded-full inline-block"
                style={{
                  backgroundColor: resolveColor(color),
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>

          {/* Mark worn button */}
          <motion.button
            onClick={handleMarkWorn}
            disabled={marking}
            title="Mark as worn today"
            whileTap={{ scale: 0.82 }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors duration-150 disabled:opacity-40"
            style={
              wornFlash
                ? { color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }
                : { color: 'rgba(107,101,96,0.65)' }
            }
          >
            <CheckCircle2 size={12} strokeWidth={1.75} />
            Worn
          </motion.button>
        </div>

        {item.brand && (
          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(107,101,96,0.65)' }}>
            {item.brand}
          </p>
        )}
      </div>
    </motion.div>
  )
}
