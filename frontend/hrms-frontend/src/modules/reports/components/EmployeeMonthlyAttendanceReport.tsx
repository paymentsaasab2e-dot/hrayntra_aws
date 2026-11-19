"use client"

import * as React from 'react'
import { Employee } from '@/modules/employees/types'
import {
  MonthlyAttendanceSummary,
  MonthlyDayCell,
} from '../utils/monthlyAttendanceReport'

const thClass =
  'border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap sticky left-0 z-10 min-w-[120px]'
const tdClass = 'border border-slate-200 px-2 py-1.5 text-xs text-center whitespace-nowrap min-w-[52px]'

function SummaryChip({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: 'cyan' | 'indigo' | 'emerald' | 'rose' | 'amber'
}) {
  const accentClass =
    accent === 'cyan'
      ? 'border-cyan-200 bg-cyan-50/70 text-cyan-900'
      : accent === 'indigo'
      ? 'border-indigo-200 bg-indigo-50/70 text-indigo-900'
      : accent === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
      : accent === 'rose'
      ? 'border-rose-200 bg-rose-50/70 text-rose-900'
      : accent === 'amber'
      ? 'border-amber-200 bg-amber-50/70 text-amber-900'
      : 'border-slate-200 bg-slate-50 text-slate-900'

  return (
    <div className={`rounded-lg border px-3 py-2 text-center min-w-[110px] ${accentClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  )
}

function StatusBadge({ code }: { code: MonthlyDayCell['statusCode'] }) {
  if (code === 'A') {
    return (
      <span className="inline-flex min-w-[28px] justify-center rounded px-1.5 py-0.5 text-[11px] font-bold text-white bg-red-500 shadow-xs">
        A
      </span>
    )
  }
  if (code === 'WFH') {
    return (
      <span className="inline-flex min-w-[34px] justify-center rounded px-1.5 py-0.5 text-[11px] font-bold text-cyan-950 bg-cyan-100 border border-cyan-400 shadow-xs">
        WFH
      </span>
    )
  }
  if (code === 'OD') {
    return (
      <span className="inline-flex min-w-[28px] justify-center rounded px-1.5 py-0.5 text-[11px] font-bold text-indigo-950 bg-indigo-100 border border-indigo-400 shadow-xs">
        OD
      </span>
    )
  }
  if (code === 'WO') {
    return (
      <span className="inline-flex min-w-[28px] justify-center rounded px-1.5 py-0.5 text-[11px] font-bold text-sky-800 bg-sky-100 border border-sky-200">
        WO
      </span>
    )
  }
  if (code === 'L') {
    return (
      <span className="inline-flex min-w-[28px] justify-center rounded px-1.5 py-0.5 text-[11px] font-bold text-violet-800 bg-violet-100 border border-violet-200">
        L
      </span>
    )
  }
  if (code === 'P' || code === 'Lt' || code === 'HD') {
    return (
      <span className="inline-flex min-w-[28px] justify-center rounded px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200">
        {code === 'Lt' ? 'Lt' : code === 'HD' ? 'HD' : 'P'}
      </span>
    )
  }
  return <span className="text-slate-400">—</span>
}

type Props = {
  employee: Employee
  monthLabel: string
  days: MonthlyDayCell[]
  summary: MonthlyAttendanceSummary
}

function formatSummaryDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export function EmployeeMonthlyAttendanceReport({ employee, monthLabel, days, summary }: Props) {
  const rows: { label: string; getValue: (d: MonthlyDayCell) => React.ReactNode }[] = [
    { label: 'Day', getValue: (d) => d.day },
    {
      label: 'Date',
      getValue: (d) => {
        const [, , dd] = d.dateStr.split('-')
        const monthShort = new Date(`${d.dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })
        return `${dd}-${monthShort} ${d.weekday}`
      },
    },
    { label: 'Shift', getValue: (d) => d.shift },
    { label: 'In Time', getValue: (d) => d.inTime },
    { label: 'Out Time', getValue: (d) => d.outTime },
    { label: 'Late By', getValue: (d) => d.lateBy },
    { label: 'Early By', getValue: (d) => d.earlyBy },
    { label: 'Total OT', getValue: (d) => d.totalOt },
    { label: 'Duration', getValue: (d) => d.duration },
    { label: 'T Duration', getValue: (d) => d.duration },
    { label: 'Status', getValue: (d) => <StatusBadge code={d.statusCode} /> },
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="font-semibold text-slate-700">Employee Name:</span>{' '}
            <span className="text-slate-900 font-medium">{employee.name}</span>
          </span>
          <span>
            <span className="font-semibold text-slate-700">Employee Code:</span>{' '}
            <span className="text-slate-900 font-mono">{employee.id}</span>
          </span>
          <span>
            <span className="font-semibold text-slate-700">Department:</span>{' '}
            <span className="text-slate-900">{employee.department}</span>
          </span>
          <span>
            <span className="font-semibold text-slate-700">Month:</span>{' '}
            <span className="text-slate-900 font-semibold">{monthLabel}</span>
          </span>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="flex flex-wrap gap-2.5 p-4 border-b border-slate-200 bg-slate-50/40">
        <SummaryChip label="Total Present" value={summary.totalPresent} accent="emerald" />
        <SummaryChip label="Work From Home" value={summary.totalWfh} accent="cyan" />
        <SummaryChip label="On-Duty (OD)" value={summary.totalOd} accent="indigo" />
        <SummaryChip label="Total Absent" value={summary.totalAbsent} accent={summary.totalAbsent > 0 ? 'rose' : undefined} />
        <SummaryChip label="Leaves Taken" value={summary.totalLeave} accent={summary.totalLeave > 0 ? 'amber' : undefined} />
        <SummaryChip label="Weekly Offs" value={summary.totalWeeklyOff} />
        <SummaryChip label="Payable Days" value={summary.payableDays} accent="emerald" />
        <SummaryChip label="Total Duration" value={`${formatSummaryDuration(summary.totalDurationMinutes)} hrs`} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-max">
          <thead>
            <tr>
              <th className={thClass} />
              {days.map((d) => (
                <th
                  key={d.dateStr}
                  className={`border border-slate-200 px-2 py-2 text-[11px] font-bold min-w-[52px] ${
                    d.statusCode === 'WFH'
                      ? 'bg-cyan-50 text-cyan-900'
                      : d.statusCode === 'OD'
                      ? 'bg-indigo-50 text-indigo-900'
                      : d.statusCode === 'A'
                      ? 'bg-red-50 text-red-900'
                      : d.isWeekend
                      ? 'bg-sky-50 text-sky-800'
                      : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  Day {d.day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="hover:bg-slate-50/50">
                <td className={`${thClass} text-left`}>{row.label}</td>
                {days.map((d) => (
                  <td
                    key={`${row.label}-${d.dateStr}`}
                    className={`${tdClass} ${
                      d.statusCode === 'WFH' && row.label === 'Status'
                        ? 'bg-cyan-50/50'
                        : d.statusCode === 'OD' && row.label === 'Status'
                        ? 'bg-indigo-50/50'
                        : ''
                    }`}
                  >
                    {row.getValue(d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
