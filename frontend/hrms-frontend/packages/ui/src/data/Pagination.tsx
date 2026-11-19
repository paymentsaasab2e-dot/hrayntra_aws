"use client"

import * as React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '../atoms/Button'
import { cn } from '../utils'

// =============================================================================
// Pagination — standardized table pagination controls
// Promoted from payroll-app/components/employees/PaginationComponent.tsx.
//
// Usage:
//   <Pagination
//     total={employees.length}
//     page={page}
//     perPage={perPage}
//     onPageChange={setPage}
//     onPerPageChange={setPerPage}
//   />
//
//   // Read-only (no perPage selector):
//   <Pagination total={100} page={3} perPage={10} onPageChange={setPage} />
// =============================================================================

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

export interface PaginationProps {
  /** Total item count */
  total: number
  /** Current 1-indexed page */
  page: number
  /** Items per page */
  perPage: number
  /** Called when user changes page */
  onPageChange: (page: number) => void
  /** Called when user changes per-page. Omit to hide the per-page selector. */
  onPerPageChange?: (perPage: number) => void
  /** Override available per-page options */
  perPageOptions?: readonly number[]
  className?: string
}

export function Pagination({
  total,
  page,
  perPage,
  onPageChange,
  onPerPageChange,
  perPageOptions = PER_PAGE_OPTIONS,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const isFirst = page <= 1
  const isLast = page >= totalPages

  // Range shown: e.g. "Showing 11–20 of 89"
  const rangeStart = Math.min((page - 1) * perPage + 1, total)
  const rangeEnd = Math.min(page * perPage, total)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        'px-5 py-3 border-t border-ds-neutral-200 bg-white',
        className
      )}
    >
      {/* Left: row count info + per-page selector */}
      <div className="flex items-center gap-4">
        <p className="text-ds-body-sm text-ds-neutral-500 whitespace-nowrap">
          Showing{' '}
          <span className="font-bold text-ds-neutral-900">
            {total === 0 ? 0 : rangeStart}–{rangeEnd}
          </span>{' '}
          of{' '}
          <span className="font-bold text-ds-neutral-900">{total}</span>
        </p>

        {onPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-ds-body-sm text-ds-neutral-500 whitespace-nowrap">
              Rows per page:
            </span>
            <select
              value={perPage}
              onChange={(e) => {
                onPerPageChange(Number(e.target.value))
                onPageChange(1) // reset to page 1 on perPage change
              }}
              className={cn(
                'h-8 rounded-lg border border-ds-neutral-200 bg-white',
                'text-ds-body-sm text-ds-neutral-900 font-medium px-2 pr-6',
                'focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15',
                'outline-none cursor-pointer transition-colors',
              )}
            >
              {perPageOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: page navigation */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(1)}
          disabled={isFirst}
          aria-label="First page"
        >
          <ChevronsLeft className="size-4" />
        </Button>

        {/* Previous page */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirst}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {/* Page indicator */}
        <span className="px-3 text-ds-body-sm text-ds-neutral-700 font-medium whitespace-nowrap">
          Page {page} of {totalPages}
        </span>

        {/* Next page */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={isLast}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>

        {/* Last page */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(totalPages)}
          disabled={isLast}
          aria-label="Last page"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
