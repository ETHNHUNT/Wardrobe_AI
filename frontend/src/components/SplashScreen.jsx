import { useEffect } from 'react'
import { motion } from 'framer-motion'
import SplineScene from './SplineScene'
import { SCENES, SPLASH_SEEN_KEY } from '../lib/scenes'

export default function SplashScreen({ onDone }) {
  function dismiss() {
    sessionStorage.setItem(SPLASH_SEEN_KEY, '1')
    onDone()
  }

  // Auto-dismiss after 2.4 s; cleanup prevents setState on unmounted component
  useEffect(() => {
    const id = setTimeout(dismiss, 2400)
    return () => clearTimeout(id)
  }, [])

  return (
    <motion.div
      key="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
      onClick={dismiss}
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ backgroundColor: 'var(--bg-primary)', cursor: 'pointer' }}
    >
      {/* 3D scene fills the screen */}
      <SplineScene
        scene={SCENES.splash}
        style={{ flex: 1, width: '100%', pointerEvents: 'none' }}
      />

      {/* Bottom gradient fade + luxury brand mark */}
      <div
        className="absolute bottom-0 left-0 right-0 text-center pointer-events-none"
        style={{
          background: 'linear-gradient(to top, var(--bg-primary) 42%, transparent 100%)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 44px)',
          paddingTop: 80,
        }}
      >
        {/* Eyeline: micro label */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.65, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-[10px] tracking-[0.6em] uppercase mb-5"
          style={{ color: 'var(--accent)' }}
        >
          Personal
        </motion.p>

        {/* Brand mark: Cormorant Garamond italic + gold "AI" */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.75, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-baseline justify-center"
          style={{ gap: '0.3rem' }}
        >
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: '3.25rem',
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            Wardrobe
          </span>
          <span
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              fontSize: '0.78rem',
              letterSpacing: '0.38em',
              color: 'var(--accent)',
              fontWeight: 300,
              paddingBottom: '0.5rem',
            }}
          >
            AI
          </span>
        </motion.div>

        {/* Tap hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.8 }}
          className="text-[10px] tracking-[0.42em] uppercase mt-8"
          style={{ color: 'rgba(107, 101, 96, 0.42)' }}
        >
          Tap to continue
        </motion.p>
      </div>
    </motion.div>
  )
}
