import { cn } from '../lib/utils'

/**
 * Luxury glassmorphism card base.
 * backdrop-blur + semi-transparent bg + ultra-subtle border.
 * Use as a drop-in replacement for plain surface cards.
 *
 * Usage:
 *   <GlassCard className="p-4">...</GlassCard>
 */
export default function GlassCard({ children, className = '', style = {} }) {
  return (
    <div
      className={cn('glass-card rounded-2xl overflow-hidden', className)}
      style={style}
    >
      {children}
    </div>
  )
}
