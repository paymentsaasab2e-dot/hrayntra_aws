"use client"

import * as React from 'react'
import { api } from '@/shared/api'
import { Button } from '@hryantra/ui'
import { Download, RefreshCw, Filter, Home, Briefcase, Calendar } from 'lucide-react'

type MusterCell = {
  dateStr: string
  statusCode: string
  label: string
  isWorked: boolean
}

type MusterRow = {
  id: string
  employeeId: string
  name: string
  department: string
  designation: string
  cells: MusterCell[]
  summary: {
    totalDaysInMonth: number
    totalPresent: number
    totalWfh: number
    totalOd: number
    totalLeaves: number
    totalWeeklyOffs: number
    totalHolidays: number
    totalAbsent: number
    payableDays: number
  }
}

type MusterData = {
  year: number
  month: number
  monthLabel: string
  daysInMonth: number
  daysHeader: {
    day: number
    dateStr: string
    dayName: string
    isSunday: boolean
    isSaturday: boolean
    isHoliday: boolean
    holidayName: string | null
  }[]
  rows: MusterRow[]
}

interface TeamAttendanceMusterRollProps {
  reportMonth: string
  departmentFilter?: string
}

export function TeamAttendanceMusterRoll({ reportMonth, departmentFilter }: TeamAttendanceMusterRollProps) {
  const [data, setData] = React.useState<MusterData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedDept, setSelectedDept] = React.useState<string>(departmentFilter || 'ALL')

  const [y, m] = reportMonth.split('-').map(Number)

  const loadMuster = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.attendance.getMusterRoll({
        year: y,
        month: m,
        department: selectedDept !== 'ALL' ? selectedDept : undefined,
      })
      if (res?.data) {
        setData(res.data)
      } else {
        setData(null)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load muster roll register')
    } finally {
      setLoading(false)
    }
  }, [y, m, selectedDept])

  React.useEffect(() => {
    loadMuster()
  }, [loadMuster])

  const exportCsv = () => {
    if (!data) return
    const headers = [
      'Emp Code',
      'Name',
      'Department',
      ...data.daysHeader.map((d) => `Day ${d.day} (${d.dayName})`),
      'Present',
      'WFH',
      'On-Duty',
      'Leaves',
      'Weekly Offs',
      'Holidays',
      'Absent',
      'Payable Days',
    ]

    const csvRows = [headers.join(',')]
    data.rows.forEach((r) => {
      const row = [
        `"${r.employeeId}"`,
        `"${r.name}"`,
        `"${r.department}"`,
        ...r.cells.map((c) => `"${c.statusCode}"`),
        r.summary.totalPresent,
        r.summary.totalWfh,
        r.summary.totalOd,
        r.summary.totalLeaves,
        r.summary.totalWeeklyOffs,
        r.summary.totalHolidays,
        r.summary.totalAbsent,
        r.summary.payableDays,
      ]
      csvRows.push(row.join(','))
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Muster_Roll_${data.year}_${String(data.month).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Extract unique departments
  const departments = React.useMemo(() => {
    if (!data?.rows) return []
    return ['ALL', ...new Set(data.rows.map((r) => r.department).filter(Boolean))]
  }, [data])

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Monthly Attendance Register (Muster Roll / Form T)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Statutory monthly muster register. Approved WFH & OD count as worked present days.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {departments.length > 1 && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === 'ALL' ? 'All Departments' : d}
                </option>
              ))}
            </select>
          )}

          <Button variant="outline" size="sm" onClick={loadMuster} disabled={loading}>
            <RefreshCw className={`size-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="default" size="sm" onClick={exportCsv} disabled={!data || loading}>
            <Download className="size-3.5 mr-1" />
            Export Form T CSV
          </Button>
        </div>
      </div>

      {/* Color Code Legend */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs">
        <span className="font-semibold text-slate-600 mr-1">Status Legend:</span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
          P = Present
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-900 font-bold border border-cyan-400">
          <Home className="size-3" />
          WFH = Work From Home (Approved)
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold border border-indigo-400">
          <Briefcase className="size-3" />
          OD = On-Duty (Approved)
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 font-bold border border-violet-200">
          L = Leave
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold border border-sky-200">
          WO = Weekly Off
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
          H = Holiday
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500 text-white font-bold">
          A = Absent
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
          <RefreshCw className="size-5 animate-spin mr-2 text-slate-400" />
          Generating muster roll matrix...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-rose-600 text-sm">{error}</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm">No employee attendance records found for this period.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-max text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="sticky left-0 z-20 bg-slate-100 border border-slate-200 px-3 py-2 text-left font-bold min-w-[150px] shadow-sm">
                  Employee
                </th>
                <th className="sticky left-[150px] z-20 bg-slate-100 border border-slate-200 px-2 py-2 text-left font-bold min-w-[90px] shadow-sm">
                  Code
                </th>
                {data.daysHeader.map((d) => (
                  <th
                    key={d.day}
                    className={`border border-slate-200 px-1 py-1.5 text-center font-bold min-w-[34px] ${
                      d.isSunday || d.isSaturday ? 'bg-sky-50 text-sky-900' : d.isHoliday ? 'bg-amber-50 text-amber-900' : ''
                    }`}
                    title={d.holidayName || `${d.dateStr} (${d.dayName})`}
                  >
                    <div>{d.day}</div>
                    <div className="text-[9px] font-normal opacity-75">{d.dayName}</div>
                  </th>
                ))}
                <th className="border border-slate-200 bg-emerald-50 text-emerald-900 px-2 py-2 text-center font-bold min-w-[45px]">
                  P
                </th>
                <th className="border border-slate-200 bg-cyan-50 text-cyan-900 px-2 py-2 text-center font-bold min-w-[45px]">
                  WFH
                </th>
                <th className="border border-slate-200 bg-indigo-50 text-indigo-900 px-2 py-2 text-center font-bold min-w-[45px]">
                  OD
                </th>
                <th className="border border-slate-200 bg-violet-50 text-violet-900 px-2 py-2 text-center font-bold min-w-[45px]">
                  L
                </th>
                <th className="border border-slate-200 bg-sky-50 text-sky-900 px-2 py-2 text-center font-bold min-w-[45px]">
                  WO
                </th>
                <th className="border border-slate-200 bg-amber-50 text-amber-900 px-2 py-2 text-center font-bold min-w-[45px]">
                  H
                </th>
                <th className="border border-slate-200 bg-red-50 text-red-900 px-2 py-2 text-center font-bold min-w-[45px]">
                  A
                </th>
                <th className="border border-slate-200 bg-emerald-100 text-emerald-950 px-2 py-2 text-center font-bold min-w-[55px]">
                  Payable
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="sticky left-0 z-10 bg-white border border-slate-200 px-3 py-1.5 font-semibold text-slate-900 shadow-sm whitespace-nowrap">
                    <div>{row.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{row.department}</div>
                  </td>
                  <td className="sticky left-[150px] z-10 bg-white border border-slate-200 px-2 py-1.5 font-mono text-[11px] text-slate-600 shadow-sm whitespace-nowrap">
                    {row.employeeId}
                  </td>
                  {row.cells.map((cell) => {
                    const code = cell.statusCode
                    return (
                      <td
                        key={cell.dateStr}
                        className={`border border-slate-200 px-1 py-1 text-center font-bold text-[11px] ${
                          code === 'WFH'
                            ? 'bg-cyan-50/60'
                            : code === 'OD'
                            ? 'bg-indigo-50/60'
                            : code === 'A'
                            ? 'bg-red-50/40'
                            : ''
                        }`}
                        title={`${cell.dateStr}: ${cell.label}`}
                      >
                        {code === 'P' ? (
                          <span className="inline-flex min-w-[24px] justify-center rounded px-1 py-0.5 text-emerald-800 bg-emerald-100">
                            P
                          </span>
                        ) : code === 'WFH' ? (
                          <span className="inline-flex min-w-[28px] justify-center rounded px-1 py-0.5 text-cyan-950 bg-cyan-200 border border-cyan-400">
                            WFH
                          </span>
                        ) : code === 'OD' ? (
                          <span className="inline-flex min-w-[24px] justify-center rounded px-1 py-0.5 text-indigo-950 bg-indigo-200 border border-indigo-400">
                            OD
                          </span>
                        ) : code === 'L' ? (
                          <span className="inline-flex min-w-[24px] justify-center rounded px-1 py-0.5 text-violet-800 bg-violet-100">
                            L
                          </span>
                        ) : code === 'WO' ? (
                          <span className="inline-flex min-w-[24px] justify-center rounded px-1 py-0.5 text-sky-800 bg-sky-100">
                            WO
                          </span>
                        ) : code === 'H' ? (
                          <span className="inline-flex min-w-[24px] justify-center rounded px-1 py-0.5 text-amber-800 bg-amber-100">
                            H
                          </span>
                        ) : code === 'A' ? (
                          <span className="inline-flex min-w-[24px] justify-center rounded px-1 py-0.5 text-white bg-red-500">
                            A
                          </span>
                        ) : code === 'HD' ? (
                          <span className="inline-flex min-w-[24px] justify-center rounded px-1 py-0.5 text-orange-800 bg-orange-100">
                            HD
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">-</span>
                        )}
                      </td>
                    )
                  })}
                  {/* Summary Totals */}
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-emerald-800 bg-emerald-50/40">
                    {row.summary.totalPresent}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-cyan-800 bg-cyan-50/50">
                    {row.summary.totalWfh}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-indigo-800 bg-indigo-50/50">
                    {row.summary.totalOd}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-violet-800 bg-violet-50/40">
                    {row.summary.totalLeaves}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-sky-800 bg-sky-50/40">
                    {row.summary.totalWeeklyOffs}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-amber-800 bg-amber-50/40">
                    {row.summary.totalHolidays}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-red-600 bg-red-50/40">
                    {row.summary.totalAbsent}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-extrabold text-emerald-950 bg-emerald-100/60">
                    {row.summary.payableDays}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
