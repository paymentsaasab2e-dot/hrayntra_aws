"use client"
import * as React from 'react'
import { DataTable, StatusBadge, type ColumnDef } from '@hryantra/ui'
import { LeaveRequest } from '../types'

interface LeaveHistoryTableProps {
  requests: LeaveRequest[]
}

const getStatusColor = (s: string) => {
  if (s === 'Pending') return 'Pending'
  if (s === 'Approved') return 'Present'
  if (s === 'Rejected') return 'Absent'
  return 'Pending'
}

export function LeaveHistoryTable({ requests }: LeaveHistoryTableProps) {
  const [page, setPage] = React.useState(1)

  const columns: ColumnDef<LeaveRequest>[] = [
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      sortable: true,
      cell: ({ row }) => <span className="text-ds-body font-medium text-ds-brand-navy">{row.type}</span>
    },
    {
      id: 'duration',
      accessorKey: 'startDate',
      header: 'Duration',
      cell: ({ row }) => {
        const start = new Date(row.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const end = new Date(row.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        return (
          <div className="flex flex-col">
            <span className="text-ds-body-sm text-ds-neutral-600 font-medium">{start} - {end}</span>
            <span className="text-ds-caption text-ds-neutral-500 mt-0.5">{row.totalDays} Day{row.totalDays > 1 ? 's' : ''}</span>
          </div>
        )
      }
    },
    {
      id: 'reason',
      accessorKey: 'reason',
      header: 'Details',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-ds-body-sm text-ds-neutral-800 line-clamp-1">{row.reason}</span>
          {row.remarks && <span className="text-ds-caption text-ds-neutral-500 line-clamp-1 italic mt-0.5">Note: {row.remarks}</span>}
        </div>
      )
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      sortable: true,
      cell: ({ row }) => <StatusBadge status={row.status} />
    }
  ]

  const sortedRequests = React.useMemo(() => {
    return [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [requests])

  return (
    <DataTable
      data={sortedRequests}
      columns={columns}
      keyExtractor={(r) => r.id}
      emptyTitle="No leave history"
      emptyDescription="Your past and current leave requests will appear here."
      pagination={{
        page,
        perPage: 10,
        total: requests.length,
        onPageChange: setPage
      }}
    />
  )
}
