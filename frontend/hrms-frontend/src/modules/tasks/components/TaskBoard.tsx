import * as React from 'react'
import { Task, TaskStatus } from '../types'
import { TaskCard } from './TaskCard'

interface TaskBoardProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

const COLUMNS: { id: TaskStatus; label: string; bgClass: string }[] = [
  { id: 'todo', label: 'To Do', bgClass: 'bg-ds-neutral-100' },
  { id: 'in_progress', label: 'In Progress', bgClass: 'bg-ds-info-light' },
  { id: 'blocked', label: 'Blocked', bgClass: 'bg-ds-danger-light' },
  { id: 'completed', label: 'Completed', bgClass: 'bg-ds-success-light' },
]

export function TaskBoard({ tasks, onTaskClick }: TaskBoardProps) {
  return (
    <div className="flex gap-6 overflow-x-auto h-full items-start pb-4">
      {COLUMNS.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.id)
        
        return (
          <div key={col.id} className={`flex flex-col w-[300px] shrink-0 rounded-lg p-3 ${col.bgClass} border border-ds-neutral-200/50`}>
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-ds-label font-bold text-ds-brand-navy uppercase tracking-wide">
                {col.label}
              </h3>
              <span className="text-ds-caption font-bold bg-white px-2 py-0.5 rounded-full text-ds-neutral-500 border border-ds-neutral-200">
                {columnTasks.length}
              </span>
            </div>
            
            {/* Column Tasks */}
            <div className="flex flex-col gap-3 min-h-[100px]">
              {columnTasks.map(task => (
                <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
              ))}
              {columnTasks.length === 0 && (
                <div className="h-20 w-full border-2 border-dashed border-ds-neutral-300 rounded flex items-center justify-center bg-white/50">
                  <span className="text-ds-caption text-ds-neutral-400">Empty</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
