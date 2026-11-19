import * as React from 'react'
import { DrawerWrapper, Button, StatusBadge, SeverityBadge, Avatar } from '@hryantra/ui'
import { Task } from '../types'
import { FORMAT_DATE, capitalize } from './TaskCard'
import { useStore } from '@/store/StoreProvider'
import { Calendar, User, FolderKanban, Percent } from 'lucide-react'

interface TaskDetailDrawerProps {
  task: Task | null
  open: boolean
  onClose: () => void
  onEdit?: (task: Task) => void
}

const mapStatusToLabel = (s: string) => {
  if (s === 'todo') return 'Draft'
  if (s === 'in_progress') return 'In Progress'
  if (s === 'blocked') return 'Action Required'
  if (s === 'completed') return 'Resolved'
  return s
}

function DetailPanel({
  title,
  children,
  tone = 'white',
}: {
  title?: string
  children: React.ReactNode
  tone?: 'white' | 'blue' | 'lavender'
}) {
  const tones = {
    white: 'bg-white border-[#e2e8f0]',
    blue: 'bg-gradient-to-br from-[#eff6ff] via-white to-white border-[#bfdbfe]',
    lavender: 'bg-gradient-to-br from-[#f5f3ff] via-white to-white border-[#ddd6fe]',
  }
  return (
    <div className={['rounded-2xl border p-4 shadow-sm', tones[tone]].join(' ')}>
      {title ? <h3 className="mb-3 text-sm font-bold text-[#111827]">{title}</h3> : null}
      {children}
    </div>
  )
}

export function TaskDetailDrawer({ task, open, onClose, onEdit }: TaskDetailDrawerProps) {
  const { currentUserRole, activeEmployeeId, updateTask } = useStore()
  if (!task) return null

  const initials = task.assignee.name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .substring(0, 2)
  const isMyTask = task.assignee.id === activeEmployeeId
  const canSubmitForApproval =
    currentUserRole === 'Employee' && isMyTask && task.approvalStatus !== 'Pending Approval'
  const canUpdateProgress = currentUserRole !== 'Employee' || isMyTask

  const handleProgressUpdate = () => {
    if (task.status === 'todo') updateTask(task.id, { status: 'in_progress' })
    else if (task.status === 'in_progress') updateTask(task.id, { status: 'blocked' })
    else if (task.status === 'blocked') updateTask(task.id, { status: 'in_progress' })
  }

  const handleSubmitForApproval = () => {
    updateTask(task.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      approvalStatus: 'Pending Approval',
    })
    onClose()
  }

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title={task.title}
      subtitle={`Task ID: ${task.id} • Created ${FORMAT_DATE(task.createdAt)}`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="mr-auto">
            Close
          </Button>
          {onEdit && canUpdateProgress && (
            <Button variant="outline" onClick={() => onEdit(task)}>
              Edit Task
            </Button>
          )}
          {canUpdateProgress && (
            <Button variant="outline" onClick={handleProgressUpdate}>
              Update Status
            </Button>
          )}
          {canSubmitForApproval && (
            <Button variant="default" onClick={handleSubmitForApproval}>
              Submit for Approval
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <DetailPanel tone="blue">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={mapStatusToLabel(task.status)} />
            <SeverityBadge level={capitalize(task.priority)} />
            {task.approvalStatus ? <StatusBadge status={task.approvalStatus} /> : null}
            <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-[#64748b]">
              <Calendar className="size-4 text-[#6366f1]" />
              Due{' '}
              <strong className="text-[#111827]">{FORMAT_DATE(task.dueDate)}</strong>
            </span>
          </div>
        </DetailPanel>

        <DetailPanel title="Description">
          <p className="text-sm leading-relaxed text-[#475569]">
            {task.description || task.remarks || 'No description provided.'}
          </p>
        </DetailPanel>

        <DetailPanel title="Assignment & progress" tone="lavender">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                <FolderKanban className="size-3.5" /> Project
              </span>
              <span className="text-sm font-semibold text-[#111827]">
                {task.projectName || (task.isSelfTask ? 'Self Task' : 'None')}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                <Percent className="size-3.5" /> Work Done
              </span>
              <span className="text-sm font-semibold text-[#111827]">{task.workDonePercent ?? 0}%</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                <User className="size-3.5" /> Assignee
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <Avatar initials={initials} size="xs" gradient="indigo" />
                <span className="text-sm font-semibold text-[#111827]">
                  {task.assignees?.map((item) => item.name).join(', ') || task.assignee.name}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Project Head</span>
              <span className="text-sm font-medium text-[#111827]">{task.projectHeadName || '—'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Assigned By</span>
              <span className="text-sm font-medium text-[#111827]">{task.assignedBy || '—'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Scheduling</span>
              <span className="text-sm font-medium text-[#111827]">
                {task.scheduleType === 'specific_date' && task.scheduledDate
                  ? `Specific date: ${FORMAT_DATE(task.scheduledDate)}`
                  : task.scheduleType === 'day_of_week' && task.scheduledWeekday
                    ? `Every ${task.scheduledWeekday}`
                    : 'No scheduling'}
              </span>
            </div>
          </div>
        </DetailPanel>

        {(task.reminderDates?.length || task.reminderWeekdays?.length) ? (
          <DetailPanel title="Reminders">
            {task.reminderDates?.length ? (
              <p className="text-sm text-[#475569]">Dates: {task.reminderDates.join(', ')}</p>
            ) : null}
            {task.reminderWeekdays?.length ? (
              <p className="mt-1 text-sm text-[#475569]">Weekly: {task.reminderWeekdays.join(', ')}</p>
            ) : null}
          </DetailPanel>
        ) : null}

        {task.extraDescriptions && task.extraDescriptions.length > 0 && (
          <DetailPanel title="Additional notes">
            <div className="space-y-2">
              {task.extraDescriptions.map((entry, index) => (
                <p
                  key={`${entry.createdAt}-${index}`}
                  className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#475569]"
                >
                  {entry.text}
                </p>
              ))}
            </div>
          </DetailPanel>
        )}

        <DetailPanel title="Comments">
          <p className="text-sm italic text-[#94a3b8]">No comments yet.</p>
        </DetailPanel>
      </div>
    </DrawerWrapper>
  )
}
