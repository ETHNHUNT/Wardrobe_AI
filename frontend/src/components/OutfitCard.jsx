import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Trash2, BookmarkPlus, CheckCircle2, TrendingUp, Palette, ChevronDown } from 'lucide-react'
import { gsap } from 'gsap'

const API_URL = import.meta.env.VITE_API_URL

function StarRating({ rating, outfitId, onRate, disabled }) {
  const starsRef = useRef([])

  function handleClick(star) {
    if (disabled || !onRate) return
    onRate(outfitId, star)
    // GSAP bounce on rated stars
    starsRef.current.forEach((el, i) => {
      if (!el) return
      const delay = i * 0.04
      gsap.fromTo(el,
        { scale: 1 },
        { scale: i < star ? 1.35 : 1, duration: 0.22, delay, ease: 'back.out(2)', yoyo: true, repeat: 0 }
      )
    })
  }

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star, i) => {
        const filled = star <= (rating ?? 0)
        return (
          <button
            key={star}
            ref={(el) => (starsRef.current[i] = el)}
            disabled={disabled}
            onClick={() => handleClick(star)}
            className="transition-colors duration-150 disabled:cursor-default"
            style={{ color: filled ? '#C8A97E' : 'rgba(255,255,255,0.15)' }}
          >
            <Star size={15} fill={filled ? '#C8A97E' : 'none'} strokeWidth={1.5} />
          </button>
        )
      })}
    </div>
  )
}

export default function OutfitCard({ outfit, onSave, onRate, onDelete, isSaved }) {
  const items = outfit.items ?? []
  const [styleOpen, setStyleOpen] = useState(false)
  const hasStylingGuide = (outfit.styling_tips?.length > 0) || outfit.color_reason

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="overflow-hidden rounded-2xl glass-card"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.45)' }}
    >
      {/* Item thumbnails */}
      <div className="flex gap-1.5 p-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ scale: 1.04 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden"
            style={{ backgroundColor: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {item.photo_path && item.photo_path !== 'tmp' ? (
              <img
                src={`${API_URL}/images/${item.photo_path}`}
                alt={item.category}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-center px-1"
                style={{ color: 'rgba(107,101,96,0.6)' }}>
                {item.category}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Body */}
      <div className="px-3.5 pb-3.5 space-y-2.5">
        {outfit.reason && (
          <p
            className="text-xs italic leading-relaxed"
            style={{
              color: 'rgba(107,101,96,0.8)',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: '0.8rem',
            }}
          >
            "{outfit.reason}"
          </p>
        )}

        {/* Shoe recommendation */}
        {outfit.shoe_recommendation && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Shoes →</span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(200,169,126,0.06)',
                color: 'var(--accent)',
                border: '1px solid rgba(200,169,126,0.15)',
              }}
            >
              {outfit.shoe_recommendation}
            </span>
          </div>
        )}

        {/* Trend tags */}
        {outfit.trend_tags?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <TrendingUp size={10} strokeWidth={2} style={{ color: 'rgba(107,101,96,0.5)' }} />
            {outfit.trend_tags.map((tag) => (
              <span
                key={tag}
                title="2026 trend"
                className="text-[9px] px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  color: 'rgba(107,101,96,0.65)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Styling Guide — collapsible */}
        {hasStylingGuide && (
          <div>
            <button
              onClick={() => setStyleOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider"
              style={{ color: 'var(--accent)' }}
            >
              <Palette size={11} strokeWidth={2} />
              Styling Guide
              <motion.span
                animate={{ rotate: styleOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="inline-block"
              >
                <ChevronDown size={11} strokeWidth={2} />
              </motion.span>
            </button>

            <AnimatePresence>
              {styleOpen && (
                <motion.div
                  key="style-guide"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-2 rounded-xl p-3 space-y-2"
                    style={{
                      backgroundColor: 'rgba(200,169,126,0.05)',
                      border: '1px solid rgba(200,169,126,0.12)',
                    }}
                  >
                    {outfit.color_reason && (
                      <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(200,169,126,0.8)' }}>
                        <span className="font-semibold">Colors: </span>{outfit.color_reason}
                      </p>
                    )}
                    {outfit.styling_tips?.length > 0 && (
                      <ul className="space-y-1">
                        {outfit.styling_tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            <CheckCircle2 size={11} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Occasion + Season chips */}
        <div className="flex gap-1.5 flex-wrap">
          {outfit.occasion && (
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-medium capitalize"
              style={{
                backgroundColor: 'rgba(200,169,126,0.08)',
                color: 'var(--accent)',
                border: '1px solid rgba(200,169,126,0.18)',
                letterSpacing: '0.03em',
              }}
            >
              {outfit.occasion}
            </span>
          )}
          {outfit.season && (
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-medium capitalize"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                color: 'rgba(107,101,96,0.9)',
                border: '1px solid rgba(255,255,255,0.07)',
                letterSpacing: '0.03em',
              }}
            >
              {outfit.season}
            </span>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between pt-0.5">
          <StarRating
            rating={outfit.rating}
            outfitId={outfit.id}
            onRate={onRate}
            disabled={!isSaved}
          />

          {isSaved ? (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onDelete && onDelete(outfit.id)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150"
              style={{ color: 'rgba(248,113,113,0.5)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F87171')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(248,113,113,0.5)')}
            >
              <Trash2 size={12} strokeWidth={1.75} />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => onSave && onSave(outfit)}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-xl transition-colors duration-150"
              style={{ border: '1px solid rgba(200,169,126,0.35)', color: 'var(--accent)' }}
            >
              <BookmarkPlus size={12} strokeWidth={1.75} />
              Save
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
