"use client"
import * as React from 'react'
import { PageHeroBanner, SectionCard, DataTable, Button, StatusBadge, type ColumnDef } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { AppNotification } from '@/modules/notifications/types'
import { CheckSquare, CalendarDays, Clock, Target, Info, Trash2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const ICON_MAP: Record<string, any> = {
  task: CheckSquare,
  leave: CalendarDays,
  attendance: Clock,
  performance: Target,
  system: Info
}

const COLOR_MAP: Record<string, string> = {
  task: 'text-blue-600 bg-blue-50 border-blue-100',
  leave: 'text-amber-600 bg-amber-50 border-amber-100',
  attendance: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  performance: 'text-purple-600 bg-purple-50 border-purple-100',
  system: 'text-ds-neutral-500 bg-ds-neutral-100 border-ds-neutral-200'
}

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead } = useStore()

  const columns: ColumnDef<AppNotification>[] = [
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      width: 120,
      cell: ({ row }) => {
        const IconComp = ICON_MAP[row.type] || Info
        return (
          <div className={`flex items-center gap-2 px-2 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wider w-fit ${COLOR_MAP[row.type]}`}>
            <IconComp className="size-3.5" />
            {row.type}
          </div>
        )
      }
    },
    {
      id: 'message',
      header: 'Message',
      cell: ({ row }) => (
        <div className="flex flex-col py-1">
          <span className={`text-ds-body-sm font-bold ${row.isRead ? 'text-ds-neutral-600' : 'text-ds-brand-navy'}`}>
            {row.title}
          </span>
          <span className="text-ds-caption text-ds-neutral-500 mt-0.5">{row.description}</span>
        </div>
      )
    },
    {
      id: 'date',
      accessorKey: 'createdAt',
      header: 'Date',
      width: 180,
      cell: ({ row }) => (
        <span className="text-ds-body-sm text-ds-neutral-500" suppressHydrationWarning>
          {new Date(row.createdAt).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      )
    },
    {
      id: 'status',
      header: 'Status',
      width: 100,
      cell: ({ row }) => (
        <StatusBadge status={row.isRead ? 'Verified' : 'Active'} />
      )
    },
    {
      id: 'actions',
      header: '',
      width: 150,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          {!row.isRead && (
            <Button variant="outline" size="xs" onClick={() => markAsRead(row.id)}>
              Mark Read
            </Button>
          )}
          {row.relatedPath && (
            <Link href={row.relatedPath}>
              <Button variant="ghost" size="xs">View</Button>
            </Link>
          )}
        </div>
      )
    }
  ]

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  return (
    <div className="flex flex-col h-full space-y-6 max-w-7xl mx-auto w-full p-6 overflow-y-auto">
      <PageHeroBanner
        compact
        eyebrow={dateEyebrow}
        title="Notifications"
        description="Stay updated with the latest events and alerts across your workspace."
        actions={
          <Button variant="outline" onClick={markAllAsRead}>
            <CheckCircle2 className="size-4" />
            Mark All as Read
          </Button>
        }
      />

      <SectionCard>
        <DataTable
          data={notifications}
          columns={columns}
          keyExtractor={(row) => row.id}
          emptyTitle="No notifications found"
          emptyDescription="You're all caught up! New alerts will appear here."
        />
      </SectionCard>
    </div>
  )
}
