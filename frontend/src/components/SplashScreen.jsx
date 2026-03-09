import { useEffect } from 'react'
import { motion } from 'framer-motion'
import SplineScene from './SplineScene'
import { SCENES, SPLASH_SEEN_KEY } from '../lib/scenes'

export default function SplashScreen({ onDone }) {
  function dismiss() {
    sessionStorage.setItem(SPLASH_SEEN_KEY, '1')
    onDone()
  }

  // Auto-dismiss after 2 s; cleanup prevents setState on unmounted component
  useEffect(() => {
    const id = setTimeout(dismiss, 2000)
    return () => clearTimeout(id)
  }, [])

  return (
    <motion.div
      key="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      onClick={dismiss}
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ backgroundColor: 'var(--bg-primary)', cursor: 'pointer' }}
    >
      {/* 3D scene fills the screen */}
      <SplineScene
        scene={SCENES.splash}
        style={{ flex: 1, width: '100%', pointerEvents: 'none' }}
      />

      {/* Title overlay at bottom */}
      <div className="absolute bottom-16 left-0 right-0 text-center pointer-events-none">
        <p
          className="text-xs tracking-[0.45em] uppercase mb-2"
          style={{ color: 'var(--accent)' }}
        >
          Wardrobe
        </p>
        <h1
          className="text-4xl font-light"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
        >
          AI
        </h1>
        <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Tap to continue
        </p>
      </div>
    </motion.div>
  )
}
