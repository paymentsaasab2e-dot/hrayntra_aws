'use client';

import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

// --- Severity mapping utilities ---

export type SLASeverity = 'due_today' | 'overdue_1' | 'overdue_3_plus' | 'critical' | null;

/** Returns days overdue: negative = future, 0 = today, positive = overdue */
export function getDaysOverdue(dueDate: string, today?: string): number {
  if (!dueDate) return 0;
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const due = new Date(dueDate + 'T12:00:00');
  const ref = new Date(todayStr + 'T12:00:00');
  const diffMs = ref.getTime() - due.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/** Map due date (and optional status) to SLA severity for styling and copy */
export function getSLASeverity(
  dueDate: string,
  status?: string,
  today?: string
): SLASeverity {
  if (!dueDate) return null;
  const days = getDaysOverdue(dueDate, today);
  if (status === 'Completed') return null;
  if (days < 0) return null; // future
  if (days === 0) return 'due_today';
  if (days === 1) return 'overdue_1';
  if (days >= 5) return 'critical';
  if (days >= 3) return 'overdue_3_plus';
  return 'overdue_1'; // 2 days
}

const SEVERITY_STYLES: Record<NonNullable<SLASeverity>, string> = {
  due_today: 'bg-amber-100 text-amber-800 border-amber-200',
  overdue_1: 'bg-orange-100 text-orange-800 border-orange-200',
  overdue_3_plus: 'bg-red-100 text-red-700 border-red-200',
  critical: 'bg-red-600 text-white border-red-700',
};

const SEVERITY_LABELS: Record<NonNullable<SLASeverity>, string> = {
  due_today: 'Due today',
  overdue_1: 'Overdue',
  overdue_3_plus: 'Overdue',
  critical: 'Critical SLA breach',
};

// --- TaskSLAAlertBadge ---

export interface TaskSLAAlertBadgeProps {
  dueDate: string;
  status?: string;
  /** Optional reference date YYYY-MM-DD (default: today) */
  today?: string;
  /** Compact for table row, default for drawer header */
  variant?: 'row' | 'header';
  className?: string;
}

export function TaskSLAAlertBadge({
  dueDate,
  status,
  today,
  variant = 'row',
  className = '',
}: TaskSLAAlertBadgeProps) {
  const severity = getSLASeverity(dueDate, status, today);
  if (!severity) return null;

  const days = getDaysOverdue(dueDate, today);
  const label = days > 0 ? SEVERITY_LABELS[severity] : 'Due today';
  const subLabel = days > 0 ? `Delayed by ${days} day${days === 1 ? '' : 's'}` : null;
  const style = SEVERITY_STYLES[severity];

  if (variant === 'row') {
    return (
      <span
        className={`inline-flex flex-col items-start px-2.5 py-1 rounded-md text-[11px] font-bold border ${style} ${className}`}
        title={subLabel ?? label}
      >
        <span>{label}</span>
        {subLabel && <span className="font-medium opacity-90 text-[10px]">{subLabel}</span>}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${style} ${className}`}
      title={subLabel ?? label}
    >
      <AlertTriangle size={10} className="shrink-0" />
      {label}
      {subLabel && <span className="font-medium opacity-90">· {subLabel}</span>}
    </span>
  );
}

// --- TaskSLAAlertsPanel ---

export interface TaskSLAAlertItem {
  id: string;
  title: string;
  dueDate: string;
  status?: string;
}

export interface TaskSLAAlertsPanelProps {
  tasks: TaskSLAAlertItem[];
  onTaskClick?: (taskId: string) => void;
  /** Optional reference date YYYY-MM-DD */
  today?: string;
  className?: string;
  showAITip?: boolean;
}

export function TaskSLAAlertsPanel({
  tasks,
  onTaskClick,
  today,
  className = '',
  showAITip = true,
}: TaskSLAAlertsPanelProps) {
  const overdueTasks = tasks.filter((t) => getDaysOverdue(t.dueDate, today) > 0 && t.status !== 'Completed');
  const sorted = [...overdueTasks].sort((a, b) => getDaysOverdue(b.dueDate, today) - getDaysOverdue(a.dueDate, today));

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 border-l-4 border-l-red-500 shadow-sm overflow-hidden ${className}`}
    >
      <div className="p-4 border-b border-red-100 bg-red-50/40">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider">SLA Alerts</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {sorted.length} overdue task{sorted.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>
      <div className="p-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">No overdue tasks right now.</p>
        ) : (
        <ul className="space-y-2">
          {sorted.map((task) => {
            const days = getDaysOverdue(task.dueDate, today);
            const severity = getSLASeverity(task.dueDate, task.status, today);
            const style = severity ? SEVERITY_STYLES[severity] : '';

            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onTaskClick?.(task.id)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{task.title}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${style}`}>
                      {days} day{days === 1 ? '' : 's'} overdue
                    </span>
                  </div>
                  {showAITip && (
                    <p className="text-xs text-slate-500 mt-1.5">Recommended to prioritize this today.</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        )}
      </div>
    </div>
  );
}
