import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20',
        secondary:
          'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[rgba(255,255,255,0.08)]',
        success:
          'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20',
        warning:
          'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20',
        destructive:
          'bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20',
        outline:
          'border border-[rgba(255,255,255,0.12)] text-[var(--text-primary)] bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
