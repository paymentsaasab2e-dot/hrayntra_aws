import * as React from 'react'
import { SeverityBadge, Avatar } from '@hryantra/ui'
import { Task, TaskPriority } from '../types'

export const FORMAT_DATE = (dateStr: string) => {
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return dateStr
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export function capitalize(str: string) {
  if (str === 'less_urgent') return 'Less Urgent'
  return str.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export const getDeadlineBadge = (dueDate: string, status: Task['status']) => {
  if (!dueDate || status === 'completed') return null
  const dueTime = new Date(dueDate).getTime()
  if (Number.isNaN(dueTime)) return null

  const now = Date.now()
  const remainingMs = dueTime - now
  if (remainingMs <= 0) return { label: 'Escalated', className: 'bg-red-100 text-red-700 border-red-200' }
  if (remainingMs <= 24 * 60 * 60 * 1000) return { label: 'Approaching', className: 'bg-amber-100 text-amber-700 border-amber-200' }
  return null
}

export function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const initials = task.assignee.name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2)
  const deadlineBadge = getDeadlineBadge(task.dueDate, task.status)
  return (
    <div 
      onClick={onClick}
      className="p-3 bg-white border border-ds-neutral-200 rounded shadow-sm cursor-pointer hover:border-ds-neutral-300 hover:shadow-md transition-all flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-ds-body-sm font-semibold text-ds-brand-navy leading-tight line-clamp-2">
          {task.title}
        </h4>
        <SeverityBadge level={capitalize(task.priority)} uppercase={false} className="shrink-0" />
      </div>
      
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <span className="text-ds-caption text-ds-neutral-500 font-medium">{FORMAT_DATE(task.dueDate)}</span>
          {deadlineBadge && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${deadlineBadge.className}`}>
              {deadlineBadge.label}
            </span>
          )}
        </div>
        <Avatar initials={initials} size="sm" gradient="navy" aria-label={task.assignee.name} />
      </div>
    </div>
  )
}
