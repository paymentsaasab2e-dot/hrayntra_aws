"use client"

import * as React from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../atoms/Table'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { cn } from '../utils'

// =============================================================================
// DataTable Types
// =============================================================================

export type SortDirection = 'asc' | 'desc' | null

export interface ColumnDef<TData, TValue = unknown> {
  // 1. Column Identification
  /** Optional key of TData to automatically extract the value */
  accessorKey?: keyof TData
  /** Required if accessorKey is missing. Uniquely identifies the column. */
  id?: string

  // 2. Header Rendering
  header: React.ReactNode | ((props: { sortDirection: SortDirection }) => React.ReactNode)
  headerClassName?: string

  // 3. Cell Rendering
  /** Optional custom render function. If omitted, falls back to raw String(value). */
  cell?: (props: { row: TData; value: TValue }) => React.ReactNode
  className?: string

  // 4. Features
  sortable?: boolean
  width?: string | number
}

export interface DataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData, any>[]

  // Identifiers
  /** Function to extract a unique key for each row. Falls back to index if omitted, but strongly recommended to provide. */
  keyExtractor?: (row: TData) => string

  // Loading
  loading?: boolean
  /** Number of skeleton rows to show while loading */
  loadingRows?: number

  // Empty State Customization
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: React.ReactNode
  emptyAction?: React.ReactNode

  // Sorting
  sortColumn?: string
  sortDirection?: SortDirection
  onSort?: (columnId: string, direction: SortDirection) => void

  // Interactivity
  onRowClick?: (row: TData) => void
  rowClassName?: string | ((row: TData) => string)

  // Pagination Configuration
  pagination?: {
    page: number
    perPage: number
    total: number
    onPageChange: (page: number) => void
    onPerPageChange?: (perPage: number) => void
    perPageOptions?: readonly number[]
  }

  tableVariant?: 'card' | 'embedded'
  className?: string
}

// =============================================================================
// Internal Sub-components
// =============================================================================

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <TableRow className="animate-pulse hover:bg-transparent">
      {Array.from({ length: columns }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-full max-w-[70%] rounded-md bg-ds-neutral-200" />
        </TableCell>
      ))}
    </TableRow>
  )
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === 'asc') return <ArrowUp className="ml-1.5 size-3.5" />
  if (direction === 'desc') return <ArrowDown className="ml-1.5 size-3.5" />
  return <ArrowUpDown className="ml-1.5 size-3.5 text-ds-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" />
}

// =============================================================================
// DataTable Component
// =============================================================================

export function DataTable<TData>({
  data,
  columns,
  keyExtractor,
  loading = false,
  loadingRows = 5,
  emptyTitle = 'No results found',
  emptyDescription,
  emptyIcon,
  emptyAction,
  sortColumn,
  sortDirection = null,
  onSort,
  onRowClick,
  rowClassName,
  pagination,
  tableVariant = 'embedded',
  className,
}: DataTableProps<TData>) {
  
  const handleSort = (columnId: string) => {
    if (!onSort) return
    if (sortColumn === columnId) {
      if (sortDirection === 'asc') onSort(columnId, 'desc')
      else if (sortDirection === 'desc') onSort(columnId, null)
      else onSort(columnId, 'asc')
    } else {
      onSort(columnId, 'asc')
    }
  }

  const renderHeader = (col: ColumnDef<TData, any>) => {
    const colId = (col.accessorKey as string) ?? col.id
    if (!colId) throw new Error('DataTable Column requires either accessorKey or id')

    const isSorted = sortColumn === colId
    const currentDirection = isSorted ? sortDirection : null

    let content = typeof col.header === 'function' ? col.header({ sortDirection: currentDirection }) : col.header

    if (col.sortable) {
      return (
        <TableHead
          key={colId}
          style={{ width: col.width }}
          className={cn(
            'cursor-pointer select-none group hover:bg-ds-neutral-100 transition-colors',
            col.headerClassName
          )}
          onClick={() => handleSort(colId)}
        >
          <div className="flex items-center">
            {content}
            <SortIcon direction={currentDirection} />
          </div>
        </TableHead>
      )
    }

    return (
      <TableHead
        key={colId}
        style={{ width: col.width }}
        className={col.headerClassName}
      >
        {content}
      </TableHead>
    )
  }

  const renderCell = (row: TData, col: ColumnDef<TData, any>, rowIndex: number) => {
    const colId = (col.accessorKey as string) ?? col.id ?? String(rowIndex)
    
    // Extract raw value if accessorKey exists
    const rawValue = col.accessorKey ? row[col.accessorKey as keyof TData] : undefined

    let content
    if (col.cell) {
      content = col.cell({ row, value: rawValue })
    } else {
      content = rawValue != null ? String(rawValue) : '-'
    }

    return (
      <TableCell key={colId} className={col.className}>
        {content}
      </TableCell>
    )
  }

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      <Table variant={tableVariant}>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-t-0">
            {columns.map(renderHeader)}
          </TableRow>
        </TableHeader>
        
        <TableBody>
          {loading ? (
            Array.from({ length: loadingRows }).map((_, i) => (
              <SkeletonRow key={i} columns={columns.length} />
            ))
          ) : data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-32 p-0">
                <EmptyState
                  size="sm"
                  title={emptyTitle}
                  description={emptyDescription}
                  icon={emptyIcon}
                  action={emptyAction}
                />
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => {
              const rowKey = keyExtractor ? keyExtractor(row) : i
              const rowClasses = typeof rowClassName === 'function' ? rowClassName(row) : rowClassName
              return (
                <TableRow
                  key={rowKey}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    rowClasses
                  )}
                >
                  {columns.map((col) => renderCell(row, col, i))}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {/* Expose Pagination directly attached below the table */}
      {pagination && data.length > 0 && !loading && (
        <div className="rounded-b-lg overflow-hidden border border-t-0 border-ds-neutral-200 -mt-[17px]">
           <Pagination
             total={pagination.total}
             page={pagination.page}
             perPage={pagination.perPage}
             onPageChange={pagination.onPageChange}
             onPerPageChange={pagination.onPerPageChange}
             perPageOptions={pagination.perPageOptions}
             className="border-0 rounded-none shadow-none"
           />
        </div>
      )}
    </div>
  )
}
