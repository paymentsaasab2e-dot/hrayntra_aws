"use client"

import * as React from 'react'
import { cn } from '../utils'

// =============================================================================
// Avatar — user/employee initials avatar
// Replaces inline initials divs in Topbar profile, Drawers, and tables.
//
// Usage:
//   <Avatar initials="SJ" />
//   <Avatar initials="AC" size="lg" gradient="blue" />
//   <Avatar initials="MK" size="sm" status="online" />
// =============================================================================

const SIZE_MAP = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-[12px]',
  md: 'size-10 text-[14px]',
  lg: 'size-12 text-[16px]',
  xl: 'size-16 text-[20px]',
}

const GRADIENT_MAP = {
  green:  'from-[#3b82f6] to-[#6366f1]',
  blue:   'from-[#3b82f6] to-[#2563eb]',
  navy:   'from-[#111827] to-[#312e81]',
  amber:  'from-[#f59e0b] to-[#d97706]',
  mixed:  'from-[#06b6d4] to-[#6366f1]',
  emerald:'from-[#3b82f6] to-[#6366f1]',
  indigo: 'from-[#6366f1] to-[#4338ca]',
}

const STATUS_DOT_MAP = {
  online:  'bg-[#6366f1]',
  away:    'bg-[#f59e0b]',
  offline: 'bg-[#94a3b8]',
}

export interface AvatarProps {
  initials: string
  size?: keyof typeof SIZE_MAP
  gradient?: keyof typeof GRADIENT_MAP
  status?: keyof typeof STATUS_DOT_MAP
  className?: string
}

export function Avatar({
  initials,
  size = 'md',
  gradient = 'indigo',
  status,
  className,
}: AvatarProps) {
  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          'bg-gradient-to-br font-bold text-white shadow-sm',
          GRADIENT_MAP[gradient],
          SIZE_MAP[size]
        )}
      >
        {initials.slice(0, 2).toUpperCase()}
      </div>

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white',
            STATUS_DOT_MAP[status]
          )}
        />
      )}
    </div>
  )
}

// =============================================================================
// NavBadge — sidebar notification count pill
// Replaces inline badge spans in Sidebar NavItem.
//
// Usage:
//   <NavBadge count="3" tone="amber" />
//   <NavBadge count="1" tone="red" />
// =============================================================================

const TONE_MAP = {
  amber: 'bg-[#78350f]/60 text-[#fde68a]',
  red:   'bg-[#7f1d1d]/60 text-[#fecaca]',
  green: 'bg-[#10b981]/20 text-[#6ee7b7]',
}

export interface NavBadgeProps {
  count: string | number
  tone?: keyof typeof TONE_MAP
  className?: string
}

export function NavBadge({ count, tone = 'amber', className }: NavBadgeProps) {
  return (
    <span
      className={cn(
        'min-w-[22px] rounded-full px-1.5 py-0.5',
        'text-center text-[10px] font-bold',
        TONE_MAP[tone],
        className
      )}
    >
      {count}
    </span>
  )
}
