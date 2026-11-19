"use client"

import * as React from 'react'
import {
  Button,
  Input,
  Select,
  SectionCard,
  Spinner,
} from '@hryantra/ui'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import { notifyDataChanged, useDataSync } from '@/shared/events'
import { CreateRosterModal } from '@/modules/roster/components/CreateRosterModal'
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Search,
  Sparkles,
  Users,
  CheckSquare,
  Square,
  Clock,
  ShieldCheck,
  RefreshCw,
  Edit2,
  X,
  Info,
} from 'lucide-react'

interface RosterDayHeader {
  dateStr: string
  dayOfMonth: number
  dayOfWeek: number
  dayName: string
  isSaturday: boolean
  saturdayOccurrence?: number
  isSunday: boolean
  isHoliday: boolean
  holidayName: string | null
  label: string
}

interface RosterCell {
  dateStr: string
  status: string
  label: string
  color: string
  badgeClass: string
  isOverride: boolean
}

interface RosterRow {
  id: string
  employeeId: string
  name: string
  department: string
  designation?: string
  assignedPattern: string
  assignedShift: string
  cells: RosterCell[]
}

interface RosterGridData {
  targetYear: number
  targetMonth: number
  view: 'weekly' | 'monthly'
  weekIndex: number
  daysHeader: RosterDayHeader[]
  rows: RosterRow[]
  shifts: Array<{ code: string; name: string; hours: string; color: string; badgeClass: string }>
  departments: string[]
  summary: {
    totalEmployees: number
    totalWeekOffs: number
    totalWorkingShifts: number
    totalLeaves: number
    totalHolidays: number
  }
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const PATTERN_LABELS: Record<string, string> = {
  ALTERNATE_SAT_2ND_4TH: '2nd & 4th Sat Off',
  FIVE_DAY: '5-Day (Sat & Sun Off)',
  ALTERNATE_SAT_1ST_3RD: '1st & 3rd Sat Off',
  SIX_DAY: '6-Day (Sun Only Off)',
  CUSTOM: 'Custom Offs',
}

export interface RosterGridPlannerProps {
  onNavigateToShifts?: () => void
}

export function RosterGridPlanner({ onNavigateToShifts }: RosterGridPlannerProps = {}) {
  const { currentUserRole, hasTab } = useStore()
  const canManage =
    currentUserRole === 'HR' ||
    currentUserRole === 'Superadmin' ||
    currentUserRole === 'PlatformOwner' ||
    hasTab('settings')

  const now = new Date()
  const [selectedYear, setSelectedYear] = React.useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = React.useState(now.getMonth() + 1)
  const [viewMode, setViewMode] = React.useState<'weekly' | 'monthly'>('weekly')
  const [weekIndex, setWeekIndex] = React.useState(0)
  const [departmentFilter, setDepartmentFilter] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [gridData, setGridData] = React.useState<RosterGridData | null>(null)

  // Selection for roster creation
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<string[]>([])
  const [isCreateRosterOpen, setIsCreateRosterOpen] = React.useState(false)

  // Quick cell override popover
  const [activeCellEdit, setActiveCellEdit] = React.useState<{
    employeeId: string
    employeeName: string
    dateStr: string
    currentStatus: string
    currentLabel: string
  } | null>(null)
  const [isOverridingCell, setIsOverridingCell] = React.useState(false)

  const fetchGrid = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.leaves.getRosterGrid({
        year: selectedYear,
        month: selectedMonth,
        view: viewMode,
        weekIndex,
        department: departmentFilter || undefined,
        search: searchQuery || undefined,
      })
      if (res?.success && res.data) {
        setGridData(res.data)
      } else {
        throw new Error(res?.message || 'Failed to load roster grid')
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading roster')
    } finally {
      setLoading(false)
    }
  }, [selectedYear, selectedMonth, viewMode, weekIndex, departmentFilter, searchQuery])

  React.useEffect(() => {
    fetchGrid()
  }, [fetchGrid])

  // Real-time synchronization when leaves or rosters are modified across portals
  useDataSync(['roster', 'leave'], () => {
    fetchGrid()
  })

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((prev) => prev - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth((prev) => prev - 1)
    }
    setWeekIndex(0)
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((prev) => prev + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth((prev) => prev + 1)
    }
    setWeekIndex(0)
  }

  const handleSelectAll = (checked: boolean) => {
    if (!gridData) return
    if (checked) {
      setSelectedEmployeeIds(gridData.rows.map((r) => r.id))
    } else {
      setSelectedEmployeeIds([])
    }
  }

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleApplyCellShift = async (shiftCode: string) => {
    if (!activeCellEdit) return
    try {
      setIsOverridingCell(true)
      await api.leaves.overrideRosterCell({
        employeeId: activeCellEdit.employeeId,
        dateStr: activeCellEdit.dateStr,
        shiftCode,
      })
      notifyDataChanged('roster', { employeeId: activeCellEdit.employeeId, dateStr: activeCellEdit.dateStr, shiftCode })
      notifyDataChanged('attendance', { employeeId: activeCellEdit.employeeId })
      setActiveCellEdit(null)
      await fetchGrid()
    } catch (err: any) {
      alert(err?.message || 'Failed to override cell shift')
    } finally {
      setIsOverridingCell(false)
    }
  }

  const handleExportCSV = () => {
    if (!gridData || gridData.rows.length === 0) return

    const days = gridData.daysHeader
    const headerCols = ['Employee Name', 'Employee ID', 'Department', 'Designation', 'Pattern', ...days.map((d) => `${d.dateStr} (${d.dayName})`)]
    const rows = gridData.rows.map((r) => {
      const cellStatuses = r.cells.map((c) => `"${c.status} - ${c.label}"`)
      return [
        `"${r.name}"`,
        `"${r.employeeId}"`,
        `"${r.department}"`,
        `"${r.designation || ''}"`,
        `"${PATTERN_LABELS[r.assignedPattern] || r.assignedPattern}"`,
        ...cellStatuses,
      ].join(',')
    })

    const csvContent = [headerCols.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `roster-${gridData.targetYear}-${gridData.targetMonth}-${viewMode}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const todayStr = React.useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }, [])

  const allSelected =
    gridData &&
    gridData.rows.length > 0 &&
    gridData.rows.every((r) => selectedEmployeeIds.includes(r.id))

  return (
    <div className="flex flex-col gap-5">
      {/* ── Top Header & Action Controls ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-ds-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ds-brand-navy flex items-center gap-2">
              <CalendarDays className="size-5 text-emerald-600" />
              <span>Weekly & Monthly Roster Planner</span>
            </h2>
            <p className="text-xs text-ds-neutral-500 mt-0.5">
              Bulk assign shift timings, manage alternate Saturdays & weekend offs, and view live employee schedules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsCreateRosterOpen(true)}
                  className="flex items-center gap-1.5 shadow-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                >
                  <Plus className="size-4" />
                  <span>Create Roster Schedule</span>
                </Button>

                {onNavigateToShifts && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNavigateToShifts}
                    className="flex items-center gap-1.5 text-xs font-semibold text-ds-neutral-700 hover:text-indigo-800 hover:border-indigo-300"
                  >
                    <Clock className="size-4 text-indigo-600" />
                    <span>Manage Shifts</span>
                  </Button>
                )}
              </>
            )}

            <Button variant="outline" size="sm" onClick={handleExportCSV} className="flex items-center gap-1.5">
              <Download className="size-4" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* ── Filter & Navigation Bar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ds-neutral-100 pt-3">
          {/* View mode toggle & Date Stepper */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-ds-neutral-100 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setViewMode('weekly')
                  setWeekIndex(0)
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'weekly'
                    ? 'bg-white text-ds-brand-navy shadow-xs'
                    : 'text-ds-neutral-600 hover:text-ds-neutral-900'
                }`}
              >
                Weekly View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'monthly'
                    ? 'bg-white text-ds-brand-navy shadow-xs'
                    : 'text-ds-neutral-600 hover:text-ds-neutral-900'
                }`}
              >
                Monthly Grid
              </button>
            </div>

            {/* Month Stepper */}
            <div className="flex items-center rounded-xl border border-ds-neutral-200 bg-white px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-md text-ds-neutral-600 hover:bg-ds-neutral-100"
                title="Previous Month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-2 text-xs font-bold text-ds-brand-navy min-w-[110px] text-center">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-md text-ds-neutral-600 hover:bg-ds-neutral-100"
                title="Next Month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* In Weekly View: Week selector pills */}
            {viewMode === 'weekly' && (
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((idx) => {
                  const startDay = idx * 7 + 1
                  const endDay = Math.min((idx + 1) * 7, 31)
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setWeekIndex(idx)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all ${
                        weekIndex === idx
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-ds-neutral-100 text-ds-neutral-600 hover:bg-ds-neutral-200'
                      }`}
                    >
                      W{idx + 1} ({startDay}-{endDay})
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Search & Department Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-ds-neutral-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-ds-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs text-ds-neutral-800 placeholder:text-ds-neutral-400 focus:border-ds-brand-navy focus:outline-none"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-xl border border-ds-neutral-200 bg-white py-1.5 px-3 text-xs text-ds-neutral-800 focus:border-ds-brand-navy focus:outline-none"
            >
              <option value="">All Departments</option>
              {gridData?.departments?.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={fetchGrid}
              className="p-1.5 rounded-xl border border-ds-neutral-200 bg-white text-ds-neutral-600 hover:bg-ds-neutral-50 shadow-2xs"
              title="Refresh Grid"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Compact Live Summary Strip ── */}
      {gridData && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ds-neutral-200 bg-white px-4 py-2.5 text-xs text-ds-neutral-700 shadow-2xs">
          <span className="font-bold text-ds-brand-navy">Roster Summary:</span>
          <span>Staff: <strong>{gridData.summary.totalEmployees}</strong></span>
          <span>•</span>
          <span className="text-emerald-700">Weekly Offs (WO): <strong>{gridData.summary.totalWeekOffs}</strong></span>
          <span>•</span>
          <span className="text-slate-800">Working Shifts: <strong>{gridData.summary.totalWorkingShifts}</strong></span>
          <span>•</span>
          <span className="text-purple-700">Holidays: <strong>{gridData.summary.totalHolidays}</strong></span>
          <span>•</span>
          <span className="text-sky-700">Approved Leaves: <strong>{gridData.summary.totalLeaves}</strong></span>
        </div>
      )}

      {/* ── Bulk Selection Bar ── */}
      {selectedEmployeeIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="size-4 text-indigo-600" />
            <span className="font-bold">
              {selectedEmployeeIds.length} employee{selectedEmployeeIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsCreateRosterOpen(true)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-7 font-bold flex items-center gap-1"
            >
              <CalendarDays className="size-3.5" />
              <span>Create Schedule for Selected ({selectedEmployeeIds.length})</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEmployeeIds([])}
              className="text-xs h-7"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* ── The Roster Matrix Grid ── */}
      <div className="rounded-2xl border border-ds-neutral-200 bg-white shadow-xs overflow-hidden">
        {loading && !gridData ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-ds-neutral-500">
            <Spinner className="size-7 text-emerald-600" />
            <span className="text-xs font-semibold">Generating dynamic roster schedule...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600">
            <p className="font-bold">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchGrid} className="mt-3">
              Retry
            </Button>
          </div>
        ) : !gridData || gridData.rows.length === 0 ? (
          <div className="p-12 text-center text-xs text-ds-neutral-500 space-y-2">
            <Users className="size-8 mx-auto text-ds-neutral-400" />
            <p className="font-bold text-ds-neutral-700">No staff members found</p>
            <p>Try clearing filters or search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-ds-neutral-200 bg-ds-neutral-50/90 text-ds-neutral-700 font-bold">
                  {/* Sticky Employee Column */}
                  <th className="sticky left-0 z-20 min-w-[240px] max-w-[280px] bg-ds-neutral-50/95 py-3 px-4 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSelectAll(!allSelected)}
                        className="text-ds-neutral-500 hover:text-ds-brand-navy"
                        title={allSelected ? 'Deselect all' : 'Select all'}
                      >
                        {allSelected ? (
                          <CheckSquare className="size-4 text-emerald-700" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                      <span className="uppercase tracking-wider text-[11px] text-ds-neutral-600">
                        Employee & Assigned Policy
                      </span>
                    </div>
                  </th>

                  {/* Day Header Columns */}
                  {gridData.daysHeader.map((d) => {
                    const isToday = d.dateStr === todayStr
                    const isSat = d.isSaturday
                    const isSun = d.isSunday

                    return (
                      <th
                        key={d.dateStr}
                        className={`min-w-[85px] py-2.5 px-2 text-center border-l border-ds-neutral-200/80 transition-colors ${
                          isToday
                            ? 'bg-amber-50/90 text-amber-900 ring-1 ring-inset ring-amber-300'
                            : isSun
                            ? 'bg-emerald-50/60 text-emerald-900'
                            : isSat
                            ? 'bg-slate-100/70 text-slate-800'
                            : 'bg-ds-neutral-50 text-ds-neutral-700'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-semibold uppercase text-ds-neutral-500">
                            {d.dayName}
                          </span>
                          <span
                            className={`text-xs font-black mt-0.5 ${
                              isToday
                                ? 'rounded-full bg-amber-500 text-white px-1.5 py-0.2'
                                : ''
                            }`}
                          >
                            {d.dayOfMonth}
                          </span>
                          {isSat && (
                            <span className="text-[9px] font-bold text-ds-neutral-500 mt-0.5">
                              {d.label}
                            </span>
                          )}
                          {isSun && (
                            <span className="text-[9px] font-bold text-emerald-700 mt-0.5">
                              Sun Off
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-ds-neutral-200">
                {gridData.rows.map((row) => {
                  const isChecked = selectedEmployeeIds.includes(row.id)

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-ds-neutral-50/60 transition-colors ${
                        isChecked ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      {/* Sticky Employee Row Header */}
                      <td className="sticky left-0 z-10 bg-white py-3 px-4 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleEmployee(row.id)}
                            className="text-ds-neutral-400 hover:text-ds-brand-navy shrink-0"
                          >
                            {isChecked ? (
                              <CheckSquare className="size-4 text-emerald-700" />
                            ) : (
                              <Square className="size-4" />
                            )}
                          </button>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-ds-brand-navy truncate text-xs">
                              {row.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-ds-neutral-500 mt-0.5">
                              <span>{row.employeeId}</span>
                              <span>•</span>
                              <span className="font-medium text-ds-neutral-600 truncate">
                                {row.department}
                              </span>
                            </div>
                            <span className="inline-block mt-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded w-fit border border-emerald-200/50">
                              {PATTERN_LABELS[row.assignedPattern] || row.assignedPattern}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Day Cells */}
                      {row.cells.map((c) => {
                        const isToday = c.dateStr === todayStr
                        const isWO = c.status === 'WO'
                        const isHoliday = c.status === 'H'
                        const isLeave = c.status === 'L'

                        return (
                          <td
                            key={c.dateStr}
                            onClick={() => {
                              if (!canManage) return
                              setActiveCellEdit({
                                employeeId: row.id,
                                employeeName: row.name,
                                dateStr: c.dateStr,
                                currentStatus: c.status,
                                currentLabel: c.label,
                              })
                            }}
                            className={`min-w-[85px] py-2.5 px-1.5 text-center border-l border-ds-neutral-100 transition-all ${
                              canManage ? 'cursor-pointer hover:bg-ds-neutral-100/80' : ''
                            } ${isToday ? 'bg-amber-50/30' : ''}`}
                            title={`${row.name} on ${c.dateStr}: ${c.label} (${c.status})${
                              canManage ? ' - Click to override shift' : ''
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span
                                className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-black border transition-transform ${
                                  c.badgeClass
                                } ${c.isOverride ? 'ring-1 ring-amber-400' : ''}`}
                              >
                                {c.status}
                              </span>
                              <span className="text-[9px] text-ds-neutral-500 font-medium truncate max-w-[80px]">
                                {isWO
                                  ? 'Week Off'
                                  : isHoliday
                                  ? 'Holiday'
                                  : isLeave
                                  ? 'On Leave'
                                  : c.label}
                              </span>
                              {c.isOverride && (
                                <span className="size-1 rounded-full bg-amber-500" title="Manually overridden" />
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Legend Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ds-neutral-200 bg-white p-4 text-xs text-ds-neutral-600 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-ds-brand-navy flex items-center gap-1.5">
            <Info className="size-3.5 text-ds-neutral-500" />
            <span>Shift & Off Legend:</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-600" />
            <strong>WO:</strong> Scheduled Weekly Off (2nd & 4th Sat / Sun)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-slate-600" />
            <strong>GS:</strong> General Shift (09:30–18:30)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-600" />
            <strong>MS:</strong> Morning Shift (06:00–14:30)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-blue-600" />
            <strong>ES:</strong> Evening Shift (14:00–22:30)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-indigo-600" />
            <strong>NS:</strong> Night Shift (22:00–06:30)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-purple-600" />
            <strong>H:</strong> Public Holiday
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-sky-600" />
            <strong>L:</strong> Approved Leave
          </span>
        </div>

        {canManage && (
          <span className="text-[11px] text-ds-neutral-400 italic">
            * Click any shift cell to edit individual daily shifts or grant comp-offs.
          </span>
        )}
      </div>

      {/* ── Quick Cell Shift Override Modal / Popover ── */}
      {activeCellEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm max-h-[90vh] flex flex-col rounded-2xl border border-ds-neutral-200 bg-white p-5 shadow-2xl overflow-hidden space-y-4">
            <div className="flex shrink-0 items-center justify-between border-b border-ds-neutral-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-ds-brand-navy">Override Daily Shift</h3>
                <p className="text-[11px] text-ds-neutral-500 mt-0.5">
                  {activeCellEdit.employeeName} • {activeCellEdit.dateStr}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCellEdit(null)}
                className="rounded-lg p-1 text-ds-neutral-400 hover:bg-ds-neutral-100 hover:text-ds-neutral-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto text-xs space-y-2.5 pr-1">
              <span className="text-[11px] font-bold text-ds-neutral-600 block">Assign Shift for this Day:</span>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {(gridData?.shifts || [])
                  .filter((s) => s.code !== 'WO')
                  .map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      disabled={isOverridingCell}
                      onClick={() => handleApplyCellShift(s.code)}
                      className={`flex flex-col items-center p-2 rounded-xl border text-left transition-all ${
                        activeCellEdit.currentStatus === s.code
                          ? 'border-indigo-600 bg-indigo-50 font-bold ring-1 ring-indigo-600 shadow-2xs'
                          : 'border-ds-neutral-200 bg-white hover:bg-ds-neutral-50'
                      }`}
                    >
                      <span className="font-bold text-xs text-ds-brand-navy">{s.name} ({s.code})</span>
                      <span className="text-[10px] text-ds-neutral-500 mt-0.5">{(s as any).timings || s.hours}</span>
                    </button>
                  ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isOverridingCell}
                  onClick={() => handleApplyCellShift('WO')}
                  className="w-full py-2 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                >
                  <CalendarDays className="size-4 text-emerald-700" />
                  <span>Mark as Weekly Off / Comp-Off (WO)</span>
                </button>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  disabled={isOverridingCell}
                  onClick={() => handleApplyCellShift('RESET')}
                  className="w-full py-1.5 text-center text-xs text-ds-neutral-500 hover:text-ds-brand-navy hover:underline"
                >
                  Reset to Policy Default Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Roster Schedule Modal ── */}
      <CreateRosterModal
        open={isCreateRosterOpen}
        onClose={() => setIsCreateRosterOpen(false)}
        onSuccess={() => {
          setSelectedEmployeeIds([])
          fetchGrid()
        }}
        initialSelectedEmployeeIds={selectedEmployeeIds}
        departments={gridData?.departments || []}
        employees={gridData?.rows || []}
        onNavigateToShifts={onNavigateToShifts}
      />
    </div>
  )
}
