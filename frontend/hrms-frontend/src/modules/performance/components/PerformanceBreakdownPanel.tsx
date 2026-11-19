import * as React from 'react'
import { PerformanceBreakdown, PerformanceMetrics } from '../types'

interface PerformanceBreakdownPanelProps {
  metrics: PerformanceMetrics
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-ds-body-sm py-1">
      <span className="text-ds-neutral-500">{label}</span>
      <span className="font-semibold text-ds-brand-navy">{value}</span>
    </div>
  )
}

export function PerformanceBreakdownPanel({ metrics }: PerformanceBreakdownPanelProps) {
  const breakdown = metrics.breakdown
  if (!breakdown) {
    return (
      <div className="text-ds-body-sm text-ds-neutral-500 py-4">
        Breakdown data is not available for this review yet. Refresh the review to compute detailed metrics.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-ds-neutral-200 p-3">
          <div className="text-ds-caption text-ds-neutral-500">Task Score</div>
          <div className="text-2xl font-bold text-ds-brand-navy">{metrics.taskScore}</div>
        </div>
        <div className="rounded-lg border border-ds-neutral-200 p-3">
          <div className="text-ds-caption text-ds-neutral-500">Attendance</div>
          <div className="text-2xl font-bold text-ds-brand-navy">{metrics.attendanceScore}</div>
        </div>
        <div className="rounded-lg border border-ds-neutral-200 p-3">
          <div className="text-ds-caption text-ds-neutral-500">Leave</div>
          <div className="text-2xl font-bold text-ds-brand-navy">{metrics.leaveScore}</div>
        </div>
        <div className="rounded-lg border border-ds-neutral-200 p-3">
          <div className="text-ds-caption text-ds-neutral-500">Provisional</div>
          <div className="text-2xl font-bold text-ds-brand-green">{breakdown.provisionalScore}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BreakdownSection title="Tasks" rows={[
          ['Assigned', breakdown.task.assigned],
          ['Completed', breakdown.task.completed],
          ['On-time rate', `${breakdown.task.onTimeRate}%`],
          ['Completion rate', `${breakdown.task.completionRate}%`],
          ['Overdue open', breakdown.task.overdueOpen],
          ['Avg cycle (days)', breakdown.task.avgCycleTimeDays],
        ]} />
        <BreakdownSection title="Attendance" rows={[
          ['Working days', breakdown.attendance.workingDays],
          ['Present days', breakdown.attendance.presentDays],
          ['Late days', breakdown.attendance.lateDays],
          ['Attendance rate', `${breakdown.attendance.attendanceRate}%`],
          ['Punctuality', `${breakdown.attendance.punctualityRate}%`],
        ]} />
        <BreakdownSection title="Leave" rows={[
          ['Requests', breakdown.leave.totalRequests],
          ['Approved days', breakdown.leave.approvedDays],
          ['Rejected', breakdown.leave.rejectedCount],
          ['Unplanned sick', breakdown.leave.unplannedSickDays],
          ['Planning score', `${breakdown.leave.planningScore}%`],
        ]} />
      </div>

      <div className="text-ds-caption text-ds-neutral-500">
        Cycle window: {new Date(breakdown.cycleWindow.start).toLocaleDateString()} – {new Date(breakdown.cycleWindow.end).toLocaleDateString()}
        {' · '}
        Weights: Task {breakdown.weights.task * 100}% · Attendance {breakdown.weights.attendance * 100}% · Leave {breakdown.weights.leave * 100}% · Manager {breakdown.weights.manager * 100}%
      </div>
    </div>
  )
}

function BreakdownSection({
  title,
  rows,
}: {
  title: string
  rows: [string, string | number][]
}) {
  return (
    <div className="border border-ds-neutral-200 rounded-lg p-4">
      <h4 className="text-ds-label font-semibold text-ds-brand-navy mb-3">{title}</h4>
      <div className="divide-y divide-ds-neutral-100">
        {rows.map(([label, value]) => (
          <StatRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  )
}
