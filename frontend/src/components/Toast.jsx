import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

// ── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  const toast = useCallback(({ message, type = 'default', duration = 3000 }) => {
    const id = ++counterRef.current
    setToasts((prev) => [...prev.slice(-3), { id, message, type, duration }])
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ── Stack container ───────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }) {
  return (
    <div
      className="fixed left-0 right-0 flex flex-col items-center gap-2 pointer-events-none"
      style={{
        // Sit above the bottom navbar (64px) + a bit of breathing room
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
        zIndex: 9999,
        padding: '0 16px',
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── Individual toast ──────────────────────────────────────────────────────────
const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    iconColor: 'var(--success)',
    barColor: 'var(--success)',
    borderColor: 'rgba(74,222,128,0.22)',
    bgTint: 'rgba(74,222,128,0.05)',
  },
  error: {
    icon: XCircle,
    iconColor: 'var(--danger)',
    barColor: 'var(--danger)',
    borderColor: 'rgba(248,113,113,0.22)',
    bgTint: 'rgba(248,113,113,0.05)',
  },
  info: {
    icon: Info,
    iconColor: 'var(--accent)',
    barColor: 'var(--accent)',
    borderColor: 'rgba(200,169,126,0.22)',
    bgTint: 'rgba(200,169,126,0.05)',
  },
  default: {
    icon: Info,
    iconColor: 'var(--text-muted)',
    barColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.1)',
    bgTint: 'transparent',
  },
}

function ToastItem({ toast, onDismiss }) {
  const { id, message, type, duration } = toast
  const cfg = TOAST_CONFIG[type] ?? TOAST_CONFIG.default
  const Icon = cfg.icon
  const [progress, setProgress] = useState(100)
  const startRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    startRef.current = performance.now()

    function tick(now) {
      const elapsed = now - startRef.current
      const pct = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(pct)
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        onDismiss(id)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [id, duration, onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className="relative overflow-hidden pointer-events-auto w-full max-w-sm"
      style={{
        borderRadius: 16,
        backgroundColor: 'var(--bg-elevated)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${cfg.borderColor}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset',
        background: `linear-gradient(135deg, ${cfg.bgTint}, var(--bg-elevated))`,
      }}
    >
      {/* Content row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Icon size={16} strokeWidth={1.75} style={{ color: cfg.iconColor, flexShrink: 0 }} />
        <p
          className="flex-1 text-sm leading-snug"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
        >
          {message}
        </p>
        <button
          onClick={() => onDismiss(id)}
          className="p-0.5 rounded-lg transition-opacity opacity-40 hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] transition-none"
        style={{
          width: `${progress}%`,
          backgroundColor: cfg.barColor,
          opacity: 0.6,
          borderRadius: '0 0 0 16px',
        }}
      />
    </motion.div>
  )
}
