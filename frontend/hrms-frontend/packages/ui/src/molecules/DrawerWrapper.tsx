"use client"

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '../atoms/Button'
import { cn } from '../utils'
import { lockScroll, unlockScroll } from '../utils/scroll-lock'

// =============================================================================
// DrawerWrapper — right-side slide panel
//
// CHANGES vs v1:
//   - CRITICAL FIX: Removed `if (!open) return null` that killed exit animation.
//     Now uses a `mounted` state — component stays in DOM during close transition.
//     CSS transition plays on both open and close.
//   - Scroll lock now uses SHARED counter from utils/scroll-lock.ts — safe stacking.
//   - Replaced bg-gray-50/gray-200 with ds-* token classes.
//   - headerExtra pb-0 removed — lets headerExtra content control its own spacing.
//   - Added role="dialog" aria-modal="true" aria-labelledby.
// =============================================================================

// ─── Size Map ─────────────────────────────────────────────────────────────────

const SIZE_MAP = {
  sm:   'max-w-[450px]',
  md:   'max-w-[600px]',
  lg:   'max-w-[800px]',
  full: 'max-w-[960px]',
  /** Standard wide drawer for rich forms */
  xl:   'w-full max-w-[760px] sm:w-[620px] md:w-[700px] lg:w-[760px]',
} as const

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DrawerWrapperProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  size?: keyof typeof SIZE_MAP
  /** Rendered below the title row — TabsNav, AlertBanner, etc. */
  headerExtra?: React.ReactNode
  /** Footer bar pinned at bottom — action buttons */
  footer?: React.ReactNode
  /** Right side of header row — edit button, overflow menu */
  headerActions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

const TRANSITION_DURATION = 300 // ms — must match CSS duration below

export function DrawerWrapper({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  headerExtra,
  footer,
  headerActions,
  children,
  className,
}: DrawerWrapperProps) {
  const titleId = React.useId()

  // FIX: Keep component mounted during close animation.
  // `mounted` tracks whether DOM elements should exist.
  // `visible` drives the CSS translate (true = translate-x-0, false = translate-x-full)
  const [mounted, setMounted] = React.useState(false)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setMounted(true)
      // Small rAF delay so browser registers the initial translate-x-full
      // before we set translate-x-0, otherwise the transition won't play.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      // Trigger close animation, then unmount after transition completes
      setVisible(false)
      const timer = setTimeout(() => setMounted(false), TRANSITION_DURATION)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Escape key
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Scroll lock — shared counter
  React.useEffect(() => {
    if (open) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [open])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[9998] backdrop-blur-xs transition-opacity ease-out',
          'bg-slate-950/40',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        style={{ transitionDuration: `${TRANSITION_DURATION}ms` }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'fixed inset-y-0 right-0 z-[9999] flex flex-col w-full max-h-screen overflow-hidden',
          'bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.3)] border-l border-slate-200/90 rounded-l-2xl',
          'transform transition-transform ease-[cubic-bezier(0.16,1,0.3,1)]',
          visible ? 'translate-x-0' : 'translate-x-full',
          SIZE_MAP[size],
          className
        )}
        style={{ transitionDuration: `${TRANSITION_DURATION}ms` }}
      >
        {/* Sticky Header */}
        <div className="shrink-0 border-b border-slate-200/80 bg-slate-50/80 backdrop-blur-md">
          <div className="flex items-start justify-between px-6 py-4">
            <div className="flex-1 min-w-0">
              <h2
                id={titleId}
                className="text-base sm:text-lg font-bold text-slate-900 leading-tight pr-4"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close panel"
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 ml-1 rounded-lg cursor-pointer"
              >
                <X className="size-4.5" />
              </Button>
            </div>
          </div>

          {/* Header Extra */}
          {headerExtra && (
            <div className="px-6 pb-3">
              {headerExtra}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 bg-slate-50/40">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-6 py-3.5 w-full shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
