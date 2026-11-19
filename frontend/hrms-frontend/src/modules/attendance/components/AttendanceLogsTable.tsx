"use client"
import * as React from 'react'
import { DataTable, StatusBadge, type ColumnDef } from '@hryantra/ui'
import { AttendanceRecord } from '../types'
import { useStore } from '@/store/StoreProvider'

interface AttendanceLogsTableProps {
  records: AttendanceRecord[]
  showEmployee?: boolean
}

export function AttendanceLogsTable({ records, showEmployee = false }: AttendanceLogsTableProps) {
  const { employees } = useStore()
  const [page, setPage] = React.useState(1)
  const hasApprovalData = records.some(record => record.approvalStatus || record.approvalRemark)

  const columns: ColumnDef<AttendanceRecord>[] = [
    ...(showEmployee ? [{
      id: 'employeeId',
      accessorKey: 'employeeId',
      header: 'Employee',
      sortable: true,
      cell: ({ row }: { row: AttendanceRecord }) => {
        const employee = employees.find(item => item.id === row.employeeId)
        return (
          <div className="flex flex-col">
            <span className="text-ds-body-sm font-semibold text-ds-brand-navy">{employee?.name || row.employeeId}</span>
            <span className="text-ds-caption text-ds-neutral-500">{row.employeeId}</span>
          </div>
        )
      }
    } as ColumnDef<AttendanceRecord>] : []),
    {
      id: 'date',
      accessorKey: 'date',
      header: 'Date',
      sortable: true,
      cell: ({ row }) => <span className="text-ds-body font-medium">{new Date(row.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
    },
    {
      id: 'checkIn',
      accessorKey: 'checkIn',
      header: 'Check In',
      cell: ({ row }) => <span className="text-ds-body-sm text-ds-neutral-600">{row.checkIn ? new Date(row.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
    },
    {
      id: 'checkOut',
      accessorKey: 'checkOut',
      header: 'Check Out',
      cell: ({ row }) => <span className="text-ds-body-sm text-ds-neutral-600">{row.checkOut ? new Date(row.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.status} />
    },
    {
      id: 'mode',
      accessorKey: 'mode',
      header: 'Mode',
      cell: ({ row }) => <span className="text-ds-body-sm capitalize text-ds-neutral-500">{row.mode}</span>
    },
    ...(hasApprovalData ? [
      {
        id: 'approvalStatus',
        accessorKey: 'approvalStatus',
        header: 'Approval',
        cell: ({ row }: { row: AttendanceRecord }) => (
          row.approvalStatus ? <StatusBadge status={row.approvalStatus} /> : <span className="text-ds-caption text-ds-neutral-400">Not needed</span>
        )
      } as ColumnDef<AttendanceRecord>,
      {
        id: 'approvalRemark',
        accessorKey: 'approvalRemark',
        header: 'Remark',
        cell: ({ row }: { row: AttendanceRecord }) => (
          <span className="text-ds-body-sm text-ds-neutral-500">
            {row.approvalRemark || '—'}
          </span>
        )
      } as ColumnDef<AttendanceRecord>
    ] : [])
  ]

  // Default sorting to newest first
  const sortedRecords = React.useMemo(() => {
    const seen = new Set<string>()
    return records
      .filter(record => {
        if (seen.has(record.id)) return false
        seen.add(record.id)
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [records])

  return (
    <DataTable
      data={sortedRecords}
      columns={columns}
      keyExtractor={(r) => r.id}
      emptyTitle="No attendance records"
      pagination={{
        page,
        perPage: 10,
        total: records.length,
        onPageChange: setPage
      }}
    />
  )
}
