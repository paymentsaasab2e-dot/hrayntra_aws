"use client"

import * as React from 'react'
import { Button, Input, SegmentedControl } from '@hryantra/ui'
import { Download, Search, Upload, User } from 'lucide-react'
import { AttendanceRecord } from '../types'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import {
  formatDisplayDate,
  formatDuration,
  formatPunchTime,
  formatShift,
  isInDateRange,
  rowStatusLabel,
} from '../utils/attendanceFormat'

type RangeFilter = 'all' | 'today' | 'week' | 'month'

type AttendanceLogsDashboardProps = {
  records: AttendanceRecord[]
  showEmployeeColumn?: boolean
  title?: string
  description?: string
  showExport?: boolean
}

function PhotoCell({ url, label }: { url?: string | null; label: string }) {
  if (!url) {
    return (
      <span className="text-ds-caption text-ds-neutral-400" title={`${label} photo not uploaded`}>
        —
      </span>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-ds-caption font-semibold text-indigo-600 hover:underline">
      View
    </a>
  )
}

function StatusPill({ record }: { record: AttendanceRecord }) {
  const label = rowStatusLabel(record)
  if (label === 'Accepted' || label === 'Present' || label === 'Active') {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{label}</span>
  }
  if (label === 'Rejected') {
    return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">{label}</span>
  }
  if (label === 'Pending' || label === 'Late') {
    return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{label}</span>
  }
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{label}</span>
}

function PunchModeBadge({ mode }: { mode?: string }) {
  const m = (mode || 'WEB').toUpperCase()
  if (m === 'WEB') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-[11px] font-bold border border-purple-200">
        💻 WEB
      </span>
    )
  }
  if (m === 'REMOTE' || m === 'WFH') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 text-cyan-800 px-2 py-0.5 text-[11px] font-bold border border-cyan-200">
        🏠 WFH
      </span>
    )
  }
  if (m === 'BIOMETRIC') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 text-[11px] font-bold border border-slate-200">
        👆 BIO
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[11px] font-bold border border-indigo-200">
      📍 GPS
    </span>
  )
}

const thClass = 'px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap'
const tdClass = 'px-4 py-3 text-sm whitespace-nowrap'

