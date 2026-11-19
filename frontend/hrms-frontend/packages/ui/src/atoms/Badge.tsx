"use client"

import { cn } from '../utils'

// =============================================================================
// StatusBadge — entity/record status pill
// Replaces 8+ inline conditional className strings across the app.
//
// ⚠️  ARCHITECTURAL NOTE — hex values in lookup maps are INTENTIONAL:
//     Tailwind purges classes it cannot statically find in source files.
//     A lookup map like STATUS_MAP['Active'] is evaluated at runtime —
//     Tailwind's static scanner cannot see the result. If we wrote
//     `bg-ds-success-light` into a JS variable, it would be purged.
//     The correct pattern for runtime-selected classes is:
//       1. Keep full class strings in the map (what we do here), OR
//       2. Use CSS variables with inline style (over-engineered for this case)
//     These hex values ARE sourced from tokens/colors.ts — changes must be
//     updated here when the token file changes.
//
// Usage:
//   <StatusBadge status="Active" />
//   <StatusBadge status="Inactive" />
//   <StatusBadge status="On Leave" withDot />
// =============================================================================

const STATUS_MAP: Record<string, { bg: string; text: string; dot?: string }> = {
  // ── Mint/green positive states
  'Active':         { bg: 'bg-[#ecfdf5]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },
  'Compliant':      { bg: 'bg-[#ecfdf5]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },
  'Paid':           { bg: 'bg-[#ecfdf5]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },
  'Valid':          { bg: 'bg-[#ecfdf5]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },
  'Verified':       { bg: 'bg-[#ecfdf5]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },
  'Resolved':       { bg: 'bg-[#ecfdf5]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },
  'Auto-Resolved':  { bg: 'bg-[#ecfdf5]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },
  'Present':        { bg: 'bg-[#ecfdf5]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },
  'Approved':       { bg: 'bg-[#ecfdf5]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },

  // ── Lavender pending states
  'On Leave':        { bg: 'bg-[#f5f3ff]', text: 'text-[#6d28d9]', dot: 'bg-[#8b5cf6]' },
  'Pending':         { bg: 'bg-[#f5f3ff]', text: 'text-[#6d28d9]', dot: 'bg-[#8b5cf6]' },
  'Action Required': { bg: 'bg-[#f5f3ff]', text: 'text-[#6d28d9]', dot: 'bg-[#8b5cf6]' },
  'In Progress':     { bg: 'bg-[#f5f3ff]', text: 'text-[#6d28d9]', dot: 'bg-[#8b5cf6]' },

  // ── Amber caution states
  'Late':            { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', dot: 'bg-[#f59e0b]' },
  'Missing Data':    { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]' },

  // ── Rose/red negative states
  'Inactive':      { bg: 'bg-[#fff1f2]', text: 'text-[#be123c]', dot: 'bg-[#f43f5e]' },
  'Absent':        { bg: 'bg-[#fff1f2]', text: 'text-[#be123c]', dot: 'bg-[#f43f5e]' },
  'Missing':       { bg: 'bg-[#fff1f2]', text: 'text-[#be123c]' },
  'Non-Compliant': { bg: 'bg-[#fff1f2]', text: 'text-[#be123c]', dot: 'bg-[#f43f5e]' },
  'Failed':        { bg: 'bg-[#fff1f2]', text: 'text-[#be123c]', dot: 'bg-[#f43f5e]' },
  'Rejected':      { bg: 'bg-[#fff1f2]', text: 'text-[#be123c]', dot: 'bg-[#f43f5e]' },
  'Bounced':       { bg: 'bg-[#fff1f2]', text: 'text-[#be123c]' },

  // ── Gray/Neutral states
  'Draft':    { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', dot: 'bg-[#94a3b8]' },
  'Archived': { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', dot: 'bg-[#94a3b8]' },

  // ── Blue info states
  'Modification Requested': { bg: 'bg-[#dbeafe]', text: 'text-[#1d4ed8]', dot: 'bg-[#3b82f6]' },
}

// Fallback for unknown status values
const STATUS_FALLBACK = { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]' }

export interface StatusBadgeProps {
  status: string
  /** Show a colored dot before the label */
  withDot?: boolean
  className?: string
}

export function StatusBadge({ status, withDot = false, className }: StatusBadgeProps) {
  const style = STATUS_MAP[status] ?? STATUS_FALLBACK

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-2.5 py-1 rounded-lg',
        'text-[11px] font-bold uppercase tracking-wide whitespace-nowrap',
        style.bg,
        style.text,
        className
      )}
    >
      {withDot && style.dot && (
        <span className={cn('size-1.5 rounded-full shrink-0', style.dot)} />
      )}
      {status}
    </span>
  )
}

// =============================================================================
// SeverityBadge — alert / risk level indicator
// Replaces 7+ inline conditional class strings for severity.
//
// Usage:
//   <SeverityBadge level="High" />
//   <SeverityBadge level="Medium" />
//   <SeverityBadge level="Low" />
//   <SeverityBadge level="Critical" />
// =============================================================================

const SEVERITY_MAP: Record<string, { bg: string; text: string }> = {
  'Critical': { bg: 'bg-[#fee2e2]', text: 'text-[#7f1d1d]' },
  'High':     { bg: 'bg-[#fee2e2]', text: 'text-red-600' },
  'Medium':   { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]' },
  'Low':      { bg: 'bg-[#dbeafe]', text: 'text-[#1e3a8a]' },
  'Info':     { bg: 'bg-[#dbeafe]', text: 'text-[#1e3a8a]' },
}

const SEVERITY_FALLBACK = { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]' }

export interface SeverityBadgeProps {
  level: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info' | string
  uppercase?: boolean
  className?: string
}

export function SeverityBadge({ level, uppercase = true, className }: SeverityBadgeProps) {
  const style = SEVERITY_MAP[level] ?? SEVERITY_FALLBACK

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded',
        'text-ds-micro font-bold leading-none tracking-widest',
        uppercase && 'uppercase',
        style.bg,
        style.text,
        className
      )}
    >
      {level}
    </span>
  )
}
