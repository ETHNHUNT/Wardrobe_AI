import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Star, Trash2, BookmarkPlus } from 'lucide-react'
import { gsap } from 'gsap'

const API_URL = import.meta.env.VITE_API_URL

function StarRating({ rating, outfitId, onRate, disabled }) {
  const starsRef = useRef([])

  function handleClick(star) {
    if (disabled || !onRate) return
    onRate(outfitId, star)
    // GSAP bounce on clicked star and stars below
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
            style={{ color: filled ? '#FBB846' : 'rgba(255,255,255,0.2)' }}
          >
            <Star size={16} fill={filled ? '#FBB846' : 'none'} strokeWidth={1.5} />
          </button>
        )
      })}
    </div>
  )
}

export default function OutfitCard({ outfit, onSave, onRate, onDelete, isSaved }) {
  const items = outfit.items ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* Item thumbnails */}
      <div className="flex gap-1.5 p-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ scale: 1.03 }}
            className="flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden"
            style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.06)' }}
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
                style={{ color: 'var(--text-muted)' }}>
                {item.category}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Body */}
      <div className="px-3.5 pb-3.5 space-y-2.5">
        {outfit.reason && (
          <p className="text-xs italic leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            "{outfit.reason}"
          </p>
        )}

        {/* Occasion + Season chips */}
        <div className="flex gap-1.5 flex-wrap">
          {outfit.occasion && (
            <span className="text-[10px] px-2.5 py-1 rounded-full font-medium capitalize"
              style={{ backgroundColor: 'rgba(200,169,126,0.1)', color: 'var(--accent)', border: '1px solid rgba(200,169,126,0.2)' }}>
              {outfit.occasion}
            </span>
          )}
          {outfit.season && (
            <span className="text-[10px] px-2.5 py-1 rounded-full font-medium capitalize"
              style={{ backgroundColor: 'rgba(74,222,128,0.08)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.18)' }}>
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
              style={{ color: 'rgba(248,113,113,0.6)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#F87171'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(248,113,113,0.6)'}
            >
              <Trash2 size={13} strokeWidth={1.75} />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => onSave && onSave(outfit)}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-xl transition-colors duration-150"
              style={{ border: '1px solid rgba(200,169,126,0.4)', color: 'var(--accent)' }}
            >
              <BookmarkPlus size={13} strokeWidth={1.75} />
              Save
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