export function AttendanceLogsDashboard({
  records,
  showEmployeeColumn = true,
  title = 'Attendance Logs',
  description = 'Monitor real-time punch-in / punch-out activity and verify staff locations.',
  showExport = true,
}: AttendanceLogsDashboardProps) {
  const { employees } = useStore()
  const [employeeSearch, setEmployeeSearch] = React.useState('')
  const [locationFilter, setLocationFilter] = React.useState('all')
  const [customDate, setCustomDate] = React.useState('')
  const [rangeFilter, setRangeFilter] = React.useState<RangeFilter>('today')
  const [locations, setLocations] = React.useState<{ id: string; name: string }[]>([])

  React.useEffect(() => {
    api.locations.getAll(true)
      .then((res) => {
        const rows = Array.isArray(res?.data) ? res.data : []
        setLocations(rows.map((loc: any) => ({ id: loc.id, name: loc.name })))
      })
      .catch(() => setLocations([]))
  }, [])

  const employeeNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    employees.forEach((emp) => map.set(emp.id, emp.name))
    return map
  }, [employees])

  const filteredRecords = React.useMemo(() => {
    const search = employeeSearch.trim().toLowerCase()

    return [...records]
      .filter((record) => {
        if (!isInDateRange(record.date, rangeFilter, customDate || undefined)) return false

        const locationName = record.hospitalName || '—'
        if (locationFilter !== 'all' && locationName !== locationFilter) return false

        if (!search) return true
        const name = (employeeNameById.get(record.employeeId) || record.employeeId).toLowerCase()
        return name.includes(search) || record.employeeId.toLowerCase().includes(search)
      })
      .sort((a, b) => {
        const aTime = new Date(a.checkIn || a.date).getTime()
        const bTime = new Date(b.checkIn || b.date).getTime()
        return bTime - aTime
      })
  }, [records, employeeSearch, locationFilter, customDate, rangeFilter, employeeNameById])

  const locationOptions = React.useMemo(() => {
    const names = new Set<string>()
    locations.forEach((loc) => names.add(loc.name))
    records.forEach((r) => {
      if (r.hospitalName) names.add(r.hospitalName)
    })
    return Array.from(names).sort()
  }, [locations, records])

  const handleExport = () => {
    const headers = [
      'Employee',
      'Employee ID',
      'Location',
      'Date',
      'Shift',
      'Punch In',
      'Punch Out',
      'Duration',
      'Status',
    ]
    const rows = filteredRecords.map((record) => [
      employeeNameById.get(record.employeeId) || record.employeeId,
      record.employeeId,
      record.hospitalName || '—',
      record.date,
      formatShift(record.checkIn),
      formatPunchTime(record.checkIn),
      formatPunchTime(record.checkOut),
      formatDuration(record.checkIn, record.checkOut, record.isActive),
      rowStatusLabel(record),
    ])

    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-logs-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const rangeButtons: { id: RangeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
  ]

  const colSpan = showEmployeeColumn ? 12 : 10

  return (
    <div className="flex flex-col gap-5">
      {(title || description) && (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h2 className="text-xl font-bold text-ds-brand-navy">{title}</h2> : null}
            {description ? <p className="text-ds-body-sm text-ds-neutral-500 mt-1">{description}</p> : null}
          </div>
          {showExport && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="size-4 mr-1.5" />
                Export Report
              </Button>
              <Button variant="outline" size="sm" disabled title="Import available in a future release">
                <Upload className="size-4 mr-1.5" />
                Import
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Compact filter bar — matches reference layout */}
      <div className="rounded-xl border border-ds-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ds-neutral-400 pointer-events-none" />
            <Input
              className="pl-9 h-10"
              placeholder="Search name..."
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
          </div>

          <select
            className="h-10 min-w-[160px] px-3 rounded-lg border border-ds-neutral-200 bg-white text-sm text-ds-brand-navy"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            aria-label="Filter by location"
          >
            <option value="all">All Locations</option>
            {locationOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <Input
            type="date"
            className="h-10 min-w-[150px]"
            value={customDate}
            onChange={(e) => {
              setCustomDate(e.target.value)
              if (e.target.value) setRangeFilter('all')
            }}
            aria-label="Custom date"
          />

          <SegmentedControl
            aria-label="Date range"
            size="sm"
            value={rangeFilter}
            onChange={(v) => {
              setRangeFilter(v as RangeFilter)
              if (v !== 'all') setCustomDate('')
            }}
            options={rangeButtons.map((btn) => ({ value: btn.id, label: btn.label }))}
          />
        </div>
      </div>

      {/* Unified attendance table */}
      <div className="rounded-xl border border-ds-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead>
              <tr className="border-b border-ds-neutral-100 bg-ds-neutral-50/80">
                {showEmployeeColumn && (
                  <th className={thClass}>Employee</th>
                )}
                {showEmployeeColumn && (
                  <th className={thClass}>ID</th>
                )}
                <th className={thClass}>Location</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Shift</th>
                <th className={thClass}>Mode</th>
                <th className={thClass}>Punch In</th>
                <th className={thClass}>In Photo</th>
                <th className={thClass}>Punch Out</th>
                <th className={thClass}>Out Photo</th>
                <th className={thClass}>Duration</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-20 text-center">
                    <Search className="size-12 text-indigo-200 mx-auto mb-4" />
                    <p className="text-base font-semibold text-ds-neutral-600">No records found</p>
                    <p className="text-sm text-ds-neutral-400 mt-1">Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b border-ds-neutral-50 hover:bg-ds-neutral-50/60 transition-colors">
                    {showEmployeeColumn && (
                      <td className={tdClass}>
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                            <User className="size-4 text-indigo-600" />
                          </div>
                          <span className="font-semibold text-ds-brand-navy">
                            {employeeNameById.get(record.employeeId) || record.employeeId}
                          </span>
                        </div>
                      </td>
                    )}
                    {showEmployeeColumn && (
                      <td className={`${tdClass} text-ds-neutral-500 font-medium`}>{record.employeeId}</td>
                    )}
                    <td className={`${tdClass} text-ds-neutral-700`}>{record.hospitalName || '—'}</td>
                    <td className={`${tdClass} text-ds-neutral-700`}>{formatDisplayDate(record.date)}</td>
                    <td className={`${tdClass} text-ds-neutral-600`}>{formatShift(record.checkIn)}</td>
                    <td className={tdClass}>
                      <PunchModeBadge mode={record.punchMode} />
                    </td>
                    <td className={`${tdClass} font-semibold text-ds-brand-navy`}>{formatPunchTime(record.checkIn)}</td>
                    <td className={tdClass}>
                      <PhotoCell url={record.punchInPhotoUrl} label="In" />
                    </td>
                    <td className={`${tdClass} font-semibold text-ds-brand-navy`}>{formatPunchTime(record.checkOut)}</td>
                    <td className={tdClass}>
                      <PhotoCell url={record.punchOutPhotoUrl} label="Out" />
                    </td>
                    <td className={`${tdClass} font-medium text-ds-brand-navy`}>
                      {formatDuration(record.checkIn, record.checkOut, record.isActive)}
                    </td>
                    <td className={tdClass}>
                      <StatusPill record={record} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
