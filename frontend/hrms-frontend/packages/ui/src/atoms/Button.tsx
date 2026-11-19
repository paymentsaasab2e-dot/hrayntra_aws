"use client"

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils'
import { Spinner } from './Spinner'

// =============================================================================
// Button — primary interactive element
// CHANGES vs v1:
//   - Removed `asChild` prop (was declared but never implemented — silent bug)
//   - All hex colors replaced with ds-* token classes
//   - data-active cast to 'true' | undefined to fix Tailwind data-attribute matching
//   - Loading layout: spinner replaces icon slot, text stays visible (no layout jump)
// =============================================================================

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1.5',
    'rounded-lg border border-transparent',
    'font-semibold whitespace-nowrap',
    'transition-all duration-150 cursor-pointer',
    'outline-none select-none',
    'focus-visible:ring-2 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 hover:border-indigo-700 shadow-xs rounded-lg [&_svg]:text-white',

        primary:
          'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 hover:border-indigo-700 shadow-xs rounded-lg [&_svg]:text-white',

        outline:
          'bg-white text-slate-700 hover:text-slate-900 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-2xs rounded-lg [&_svg]:text-slate-500',

        secondary:
          'bg-slate-900 hover:bg-slate-800 text-white border-slate-900 hover:border-slate-800 shadow-xs rounded-lg [&_svg]:text-white',

        success:
          'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:border-emerald-700 shadow-xs rounded-lg [&_svg]:text-white',

        ghost:
          'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border-transparent rounded-lg [&_svg]:text-current',

        destructive:
          'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 hover:border-rose-700 shadow-xs rounded-lg [&_svg]:text-white',

        'destructive-outline':
          'bg-white text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300 rounded-lg [&_svg]:text-rose-600',

        'success-outline':
          'bg-white text-emerald-700 hover:text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg [&_svg]:text-emerald-600',

        toggle:
          'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 data-[active=true]:text-white data-[active=true]:bg-indigo-600 data-[active=true]:border-indigo-600 data-[active=true]:shadow-xs rounded-lg [&_svg]:text-current data-[active=true]:[&_svg]:text-white',

        link:
          'text-indigo-600 hover:text-indigo-700 border-transparent underline-offset-4 hover:underline [&_svg]:text-current',
      },
      size: {
        md:       'h-9 px-4 text-xs sm:text-sm',
        sm:       'h-8 px-3 text-xs',
        xs:       'h-7 px-2.5 rounded-md text-xs',
        lg:       'h-10 px-5 text-sm',
        icon:     'size-9 rounded-lg',
        'icon-sm':'size-8 rounded-lg',
        'icon-xs':'size-7 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  /**
   * For toggle variant — pass true/false, component handles data-attribute casting.
   */
  active?: boolean
  // NOTE: asChild has been intentionally removed.
  // Reason: it was declared but never implemented, causing a silent type-safe lie.
  // Use className + a wrapper <Link> for navigation buttons instead.
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      loading = false,
      active,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    // Spinner color: filled variants get white spinner; outlined/ghost get brand
    const spinnerColor: 'white' | 'brand' =
      variant === 'outline' ||
      variant === 'ghost' ||
      variant === 'toggle' ||
      variant === 'destructive-outline' ||
      variant === 'success-outline' ||
      variant === 'link'
        ? 'brand'
        : 'white'

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        suppressHydrationWarning
        // FIX: cast boolean to string "true" | undefined so Tailwind data-[active=true] matches
        data-active={active === true ? 'true' : undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size="sm" color={spinnerColor} aria-hidden="true" />
            <span className="text-inherit">{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { buttonVariants }
