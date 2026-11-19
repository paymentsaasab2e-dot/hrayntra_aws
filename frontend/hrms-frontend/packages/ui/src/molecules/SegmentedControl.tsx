"use client"

import * as React from 'react'
import { cn } from '../utils'

export interface SegmentedControlOption {
  value: string
  label: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
  fullWidth?: boolean
  className?: string
  'aria-label'?: string
}

const SIZE = {
  sm: { btn: 'px-3 py-1.5 text-xs', icon: 'size-3.5' },
  md: { btn: 'px-4 py-2 text-sm', icon: 'size-4' },
} as const

export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-[#dbe3ee] bg-[#f1f5f9]/90 p-1 shadow-sm',
        fullWidth && 'flex w-full',
        className
      )}
    >
      {options.map((option) => {
        const active = value === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-150',
              'outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/30',
              'disabled:pointer-events-none disabled:opacity-50',
              SIZE[size].btn,
              fullWidth && 'flex-1',
              active
                ? 'bg-[#111827] !text-white shadow-sm [&_svg]:!text-white'
                : 'text-[#64748b] hover:bg-white/80 hover:text-[#111827] [&_svg]:text-current'
            )}
          >
            {Icon ? <Icon className={SIZE[size].icon} aria-hidden /> : null}
            <span className="text-inherit">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export interface FilterChipOption {
  value: string
  label: React.ReactNode
}

export interface FilterChipsProps {
  options: FilterChipOption[]
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

/** Standalone pill filters (category chips, status chips) */
export function FilterChips({ options, value, onChange, label, className }: FilterChipsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {label ? (
        <span className="shrink-0 text-[13px] font-semibold text-[#475569]">{label}</span>
      ) : null}
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
              'outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/30',
              active
                ? 'border-[#111827] bg-[#111827] !text-white shadow-sm'
                : 'border-[#dbe3ee] bg-white text-[#64748b] hover:border-[#cbd5e1] hover:text-[#111827]'
            )}
          >
            <span className="text-inherit">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
