"use client"

import * as React from 'react'
import { cn } from '../utils'

export type MetricStatTone = 'blue' | 'mint' | 'rose' | 'lavender' | 'amber' | 'indigo'

const TONE_STYLES: Record<
  MetricStatTone,
  { card: string; label: string; iconWrap: string; icon: string; subtitle?: string }
> = {
  blue: {
    card: 'bg-gradient-to-br from-white via-white to-blue-50/70 border-slate-200/90 hover:border-blue-300 shadow-[0_1px_3px_rgba(59,130,246,0.04)]',
    label: 'text-slate-500',
    iconWrap: 'bg-blue-50/90 border-blue-100 text-blue-600',
    icon: 'text-blue-600',
    subtitle: 'text-slate-500',
  },
  mint: {
    card: 'bg-gradient-to-br from-white via-white to-emerald-50/70 border-slate-200/90 hover:border-emerald-300 shadow-[0_1px_3px_rgba(16,185,129,0.04)]',
    label: 'text-slate-500',
    iconWrap: 'bg-emerald-50/90 border-emerald-100 text-emerald-600',
    icon: 'text-emerald-600',
    subtitle: 'text-emerald-600 font-semibold',
  },
  rose: {
    card: 'bg-gradient-to-br from-white via-white to-rose-50/70 border-slate-200/90 hover:border-rose-300 shadow-[0_1px_3px_rgba(244,63,94,0.04)]',
    label: 'text-slate-500',
    iconWrap: 'bg-rose-50/90 border-rose-100 text-rose-600',
    icon: 'text-rose-600',
    subtitle: 'text-rose-600 font-semibold',
  },
  lavender: {
    card: 'bg-gradient-to-br from-white via-white to-purple-50/70 border-slate-200/90 hover:border-purple-300 shadow-[0_1px_3px_rgba(168,85,247,0.04)]',
    label: 'text-slate-500',
    iconWrap: 'bg-purple-50/90 border-purple-100 text-purple-600',
    icon: 'text-purple-600',
    subtitle: 'text-slate-500',
  },
  amber: {
    card: 'bg-gradient-to-br from-white via-white to-amber-50/70 border-slate-200/90 hover:border-amber-300 shadow-[0_1px_3px_rgba(245,158,11,0.04)]',
    label: 'text-slate-500',
    iconWrap: 'bg-amber-50/90 border-amber-100 text-amber-600',
    icon: 'text-amber-600',
    subtitle: 'text-amber-600 font-semibold',
  },
  indigo: {
    card: 'bg-gradient-to-br from-white via-white to-indigo-50/70 border-slate-200/90 hover:border-indigo-300 shadow-[0_1px_3px_rgba(99,102,241,0.04)]',
    label: 'text-slate-500',
    iconWrap: 'bg-indigo-50/90 border-indigo-100 text-indigo-600',
    icon: 'text-indigo-600',
    subtitle: 'text-indigo-600 font-semibold',
  },
}

export interface MetricStatCardProps {
  label: string
  value: string | number
  subtitle?: string
  tone?: MetricStatTone
  icon: React.ComponentType<{ className?: string }>
  className?: string
  subtitleClassName?: string
  compact?: boolean
  onClick?: () => void
  active?: boolean
}

export function MetricStatCard({
  label,
  value,
  subtitle,
  tone = 'blue',
  icon: Icon,
  className,
  subtitleClassName,
  compact = false,
  onClick,
  active = false,
}: MetricStatCardProps) {
  const styles = TONE_STYLES[tone]

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-between overflow-hidden rounded-xl border transition-all duration-150',
        compact ? 'min-h-[64px] px-3.5 py-2.5' : 'min-h-[76px] p-4',
        'shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
        styles.card,
        onClick && 'cursor-pointer hover:shadow-xs active:scale-[0.99]',
        active && 'ring-2 ring-indigo-500/70 border-indigo-400 bg-indigo-50/25',
        className
      )}
    >
      <div className="min-w-0 pr-3">
        <p className={cn('text-[11px] font-bold uppercase tracking-[0.08em]', styles.label)}>{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-2xl font-black leading-none tracking-tight text-slate-900">{value}</p>
          {subtitle && (
            <p className={cn('text-[11px] font-medium leading-none truncate', styles.subtitle, subtitleClassName)}>{subtitle}</p>
          )}
        </div>
      </div>
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-2xs',
          styles.iconWrap
        )}
      >
        <Icon className={cn('size-4 stroke-[2.2]', styles.icon)} />
      </div>
    </div>
  )
}
