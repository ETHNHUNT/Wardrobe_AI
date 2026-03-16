import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { Icon } from '@iconify/react'
import axios from 'axios'
import { parseJson } from '../lib/utils'
import { getColorCSS } from '../lib/colors'
import { isPhotoValid, CATEGORY_ICONS } from '../lib/constants'
import { useToast } from './Toast'

const API_URL = import.meta.env.VITE_API_URL

function getDaysAgo(isoDate) {
  if (!isoDate) return null
  const diff = Date.now() - new Date(isoDate).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default function ItemCard({ item, onClick, onWorn }) {
  const colors   = parseJson(item.colors)
  const [timesWorn, setTimesWorn]       = useState(item.times_worn ?? 0)
  const [lastWornDate, setLastWornDate] = useState(item.last_worn_date ?? null)
  const [marking, setMarking]           = useState(false)
  const [wornFlash, setWornFlash]       = useState(false)
  const { toast } = useToast()

  const daysAgo   = getDaysAgo(lastWornDate)
  const isUnworn  = timesWorn === 0
  const isStale   = !isUnworn && daysAgo !== null && daysAgo >= 30
  const showAlert = isUnworn || isStale

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
      setLastWornDate(data.last_worn_date ?? new Date().toISOString())
      setWornFlash(true)
      onWorn && onWorn(item.id, data.times_worn)
      toast({ message: `Marked worn — ${data.times_worn}× total`, type: 'success', duration: 2500 })
    } catch {
      toast({ message: 'Could not update worn count', type: 'error' })
    } finally {
      setMarking(false)
    }
  }

  const categoryIcon = CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS.other

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
        {isPhotoValid(item) ? (
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

        {/* Unworn / stale badge — subtle heartbeat pulse draws attention */}
        {showAlert && (
          <motion.span
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="absolute top-2 right-2 flex items-center gap-0.5 text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: 'rgba(251,184,70,0.18)',
              color: 'var(--warning)',
              border: '1px solid rgba(251,184,70,0.35)',
              letterSpacing: '0.04em',
            }}
          >
            <AlertCircle size={8} />
            {isUnworn ? 'New' : '30d+'}
          </motion.span>
        )}

        {/* Category icon — bottom-right corner, subtle overlay */}
        <div
          className="absolute bottom-8 right-2 pointer-events-none"
          style={{ color: 'rgba(200,169,126,0.45)' }}
        >
          <Icon icon={categoryIcon} width={16} height={16} />
        </div>

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
                  backgroundColor: getColorCSS(color),
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

        {/* Last worn date — subtle, slides in on mount */}
        {daysAgo !== null && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="flex items-center gap-1 text-[9px] mt-0.5"
            style={{ color: 'rgba(200,169,126,0.55)' }}
          >
            <Clock size={8} />
            {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}
