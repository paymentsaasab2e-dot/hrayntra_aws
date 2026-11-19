"use client"

import * as React from 'react'
import { cn } from '../utils'

export interface PageHeroBannerProps {
  /** Small caps line above title — e.g. formatted date */
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** Pill badge below description — e.g. "Headquarters" */
  badge?: string
  actions?: React.ReactNode
  /** Slightly shorter banner when stats sit directly below */
  compact?: boolean
  className?: string
  /** Visual style: 'clean' (modern open canvas) or 'mesh' (dark obsidian gradient) */
  variant?: 'clean' | 'mesh'
}

export function PageHeroBanner({
  eyebrow,
  title,
  description,
  badge,
  actions,
  compact = false,
  className,
  variant = 'clean',
}: PageHeroBannerProps) {
  if (variant === 'clean') {
    return (
      <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1 shrink-0', className)}>
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex items-center gap-3 mt-0.5">
            <h1 className="text-2xl md:text-[28px] font-black tracking-tight text-slate-900 leading-tight">
              {title}
            </h1>
            {badge ? (
              <span className="inline-flex items-center rounded-full border border-indigo-200/80 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                {badge}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-800/80 shrink-0',
        'bg-gradient-to-br from-[#090d16] via-[#0f172a] to-[#1e1b4b]',
        'shadow-[0_4px_20px_-4px_rgba(15,23,42,0.12),0_12px_32px_-8px_rgba(79,70,229,0.15)]',
        compact ? 'px-5 py-4 md:px-6 md:py-5' : 'px-6 py-6 md:px-8 md:py-7',
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-indigo-500/18 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-1/3 size-40 rounded-full bg-cyan-500/12 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[64px] flex-col gap-4 sm:min-h-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 pr-2">
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-300">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl md:text-[26px] md:leading-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              {description}
            </p>
          ) : null}
          {badge ? (
            <span className="mt-2.5 inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-200 backdrop-blur-sm">
              {badge}
            </span>
          ) : null}
        </div>

        {actions ? (
          <div
            className={cn(
              'flex shrink-0 flex-wrap items-center gap-2 sm:justify-end',
              /* Hero actions: crisp white primary buttons with dark text */
              '[&_button]:!border-white [&_button]:!bg-white [&_button]:!text-slate-900',
              '[&_button]:shadow-sm [&_button]:hover:!bg-slate-100 [&_button]:hover:!text-slate-900',
              '[&_button_svg]:!text-slate-900'
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}
