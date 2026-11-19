import * as React from 'react'
import { SectionCard, DataTable, StatusBadge, SeverityBadge, type ColumnDef } from '@hryantra/ui'
import { Task } from '../../tasks/types'
import { useStore } from '@/store/StoreProvider'

interface EmployeeTasksTabProps {
  employeeId: string
}

export function EmployeeTasksTab({ employeeId }: EmployeeTasksTabProps) {
  const { tasks } = useStore()
  
  // Filter global tasks for this exact employee
  const employeeTasks = React.useMemo(() => {
    return tasks.filter(t => t.assignee.id === employeeId)
  }, [tasks, employeeId])

  const columns: ColumnDef<Task>[] = [
    { id: 'title', accessorKey: 'title', header: 'Task Title', className: 'text-ds-body font-medium' },
    { 
      id: 'status', 
      accessorKey: 'status', 
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.status} />
    },
    { 
      id: 'priority', 
      accessorKey: 'priority', 
      header: 'Priority',
      cell: ({ row }) => <SeverityBadge level={row.priority} />
    },
    { id: 'dueDate', accessorKey: 'dueDate', header: 'Due Date', className: 'text-ds-body-sm text-muted-foreground' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <SectionCard title="Assigned Tasks">
        <DataTable
          data={employeeTasks}
          columns={columns}
          keyExtractor={(row) => row.id}
          emptyTitle="No tasks assigned"
          emptyDescription="This employee currently has no active tasks."
        />
      </SectionCard>
    </div>
  )
}
