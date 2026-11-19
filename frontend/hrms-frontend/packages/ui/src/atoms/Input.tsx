"use client"

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils'

// =============================================================================
// Input — text input atom
//
// CHANGES vs v1:
//   - Removed wrapper <div> from Input component itself.
//     The wrapper caused `id` from FormField to land on the div, not the <input>.
//     The wrapper responsibility is now handled by InputWrapper (internal helper) OR
//     left to the parent FormField/layout component.
//   - Icon slots are now handled via InputWrapper (exported separately) so icon
//     positioning works without id association breakage.
//   - All hex values replaced with ds-* token classes.
//   - Select gets its own CVA instead of duplicating inputVariants strings.
//
// Label Association Fix:
//   FormField passes id as a plain prop. Input spreads all props to the native
//   <input>, so id safely reaches the real DOM element. No cloneElement needed.
// =============================================================================

const inputBase = cva(
  [
    'w-full min-w-0 border bg-white font-medium',
    'placeholder:text-ds-neutral-400 text-ds-neutral-900',
    'transition-colors outline-none rounded-lg',
    'border-ds-neutral-200',
    'disabled:pointer-events-none disabled:opacity-50 disabled:bg-ds-neutral-50',
    'focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15',
    'aria-invalid:border-ds-danger aria-invalid:ring-2 aria-invalid:ring-ds-danger/20',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-ds-body-sm',   // compact — topbar, filter bar
        md: 'h-10 px-3 text-ds-body',      // standard — form fields
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

// ─── Icon offset variants (applied when wrapped with InputWrapper) ─────────────
//
// These are NOT applied to bare <Input> — only when you use <InputWrapper>.
// This decoupling is what fixes the id-on-div bug.
export const inputWithIconVariants = {
  leftPadding:  'pl-9',
  rightPadding: 'pr-9',
} as const

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    Pick<VariantProps<typeof inputBase>, 'size'> {
  /** Pass true if a left icon is rendered by a wrapping InputWrapper */
  hasLeftIcon?: boolean
  /** Pass true if a right icon is rendered by a wrapping InputWrapper */
  hasRightIcon?: boolean
  /** Error state — adds red border + ring via aria-invalid */
  error?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = 'md', hasLeftIcon, hasRightIcon, error, type, ...props }, ref) => {
    return (
      // No wrapper div here. id, aria-invalid, and all other props go
      // directly to the native <input> via ...props spread.
      <input
        ref={ref}
        type={type}
        aria-invalid={error ? true : undefined}
        className={cn(
          inputBase({ size }),
          hasLeftIcon && inputWithIconVariants.leftPadding,
          hasRightIcon && inputWithIconVariants.rightPadding,
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

// =============================================================================
// InputWrapper — positions icon(s) around an Input without wrapping the <input>
// for id purposes. Use this when you need icons inside the input field.
//
// Usage:
//   <FormField label="Search" id="q">
//     <InputWrapper leftIcon={<Search className="size-4" />}>
//       <Input id="q" size="sm" hasLeftIcon />
//     </InputWrapper>
//   </FormField>
//
//   OR for standalone use (no FormField):
//   <InputWrapper leftIcon={<Search />}>
//     <Input placeholder="Search..." hasLeftIcon />
//   </InputWrapper>
// =============================================================================

export interface InputWrapperProps {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** If rightIcon should be interactive (e.g., eye toggle, clear button) */
  rightIconInteractive?: boolean
  children: React.ReactNode
  className?: string
}

export function InputWrapper({
  leftIcon,
  rightIcon,
  rightIconInteractive = false,
  children,
  className,
}: InputWrapperProps) {
  return (
    <div className={cn('relative w-full', className)}>
      {leftIcon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ds-neutral-400">
          {leftIcon}
        </div>
      )}

      {children}

      {rightIcon && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center pr-3 text-ds-neutral-400',
            rightIconInteractive ? 'cursor-pointer' : 'pointer-events-none'
          )}
        >
          {rightIcon}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Select — native select element
// CHANGES vs v1: uses inputBase CVA (same base as Input) — eliminates duplication
// =============================================================================

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    Pick<VariantProps<typeof inputBase>, 'size'> {
  error?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size = 'md', error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(inputBase({ size }), 'cursor-pointer', className)}
        {...props}
      >
        {children}
      </select>
    )
  }
)

Select.displayName = 'Select'

// =============================================================================
// Textarea — multi-line text input (was missing in v1)
// =============================================================================

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  size?: 'sm' | 'md'
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, size = 'md', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full min-w-0 border bg-white font-medium',
          'placeholder:text-ds-neutral-400 text-ds-neutral-900',
          'transition-colors outline-none rounded-lg',
          'border-ds-neutral-200',
          'disabled:pointer-events-none disabled:opacity-50 disabled:bg-ds-neutral-50',
          'focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15',
          'aria-invalid:border-ds-danger aria-invalid:ring-2 aria-invalid:ring-ds-danger/20',
          'resize-y min-h-[80px] py-2.5',
          size === 'sm' ? 'px-3 text-ds-body-sm' : 'px-3 text-ds-body',
          className
        )}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'
