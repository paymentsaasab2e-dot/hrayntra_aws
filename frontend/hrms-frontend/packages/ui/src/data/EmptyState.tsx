"use client"

import * as React from 'react'
import { PackageOpen } from 'lucide-react'
import { cn } from '../utils'

// =============================================================================
// EmptyState — zero-data state for tables, lists, and search results
//
// Usage:
//   // Inside a DataTable when data=[] and loading=false:
//   <EmptyState
//     title="No employees found"
//     description="Try adjusting your filters or add a new employee."
//     action={<Button onClick={onAdd}>Add Employee</Button>}
//   />
//
//   // With custom icon:
//   <EmptyState icon={<Search className="size-10" />} title="No results" />
//
//   // Compact (inside a small section):
//   <EmptyState size="sm" title="No records" />
// =============================================================================

export interface EmptyStateProps {
  /** Custom icon/illustration. Defaults to PackageOpen. */
  icon?: React.ReactNode
  title: string
  description?: string
  /** Optional CTA — typically a Button */
  action?: React.ReactNode
  /** sm = compact (inside tables), md = full section empty state */
  size?: 'sm' | 'md'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'md' ? 'py-16 px-8' : 'py-8 px-4',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          'bg-ds-neutral-100 text-ds-neutral-400 mb-4',
          size === 'md' ? 'size-16' : 'size-12'
        )}
      >
        {icon ?? (
          <PackageOpen className={cn(size === 'md' ? 'size-8' : 'size-6')} />
        )}
      </div>

      {/* Title */}
      <h3
        className={cn(
          'font-bold text-ds-neutral-700',
          size === 'md' ? 'text-ds-heading-sm mb-1.5' : 'text-ds-body-md mb-1'
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'text-ds-neutral-500 leading-relaxed max-w-sm',
            size === 'md' ? 'text-ds-body-sm mb-6' : 'text-ds-body-xs mb-4'
          )}
        >
          {description}
        </p>
      )}

      {/* Action CTA */}
      {action && <div>{action}</div>}
    </div>
  )
}
