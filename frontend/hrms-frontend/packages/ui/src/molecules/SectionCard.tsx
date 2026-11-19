"use client"

import * as React from 'react'
import { cn } from '../utils'

// =============================================================================
// SectionCard — the standard white content card used 20+ times across the app
//
// Replaces:
//   <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
//     <h3 className="text-[14px] font-bold text-gray-800 mb-4 pb-2 border-b">{title}</h3>
//     {children}
//   </div>
//
// Usage:
//   <SectionCard title="Personal Information">
//     <p>Content</p>
//   </SectionCard>
//
//   <SectionCard title="Earnings" titleAction={<Button size="xs">Edit</Button>}>
//     <EarningsTable />
//   </SectionCard>
//
//   <SectionCard>   ← no title — just a plain card wrapper
//     <p>Content</p>
//   </SectionCard>
// =============================================================================

export interface SectionCardProps {
  title?: string
  /** Optional element rendered to the right of the title (e.g., Edit button, badge) */
  titleAction?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Inner body padding override */
  bodyClassName?: string
  /** Remove default padding from body (e.g., for a full-bleed table) */
  noPadding?: boolean
}

export function SectionCard({
  title,
  titleAction,
  children,
  className,
  bodyClassName,
  noPadding = false,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-slate-100/90 bg-slate-50/60 px-4 py-3">
          <h3 className="text-sm font-bold tracking-tight text-slate-900">
            {title}
          </h3>
          {titleAction && <div>{titleAction}</div>}
        </div>
      )}

      <div className={cn(!noPadding && 'p-4 sm:p-5', bodyClassName)}>
        {children}
      </div>
    </div>
  )
}
