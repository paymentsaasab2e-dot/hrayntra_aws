"use client"

import * as React from "react"
import { cn } from "../utils"

// =============================================================================
// Table Primitives — low-level building blocks for custom tables
// Always prefer using <DataTable /> for data-driven views. Use these only
// for static or highly irregular table layouts.
// =============================================================================

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { variant?: 'card' | 'embedded' }
>(({ className, variant = 'embedded', ...props }, ref) => (
  <div
    className={cn(
      "relative w-full overflow-x-auto",
      variant === 'card' && "rounded-xl border border-slate-200/70 bg-white shadow-2xs",
      className
    )}
  >
    <table
      ref={ref}
      className="w-full caption-bottom text-sm"
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-slate-50/50 border-b border-slate-100 [&_tr]:border-b-0",
      className
    )}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-slate-100 transition-colors",
      "hover:bg-slate-50/60 data-[state=selected]:bg-indigo-50/50",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-3.5 sm:px-4 text-left align-middle font-semibold text-slate-400",
      "text-[11px] uppercase tracking-wider whitespace-nowrap",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-3.5 sm:px-4 py-3 sm:py-3.5 align-middle text-[13px] font-medium text-slate-700 whitespace-nowrap",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
