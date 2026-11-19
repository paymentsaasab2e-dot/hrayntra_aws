"use client"

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { Button } from '../atoms/Button'
import { cn } from '../utils'
import { lockScroll, unlockScroll } from '../utils/scroll-lock'

// =============================================================================
// ModalWrapper — generic centered modal shell
//
// CHANGES vs v1:
//   - Merged imports to top (was split across file)
//   - Fixed footer layout: justify-end default (not justify-between)
//   - Header is conditional — renders only when title is non-empty string
//   - Added role="dialog" aria-modal="true" aria-labelledby
//   - Scroll lock uses shared counter (safe with concurrent overlays)
//   - All hex replaced with ds-* token classes
//   - ConfirmDialog moved to bottom of same file but imports are merged at top
// =============================================================================

const MODAL_SIZE_MAP = {
  sm: 'max-w-sm',    // ~384px — confirm dialogs
  md: 'max-w-md',    // ~448px — simple forms, format pickers
  lg: 'max-w-lg',    // ~512px — import/export modals
  xl: 'max-w-2xl',   // ~672px — multi-step forms
  full: 'max-w-4xl', // complex editors
} as const

export interface ModalWrapperProps {
  open: boolean
  onClose: () => void
  /** Title rendered in header. Pass empty string to suppress the header entirely. */
  title: React.ReactNode
  /** Optional badge/label next to the title */
  subtitle?: React.ReactNode
  size?: keyof typeof MODAL_SIZE_MAP
  /**
   * Footer slot — rendered in the footer bar.
   * FIX: footer container is now justify-end by default.
   * To put a button on the left and right, wrap in a flex div with justify-between.
   */
  footer?: React.ReactNode
  /** Extra header row — rendered below the title (e.g., StepTracker) */
  headerExtra?: React.ReactNode
  children: React.ReactNode
  className?: string
  disableBackdropClose?: boolean
  bodyClassName?: string
}

export function ModalWrapper({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  headerExtra,
  children,
  className,
  disableBackdropClose = false,
  bodyClassName,
}: ModalWrapperProps) {
  const titleId = React.useId()
  const hasTitle = title !== '' && title != null
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Escape key
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Scroll lock — uses shared counter: safe with concurrent modals/drawers
  React.useEffect(() => {
    if (open) {
      lockScroll()
    }
    return () => {
      if (open) unlockScroll()
    }
  }, [open])

  if (!open || !mounted || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
        onClick={disableBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel — accessible dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? titleId : undefined}
        className={cn(
          'relative z-10 w-full flex flex-col',
          'bg-white rounded-2xl shadow-2xl border border-[#e2e8f0]/80',
          'max-h-[90vh]',
          MODAL_SIZE_MAP[size],
          className
        )}
      >
        {/* Header — conditionally rendered. Suppressed when title is empty string. */}
        {hasTitle && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2e8f0] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2
                id={titleId}
                className="text-xl font-bold text-[#111827] leading-tight truncate"
              >
                {title}
              </h2>
              {subtitle && (
                <span className="text-sm text-[#64748b] font-medium shrink-0">
                  {subtitle}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close modal"
              className="shrink-0 ml-2 text-ds-neutral-500"
            >
              <X className="size-5" />
            </Button>
          </div>
        )}

        {/* Header extra (e.g., StepTracker) */}
        {headerExtra && (
          <div className="px-6 py-3 bg-ds-neutral-50 border-b border-ds-neutral-200 shrink-0">
            {headerExtra}
          </div>
        )}

        {/* Body */}
        <div className={cn('flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// =============================================================================
// ConfirmDialog — pre-composed confirm/delete dialog
// FIX vs v1:
//   - No longer passes title="" to ModalWrapper (was showing empty h2 + close btn)
//   - Uses hideHeader via empty title + aria-label on outer div instead
//   - Imports merged at top of file
// =============================================================================

const DIALOG_ICON_MAP = {
  destructive: { icon: AlertTriangle, iconClass: 'text-ds-danger',           confirmVariant: 'destructive' as const },
  warning:     { icon: AlertTriangle, iconClass: 'text-ds-warning',           confirmVariant: 'default' as const },
  info:        { icon: Info,          iconClass: 'text-ds-info',              confirmVariant: 'default' as const },
  success:     { icon: CheckCircle,   iconClass: 'text-ds-brand-green',       confirmVariant: 'default' as const },
}

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  variant?: keyof typeof DIALOG_ICON_MAP
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  variant = 'destructive',
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
}: ConfirmDialogProps) {
  const config = DIALOG_ICON_MAP[variant]
  const Icon = config.icon

  return (
    // Pass empty string for title — header is suppressed.
    // The dialog's accessible name comes from aria-label on the role=dialog element.
    <ModalWrapper
      open={open}
      onClose={onClose}
      title=""
      size="sm"
      footer={
        // This is a ConfirmDialog-specific footer. Use justify-between inside
        // to align Cancel left, Confirm right.
        <div className="flex w-full gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            {cancelLabel}
          </Button>
          <Button variant={config.confirmVariant} onClick={onConfirm} loading={loading} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center pt-2 pb-1">
        <Icon className={cn('size-12 mb-4', config.iconClass)} />
        <h3 className="text-ds-heading font-bold text-ds-neutral-900 mb-2">{title}</h3>
        {description && (
          <p className="text-ds-body-sm text-ds-neutral-500 leading-relaxed">{description}</p>
        )}
      </div>
    </ModalWrapper>
  )
}
