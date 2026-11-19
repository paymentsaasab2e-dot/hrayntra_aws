"use client"

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils'

// =============================================================================
// Spinner — loading indicator atom
// Used internally by Button[loading] and wherever async states need to show.
// NEVER inline border-t-white animate-spin spans anymore — use this.
// =============================================================================

const spinnerVariants = cva(
  'rounded-full border-2 animate-spin shrink-0',
  {
    variants: {
      size: {
        xs: 'size-3',    // 12px — inside very small buttons
        sm: 'size-4',    // 16px — inside standard buttons
        md: 'size-5',    // 20px — standalone page loaders
        lg: 'size-8',    // 32px — full-section loading
      },
      color: {
        white:  'border-white/30 border-t-white',
        brand:  'border-[#6366f1]/30 border-t-[#6366f1]',
        muted:  'border-ds-neutral-300 border-t-ds-neutral-500',
      },
    },
    defaultVariants: {
      size: 'sm',
      color: 'white',
    },
  }
)

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string
}

export function Spinner({ size, color, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(spinnerVariants({ size, color }), className)}
    />
  )
}
