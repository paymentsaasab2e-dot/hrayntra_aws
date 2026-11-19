import * as React from 'react'
import { DataTable, Avatar, StatusBadge, SeverityBadge, Button, type ColumnDef, type SortDirection } from '@hryantra/ui'
import { Eye, Pencil, Trash2, Send } from 'lucide-react'
import { Task } from '../types'
import { FORMAT_DATE, capitalize, getDeadlineBadge } from './TaskCard'
import { useStore } from '@/store/StoreProvider'

interface TaskListTableProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onEditTask?: (task: Task) => void
}

const mapStatusToLabel = (s: string) => {
  if (s === 'todo') return 'Draft'
  if (s === 'in_progress') return 'In Progress'
  if (s === 'blocked') return 'Action Required'
  if (s === 'completed') return 'Resolved'
  return s
}

export function TaskListTable({ tasks, onTaskClick, onEditTask }: TaskListTableProps) {
  const { currentUserRole, activeEmployeeId, updateTask, deleteTask } = useStore()
  const [sortColumn, setSortColumn] = React.useState<string | undefined>()
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)
  const [page, setPage] = React.useState(1)

  const sortedTasks = React.useMemo(() => {
    if (!sortDirection || !sortColumn) return tasks
    return [...tasks].sort((a, b) => {
      const aVal = String(a[sortColumn as keyof Task] || '')
      const bVal = String(b[sortColumn as keyof Task] || '')
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
  }, [tasks, sortColumn, sortDirection])

  const columns: ColumnDef<Task>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Task',
      sortable: true,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-ds-body-sm font-semibold truncate text-ds-brand-navy">{row.title}</span>
          {row.description && <span className="text-ds-caption text-ds-neutral-500 truncate max-w-[200px]">{row.description}</span>}
        </div>
      )
    },
    {
      id: 'assignee',
      accessorKey: 'assignee',
      header: 'Assignee',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar 
             initials={row.assignee.name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2)} 
             size="sm" 
             gradient="emerald" 
             aria-label={row.assignee.name}
          />
          <span className="text-ds-body-sm">{row.assignee.name}</span>
        </div>
      )
    },
    {
      id: 'projectName',
      accessorKey: 'projectName',
      header: 'Project',
      cell: ({ row }) => (
        <span className="text-ds-body-sm text-ds-neutral-600">
          {row.projectName || (row.isSelfTask ? 'Self Task' : '—')}
        </span>
      ),
    },
    {
      id: 'workDonePercent',
      accessorKey: 'workDonePercent',
      header: 'Progress',
      cell: ({ row }) => (
        <span className="text-ds-body-sm font-medium">{row.workDonePercent ?? 0}%</span>
      ),
    },
    {
      id: 'priority',
      accessorKey: 'priority',
      header: 'Priority',
      sortable: true,
      cell: ({ row }) => <SeverityBadge level={capitalize(row.priority)} uppercase={false} />
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={mapStatusToLabel(row.status)} />
    },
    {
      id: 'approvalStatus',
      accessorKey: 'approvalStatus',
      header: 'Approval',
      cell: ({ row }) => (
        <StatusBadge status={row.approvalStatus || 'Not Submitted'} />
      )
    },
    {
      id: 'dueDate',
      accessorKey: 'dueDate',
      header: 'Due Date',
      sortable: true,
      cell: ({ row }) => {
        const deadlineBadge = getDeadlineBadge(row.dueDate, row.status)
        return (
          <div className="flex items-center gap-2">
            <span className="text-ds-body-sm font-medium text-ds-neutral-600">{FORMAT_DATE(row.dueDate)}</span>
            {deadlineBadge && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${deadlineBadge.className}`}>
                {deadlineBadge.label}
              </span>
            )}
          </div>
        )
      }
    },
    {
      id: 'actions',
      header: '',
      width: 220,
      cell: ({ row }) => {
        const isEmployeeTask = row.assignee.id === activeEmployeeId
        const canSubmit =
          currentUserRole === 'Employee' &&
          isEmployeeTask &&
          row.approvalStatus !== 'Pending Approval' &&
          row.approvalStatus !== 'Approved'
        const canDelete = currentUserRole === 'HR' || currentUserRole === 'Manager' || currentUserRole === 'Superadmin'
        const canEdit = canDelete || isEmployeeTask

        return (
          <div className="flex justify-end pr-2 gap-1.5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              title="View Task"
              onClick={() => onTaskClick(row)}
            >
              <Eye className="size-4 text-ds-neutral-600" />
            </Button>

            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                title="Edit Task"
                onClick={() => (onEditTask || onTaskClick)(row)}
              >
                <Pencil className="size-4 text-ds-neutral-600" />
              </Button>
            )}

            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                title="Delete Task"
                onClick={() => {
                  if (window.confirm('Delete this task?')) {
                    deleteTask(row.id)
                  }
                }}
              >
                <Trash2 className="size-4 text-red-600" />
              </Button>
            )}

            {canSubmit && (
              <Button
                variant="ghost"
                size="icon"
                title="Submit for Approval"
                onClick={() => {
                  updateTask(row.id, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    approvalStatus: 'Pending Approval'
                  })
                }}
              >
                <Send className="size-4 text-ds-brand-green" />
              </Button>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <DataTable
      data={sortedTasks}
      columns={columns}
      keyExtractor={(t) => t.id}
      emptyTitle="No tasks found"
      emptyDescription="Create a new task to get started."
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      onSort={(col, dir) => { setSortColumn(col); setSortDirection(dir) }}
      onRowClick={(row) => onTaskClick(row)}
      pagination={{
        page,
        perPage: 10,
        total: tasks.length,
        onPageChange: setPage
      }}
    />
  )
}
