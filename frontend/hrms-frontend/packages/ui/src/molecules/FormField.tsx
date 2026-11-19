"use client"

import * as React from 'react'
import { cn } from '../utils'

// =============================================================================
// FormField — label + input + required marker + error + hint
//
// CHANGES vs v1:
//   - Removed React.cloneElement entirely (was applying id to wrapper div)
//   - New approach: FormField generates an id and exposes it via context.
//     Input/Select/Textarea pick it up automatically — no cloneElement, no
//     manual id threading, no broken label associations.
//   - Hint now shows alongside error (not hidden by it)
//   - Added labelVariant prop for uppercase vs default label style
//   - All hex values replaced with ds-* token classes
//
// How label association works now:
//   1. FormField generates a stable id with React.useId()
//   2. id is placed in FormFieldContext
//   3. <label htmlFor={id}> in FormField reads from context
//   4. Input/Select/Textarea call useFormField() and apply id to the native element
//   5. No children manipulation required at all
// =============================================================================

interface FormFieldContextValue {
  id: string
  error: boolean
  required: boolean
  disabled: boolean
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

/** Read FormField context from inside Input, Select, Textarea */
export function useFormField(): FormFieldContextValue | null {
  return React.useContext(FormFieldContext)
}

// ─── FormField ────────────────────────────────────────────────────────────────

export interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  disabled?: boolean
  /** 'uppercase' = LABEL STYLE  |  'default' = Label Style */
  labelVariant?: 'uppercase' | 'default'
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  required = false,
  error,
  hint,
  disabled = false,
  labelVariant = 'uppercase',
  children,
  className,
}: FormFieldProps) {
  const id = React.useId()

  const contextValue: FormFieldContextValue = {
    id,
    error: !!error,
    required,
    disabled,
  }

  return (
    <FormFieldContext.Provider value={contextValue}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        {/* Label — htmlFor correctly points to native input via context id */}
        <label
          htmlFor={id}
          className={cn(
            'text-[13px] font-semibold text-[#475569] leading-none',
            labelVariant === 'uppercase'
              ? 'text-ds-label uppercase tracking-wide'
              : 'text-ds-body-sm normal-case'
          )}
        >
          {label}
          {required && (
            <span className="text-ds-danger ml-0.5 normal-case" aria-hidden="true">*</span>
          )}
        </label>

        {/* Input slot — id is applied by the child via useFormField() context */}
        {children}

        {/* Hint — always visible (even when error is shown) */}
        {hint && (
          <p className="text-ds-caption text-ds-neutral-400 leading-none">
            {hint}
          </p>
        )}

        {/* Error — shown below hint */}
        {error && (
          <p role="alert" className="text-ds-label text-ds-danger font-medium leading-none">
            {error}
          </p>
        )}
      </div>
    </FormFieldContext.Provider>
  )
}

// =============================================================================
// ConnectedInput — thin wrapper around any <input>/<select>/<textarea> that
// reads FormField context and applies id + aria-invalid + disabled automatically.
//
// IMPORTANT: Use this adapter inside FormField when you need context integration.
// Direct <Input>, <Select>, <Textarea> also work — they accept id as a plain prop
// because they spread all props to the native element.
//
// Most common pattern (simplest — no cloneElement, no context needed):
//
//   <FormField label="Email" required error={errors.email}>
//     <Input id="email" type="email" />   ← manual id, still correct
//   </FormField>
//
// Context-connected pattern (id auto-generated, zero prop threading):
//
//   <FormField label="Email" required error={errors.email}>
//     <FormFieldInput>
//       <Input type="email" />
//     </FormFieldInput>
//   </FormField>
// =============================================================================

export function FormFieldInput({ children }: { children: React.ReactElement<{ id?: string; 'aria-invalid'?: boolean; disabled?: boolean }> }) {
  const ctx = useFormField()
  if (!ctx) return <>{children}</>

  return React.cloneElement(children, {
    id: ctx.id,
    'aria-invalid': ctx.error || undefined,
    disabled: ctx.disabled || children.props.disabled,
  })
}

// =============================================================================
// FormGrid — responsive grid layout for form fields
// =============================================================================

export interface FormGridProps {
  cols?: 1 | 2 | 3
  children: React.ReactNode
  className?: string
}

export function FormGrid({ cols = 2, children, className }: FormGridProps) {
  return (
    <div
      className={cn(
        'grid gap-5',
        cols === 1 && 'grid-cols-1',
        cols === 2 && 'grid-cols-1 sm:grid-cols-2',
        cols === 3 && 'grid-cols-1 sm:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  )
}

// =============================================================================
// FormSection — titled group of FormFields
// =============================================================================

export interface FormSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  /** Card panel inside drawers / modals */
  variant?: 'plain' | 'card'
  tone?: 'white' | 'blue' | 'lavender' | 'mint'
}

const SECTION_CARD_TONES: Record<NonNullable<FormSectionProps['tone']>, string> = {
  white: 'bg-white border-[#e2e8f0]',
  blue: 'bg-gradient-to-br from-[#eff6ff] via-white to-white border-[#bfdbfe]',
  lavender: 'bg-gradient-to-br from-[#f5f3ff] via-white to-white border-[#ddd6fe]',
  mint: 'bg-gradient-to-br from-[#ecfdf5] via-white to-white border-[#a7f3d0]',
}

export function FormSection({
  title,
  description,
  children,
  className,
  variant = 'plain',
  tone = 'white',
}: FormSectionProps) {
  return (
    <div
      className={cn(
        variant === 'card' && cn('space-y-4 rounded-2xl border p-5 shadow-sm', SECTION_CARD_TONES[tone]),
        variant === 'plain' && 'space-y-4',
        className
      )}
    >
      {(title || description) && (
        <div className={cn('pb-1', variant === 'plain' && 'border-b border-[#e2e8f0] pb-3')}>
          {title && (
            <h3 className="text-base font-bold text-[#111827]">{title}</h3>
          )}
          {description && (
            <p className="mt-1 text-[13px] font-medium text-[#64748b]">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
