"use client"

import * as React from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '../atoms/Button'
import { DrawerWrapper } from './DrawerWrapper'
import { cn } from '../utils'

export const FILTER_FIELD_LABEL =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748b]'

export const FILTER_INPUT_CLASS =
  'h-10 w-full rounded-xl border-[#dbe3ee] bg-[#f8fafc]/80'

export interface FilterTriggerButtonProps {
  onClick: () => void
  activeCount?: number
  label?: string
  className?: string
}

/** Compact toolbar button — opens filter drawer */
export function FilterTriggerButton({
  onClick,
  activeCount = 0,
  label = 'Filters',
  className,
}: FilterTriggerButtonProps) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className={className}>
      <SlidersHorizontal className="size-4 text-[#6366f1]" aria-hidden />
      {label}
      {activeCount > 0 ? (
        <span className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#111827] px-1.5 text-[10px] font-bold text-white">
          {activeCount}
        </span>
      ) : null}
    </Button>
  )
}

export interface FilterDrawerProps {
  open: boolean
  onClose: () => void
  onApply: () => void
  onClear: () => void
  children: React.ReactNode
  title?: string
  subtitle?: string
  className?: string
}

/** Right-side drawer shell for page filters */
export function FilterDrawer({
  open,
  onClose,
  onApply,
  onClear,
  children,
  title = 'Refine results',
  subtitle = 'Adjust options below, then apply to update the list.',
  className,
}: FilterDrawerProps) {
  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="sm"
      className={className}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClear} className="mr-auto text-[#64748b]">
            Clear all
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" onClick={onApply}>
            Apply filters
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">{children}</div>
    </DrawerWrapper>
  )
}

export interface FilterFieldProps {
  label: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}

export function FilterField({ label, htmlFor, children, className }: FilterFieldProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <label className={FILTER_FIELD_LABEL} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}
