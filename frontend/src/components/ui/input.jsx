import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-[rgba(255,255,255,0.10)] bg-[var(--bg-elevated)] px-3 py-2',
        'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
        'transition-all duration-200',
        'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
