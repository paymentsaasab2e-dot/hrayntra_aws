"use client"

import * as React from 'react'
import { api } from '@/shared/api'
import { Button, Input } from '@hryantra/ui'
import {
  Users,
  Search,
  RefreshCw,
  Coffee,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Laptop,
  Wifi,
  MapPin,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Filter,
  Eye,
  Sliders,
  Home,
  Briefcase,
  Calendar,
  Sparkles,
  Award,
  Zap,
} from 'lucide-react'
import { notifyDataChanged, useDataSync } from '@/shared/events'

export interface LiveEmployeeRecord {
  id: string
  employeeId: string
  attendanceId?: string | null
  name: string
  department: string
  designation: string
  webPunchAllowed: boolean
  liveStatus: 'ON_BREAK' | 'CLOCKED_IN' | 'CLOCKED_OUT' | 'WFH' | 'ON_LEAVE' | 'WEEK_OFF' | 'HOLIDAY' | 'NOT_CLOCKED_IN'
  workedSecondsToday: number
  workedFormatted: string
  firstCheckIn: string | null
  lastCheckOut: string | null
  punchMode: string | null
  currentBreak: {
    id: string
    type: string
    startTime: string
    elapsedSeconds: number
    elapsedFormatted: string
  } | null
  todayBreaksCount: number
  totalBreakMinutes: number
  clientIp: string | null
  accuracyMeters: number | null
  isOfficeIp: boolean | null
  isSuspicious: boolean
  assignedLocation: string | null
  rejectionReason?: string | null
  isFlexi?: boolean
  overtimeHours?: number | null
  isOffDayWork?: boolean
  isCompOffEligible?: boolean
  compOffDays?: number
  shortLeaveInfo?: {
    type?: string
    hours?: number
    reason?: string
  } | null
  onLeaveInfo?: {
    type: string
    startDate: string
    endDate: string
  } | null
  holidayInfo?: {
    name: string
  } | null
  shiftInfo?: {
    code: string
    name: string
    category?: 'GENERAL' | 'NIGHT' | 'ROTATIONAL' | 'SPLIT'
    timings: string
    firstSlotStartTime?: string
    firstSlotEndTime?: string
    secondSlotStartTime?: string
    secondSlotEndTime?: string
    isWeeklyOff: boolean
  } | null
}

export interface LiveMonitorSummary {
  totalEmployees: number
  clockedInNow: number
  onBreakNow: number
  clockedOutToday: number
  onLeaveToday: number
  weeklyOffToday: number
  notClockedInToday: number
  webPunchEnabledCount: number
}

const formatBreakLabel = (type?: string | null): string => {
  if (!type) return 'Break'
  const u = type.toUpperCase()
  if (u === 'TEA' || u === 'COFFEE') return 'Tea Break'
  if (u === 'LUNCH' || u === 'MEAL') return 'Lunch Break'
  if (u === 'WELLNESS' || u === 'STRETCH' || u === 'SMOKE') return 'Wellness Break'
  if (u === 'PERSONAL' || u === 'BIO') return 'Personal Break'
  return `${type} Break`
}

export function LiveEmployeeAttendanceMonitor() {
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [summary, setSummary] = React.useState<LiveMonitorSummary>({
    totalEmployees: 0,
    clockedInNow: 0,
    onBreakNow: 0,
    clockedOutToday: 0,
    onLeaveToday: 0,
    weeklyOffToday: 0,
    notClockedInToday: 0,
    webPunchEnabledCount: 0,
  })
  const [employees, setEmployees] = React.useState<LiveEmployeeRecord[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [toastMessage, setToastMessage] = React.useState<string | null>(null)

  // Filters
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL')
  const [deptFilter, setDeptFilter] = React.useState<string>('ALL')
  const [webPunchFilter, setWebPunchFilter] = React.useState<string>('ALL')

  // Selected employee detail drawer
  const [inspectEmployee, setInspectEmployee] = React.useState<LiveEmployeeRecord | null>(null)
  const [runningClosure, setRunningClosure] = React.useState(false)
  const [creditingCompOff, setCreditingCompOff] = React.useState<string | null>(null)

  const handleCreditCompOff = async (emp: LiveEmployeeRecord) => {
    if (!emp.attendanceId) {
      setToastMessage(`No active attendance session recorded yet for ${emp.name}`)
      setTimeout(() => setToastMessage(null), 3000)
      return
    }
    setCreditingCompOff(emp.id)
    try {
      const res = await api.attendance.creditCompOff({ attendanceId: emp.attendanceId })
      if (res && res.success) {
        setToastMessage(`🎉 Successfully credited ${res.creditedDays || emp.compOffDays || 1} Comp-Off day(s) to ${emp.name}!`)
        setTimeout(() => setToastMessage(null), 5000)
        notifyDataChanged('attendance')
        notifyDataChanged('leave')
        await loadData(true)
      } else {
        throw new Error(res?.message || 'Failed to credit comp-off')
      }
    } catch (err: any) {
      setToastMessage(`Comp-off credit error: ${err?.message || 'Failed'}`)
      setTimeout(() => setToastMessage(null), 4000)
    } finally {
      setCreditingCompOff(null)
    }
  }

  const handleRunDailyClosure = async () => {
    if (!confirm('Run automated attendance daily closure now? This will auto-checkout open sessions past their buffer window and mark unclocked staff as absent.')) return
    setRunningClosure(true)
    try {
      const res = await api.attendance.runClosure()
      if (res && res.success) {
        const d = res.data
        setToastMessage(
          `Daily Closure Complete: ${d.autoCheckoutsWithinQuota} auto-checkouts (within quota), ${d.autoCheckoutsExceededQuota} exceeded quota, ${d.autoAbsentsCreated} auto-absents created.`
        )
        setTimeout(() => setToastMessage(null), 6000)
        notifyDataChanged('attendance')
        loadData(true)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to execute daily closure')
    } finally {
      setRunningClosure(false)
    }
  }

  const loadData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await api.attendance.getLiveMonitoring()
      if (res && res.success) {
        setSummary(res.summary)
        setEmployees(res.employees || [])
      } else {
        throw new Error(res?.message || 'Failed to load live monitor data')
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to fetch real-time employee attendance')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
    // Live polling every 15s for HR observation
    const timer = setInterval(() => loadData(true), 15_000)
    return () => clearInterval(timer)
  }, [loadData])

  // Cross-portal instant reactive sync on leave, attendance, or roster updates
  useDataSync(['attendance', 'leave', 'roster'], () => {
    loadData(true)
  })

  // Toggle Web Punch permission for employee
  const handleToggleWebPunch = async (emp: LiveEmployeeRecord) => {
    const nextState = !emp.webPunchAllowed

    // Optimistic UI update
    setEmployees(prev =>
      prev.map(e => (e.id === emp.id ? { ...e, webPunchAllowed: nextState } : e))
    )

    try {
      const res = await api.attendance.setWebPunchPermission({
        employeeId: emp.id,
        allowed: nextState,
      })
      if (res && res.success) {
        setToastMessage(
          `Web clock-in ${nextState ? 'ENABLED' : 'RESTRICTED'} for ${emp.name}`
        )
        setTimeout(() => setToastMessage(null), 3000)
        notifyDataChanged('attendance', { employeeId: emp.id, webPunchAllowed: nextState })
      } else {
        throw new Error(res?.message || 'Update failed')
      }
    } catch (err: any) {
      // Revert on error
      setEmployees(prev =>
        prev.map(e => (e.id === emp.id ? { ...e, webPunchAllowed: !nextState } : e))
      )
      setError(err?.message || 'Failed to update web punch permission')
    }
  }

  // Filtered employees
  const departments = React.useMemo(() => {
    const set = new Set<string>()
    employees.forEach(e => {
      if (e.department) set.add(e.department)
    })
    return Array.from(set).sort()
  }, [employees])

  const filteredEmployees = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees.filter(e => {
      if (q) {
        const matchesName = e.name.toLowerCase().includes(q)
        const matchesId = e.employeeId.toLowerCase().includes(q)
        const matchesDept = e.department.toLowerCase().includes(q)
        if (!matchesName && !matchesId && !matchesDept) return false
      }
      if (statusFilter !== 'ALL' && e.liveStatus !== statusFilter) return false
      if (deptFilter !== 'ALL' && e.department !== deptFilter) return false
      if (webPunchFilter === 'ENABLED' && !e.webPunchAllowed) return false
      if (webPunchFilter === 'RESTRICTED' && e.webPunchAllowed) return false
      return true
    })
  }, [employees, search, statusFilter, deptFilter, webPunchFilter])

  return (
    <div className="flex flex-col gap-5">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-4 py-3 shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="size-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:underline font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Streamlined Operational KPI Row (4 clean to-the-point cards, single row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Clocked In */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'CLOCKED_IN' ? 'ALL' : 'CLOCKED_IN')}
          className={`cursor-pointer rounded-xl border p-3.5 transition-all shadow-[0_1px_3px_rgba(16,185,129,0.04)] ${
            statusFilter === 'CLOCKED_IN'
              ? 'border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/20'
              : 'border-slate-200/90 bg-gradient-to-br from-white via-white to-emerald-50/60 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Clocked In</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Working
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary.clockedInNow}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Active on-duty staff</div>
        </div>

        {/* On Break */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'ON_BREAK' ? 'ALL' : 'ON_BREAK')}
          className={`cursor-pointer rounded-xl border p-3.5 transition-all shadow-[0_1px_3px_rgba(245,158,11,0.04)] ${
            statusFilter === 'ON_BREAK'
              ? 'border-amber-500 bg-amber-50/90 ring-2 ring-amber-500/20'
              : 'border-slate-200/90 bg-gradient-to-br from-white via-white to-amber-50/60 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">On Break</span>
            <Coffee className="size-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary.onBreakNow}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-0.5">Tea / Lunch paused</div>
        </div>

        {/* On Leave / Off */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'ON_LEAVE' ? 'ALL' : 'ON_LEAVE')}
          className={`cursor-pointer rounded-xl border p-3.5 transition-all shadow-[0_1px_3px_rgba(14,165,233,0.04)] ${
            statusFilter === 'ON_LEAVE' || statusFilter === 'WEEK_OFF'
              ? 'border-sky-500 bg-sky-50/90 ring-2 ring-sky-500/20'
              : 'border-slate-200/90 bg-gradient-to-br from-white via-white to-sky-50/60 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between text-sky-800 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">On Leave / Off</span>
            <Calendar className="size-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary.onLeaveToday + summary.weeklyOffToday}
          </div>
          <div className="text-[11px] text-sky-700 font-medium mt-0.5">
            {summary.onLeaveToday} approved leave · {summary.weeklyOffToday} scheduled off
          </div>
        </div>

        {/* Not In Yet */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'NOT_CLOCKED_IN' ? 'ALL' : 'NOT_CLOCKED_IN')}
          className={`cursor-pointer rounded-xl border p-3.5 transition-all shadow-[0_1px_3px_rgba(100,116,139,0.04)] ${
            statusFilter === 'NOT_CLOCKED_IN'
              ? 'border-slate-500 bg-slate-100 ring-2 ring-slate-400/20'
              : 'border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-100/70 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Not In Yet</span>
            <XCircle className="size-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary.notClockedInToday}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            Pending check-in · {summary.totalEmployees} total roster
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <Input
              className="pl-9 h-10 w-full"
              placeholder="Search employee name, ID, department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filter by Status"
            >
              <option value="ALL">All Statuses</option>
              <option value="CLOCKED_IN">🟢 Clocked In (Working)</option>
              <option value="ON_BREAK">☕ On Break</option>
              <option value="CLOCKED_OUT">⏹️ Clocked Out</option>
              <option value="WFH">🏠 WFH / Remote</option>
              <option value="ON_LEAVE">🌴 On Leave (Approved)</option>
              <option value="WEEK_OFF">🗓️ Weekly Off</option>
              <option value="HOLIDAY">🎉 Public Holiday</option>
              <option value="NOT_CLOCKED_IN">⚪ Not Clocked In</option>
            </select>

            {/* Department Filter */}
            <select
              className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              aria-label="Filter by Department"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Web Clock-in Option Filter */}
            <select
              className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              value={webPunchFilter}
              onChange={e => setWebPunchFilter(e.target.value)}
              aria-label="Filter by Web Clock-In Option"
            >
              <option value="ALL">All Web Punch Rights</option>
              <option value="ENABLED">💻 Web Punch: Enabled</option>
              <option value="RESTRICTED">🚫 Web Punch: Restricted</option>
            </select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="h-10 text-xs font-semibold"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {/* Run Daily Closure Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunDailyClosure}
              disabled={runningClosure || refreshing}
              className="h-10 text-xs font-semibold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
              title="Auto-close dangling sessions and mark unclocked employees absent"
            >
              <Clock className={`size-3.5 mr-1.5 ${runningClosure ? 'animate-spin' : ''}`} />
              {runningClosure ? 'Running Closure...' : 'Run Auto-Closure'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Real-Time Observation Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Web Punch Option</th>
                <th className="px-4 py-3.5">Current Status</th>
                <th className="px-4 py-3.5">Time Worked Today</th>
                <th className="px-4 py-3.5">First In / Out</th>
                <th className="px-4 py-3.5">Punch Mode</th>
                <th className="px-4 py-3.5">Network & GPS</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-500">
                    <RefreshCw className="size-6 animate-spin mx-auto text-purple-600 mb-2" />
                    <span>Loading real-time employee attendance...</span>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <Users className="size-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No employees match current filters</p>
                    <p className="text-[11px] text-slate-400">Try clearing filters or search term.</p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const isWorking = emp.liveStatus === 'CLOCKED_IN'
                  const isOnBreak = emp.liveStatus === 'ON_BREAK'
                  const isClockedOut = emp.liveStatus === 'CLOCKED_OUT'
                  const isWfh = emp.liveStatus === 'WFH'

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Employee Column */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="size-9 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
                            {emp.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{emp.name}</span>
                              {emp.shiftInfo?.category === 'SPLIT' && (
                                <span className="inline-flex items-center rounded-xs bg-cyan-100 text-cyan-800 px-1.5 py-0.2 text-[9px] font-bold border border-cyan-200">
                                  Split
                                </span>
                              )}
                              {emp.shiftInfo?.category === 'NIGHT' && (
                                <span className="inline-flex items-center rounded-xs bg-purple-100 text-purple-800 px-1.5 py-0.2 text-[9px] font-bold border border-purple-200">
                                  Night
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              <span>{emp.employeeId}</span>
                              <span>&bull;</span>
                              <span>{emp.department}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Web Punch Option Given (Toggle Switch) */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={emp.webPunchAllowed}
                            onClick={() => handleToggleWebPunch(emp)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              emp.webPunchAllowed ? 'bg-purple-600' : 'bg-slate-300'
                            }`}
                            title={`Click to ${emp.webPunchAllowed ? 'restrict' : 'enable'} web clock-in for ${emp.name}`}
                          >
                            <span
                              className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                emp.webPunchAllowed ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className={`text-[11px] font-bold ${
                            emp.webPunchAllowed ? 'text-purple-700' : 'text-slate-400'
                          }`}>
                            {emp.webPunchAllowed ? 'Allowed' : 'Restricted'}
                          </span>
                        </div>
                      </td>

                      {/* Current Status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {isOnBreak ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 font-bold text-[11px]">
                              <Coffee className="size-3 text-amber-700 animate-pulse" />
                              <span>{formatBreakLabel(emp.currentBreak?.type)}: {emp.currentBreak?.elapsedFormatted || 'Active'}</span>
                            </div>
                          ) : isWorking ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 font-bold text-[11px]">
                              <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
                              <span>Working Now</span>
                            </div>
                          ) : isClockedOut ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 px-2.5 py-0.5 font-bold text-[11px]">
                              <Square className="size-3 fill-blue-700 text-blue-700" />
                              <span>Clocked Out</span>
                            </div>
                          ) : isWfh ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 text-cyan-950 border border-cyan-300 px-2.5 py-0.5 font-bold text-[11px]">
                              <Home className="size-3 text-cyan-700" />
                              <span>WFH Approved</span>
                            </div>
                          ) : emp.liveStatus === 'ON_LEAVE' ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 text-sky-950 border border-sky-300 px-2.5 py-0.5 font-bold text-[11px]">
                              <span>🌴</span>
                              <span>On Leave {emp.onLeaveInfo?.type ? `(${emp.onLeaveInfo.type})` : ''}</span>
                            </div>
                          ) : emp.liveStatus === 'HOLIDAY' ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 text-purple-950 border border-purple-300 px-2.5 py-0.5 font-bold text-[11px]">
                              <span>🎉</span>
                              <span>Holiday {emp.holidayInfo?.name ? `(${emp.holidayInfo.name})` : ''}</span>
                            </div>
                          ) : emp.liveStatus === 'WEEK_OFF' ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 px-2.5 py-0.5 font-bold text-[11px]">
                              <span>🗓️</span>
                              <span>Weekly Off</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 font-medium text-[11px]">
                              <span className="size-2 rounded-full bg-slate-300" />
                              <span>Not Punched In</span>
                            </div>
                          )}

                          {/* Policy & Special Badges */}
                          <div className="flex flex-wrap items-center gap-1">
                            {emp.isFlexi && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 px-1.5 py-0.2 text-[9px] font-bold">
                                <Zap className="size-2 text-cyan-600" /> Flexi
                              </span>
                            )}
                            {emp.shortLeaveInfo && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.2 text-[9px] font-bold" title={emp.shortLeaveInfo.reason}>
                                ⏱️ SL ({emp.shortLeaveInfo.hours}h)
                              </span>
                            )}
                            {emp.overtimeHours && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 text-[9px] font-bold">
                                <Sparkles className="size-2 text-indigo-600" /> OT {emp.overtimeHours}h
                              </span>
                            )}
                            {emp.isCompOffEligible && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 text-[9px] font-bold">
                                <Award className="size-2 text-emerald-600" /> Comp-Off {emp.compOffDays}d
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* How Much Time Worked Today */}
                      <td className="px-4 py-3">
                        {emp.workedSecondsToday > 0 ? (
                          <div>
                            <div className="font-mono font-bold text-slate-900 text-sm">
                              {emp.workedFormatted}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {emp.todayBreaksCount > 0
                                ? `${emp.todayBreaksCount} break(s) (${emp.totalBreakMinutes}m)`
                                : 'No breaks taken'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">00h 00m</span>
                        )}
                      </td>

                      {/* First In / Out */}
                      <td className="px-4 py-3">
                        <div className="text-[11px]">
                          <div>
                            <span className="text-slate-400">In: </span>
                            <span className="font-semibold text-slate-800">
                              {emp.firstCheckIn
                                ? new Date(emp.firstCheckIn).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '--:--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Out: </span>
                            <span className="font-semibold text-slate-800">
                              {emp.lastCheckOut
                                ? new Date(emp.lastCheckOut).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : isWorking
                                ? 'Active'
                                : '--:--'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Punch Mode */}
                      <td className="px-4 py-3">
                        {emp.punchMode ? (
                          <span
                            title={emp.rejectionReason || emp.punchMode}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                              emp.punchMode.toUpperCase() === 'WEB'
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : emp.punchMode.toUpperCase() === 'REMOTE' || emp.punchMode.toUpperCase() === 'WFH'
                                ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
                                : emp.punchMode.toLowerCase() === 'auto_checkout'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : emp.punchMode.toLowerCase() === 'system_auto_absent'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            }`}
                          >
                            {emp.punchMode.toUpperCase() === 'WEB'
                              ? '💻 WEB'
                              : emp.punchMode.toLowerCase() === 'auto_checkout'
                              ? '🤖 Auto-Closed'
                              : emp.punchMode.toLowerCase() === 'system_auto_absent'
                              ? '⚠️ Auto-Absent'
                              : emp.punchMode.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Network & GPS */}
                      <td className="px-4 py-3">
                        <div className="text-[11px]">
                          <div className="flex items-center gap-1 text-slate-600 truncate">
                            <Wifi className="size-3 text-indigo-500 shrink-0" />
                            <span className="font-mono truncate">{emp.clientIp || 'Office Network'}</span>
                          </div>
                          {emp.isSuspicious ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200 mt-0.5">
                              <ShieldAlert className="size-3" /> Suspicious GPS
                            </span>
                          ) : (
                            <div className="text-[10px] text-slate-400 truncate">
                              {emp.assignedLocation || 'Main Office'}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {emp.isCompOffEligible && (
                            <button
                              type="button"
                              onClick={() => handleCreditCompOff(emp)}
                              disabled={creditingCompOff === emp.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                              title="Click to credit earned Comp-Off leave balance to employee"
                            >
                              <Award className="size-3" />
                              <span>{creditingCompOff === emp.id ? 'Crediting...' : `+${emp.compOffDays}d Comp-Off`}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setInspectEmployee(emp)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-purple-700 transition-colors cursor-pointer"
                          >
                            <Eye className="size-3.5" />
                            <span>Details</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          INSPECTION DRAWER / MODAL FOR SELECTED EMPLOYEE
         ========================================================================= */}
      {inspectEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-purple-700 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  {inspectEmployee.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{inspectEmployee.name}</h3>
                  <p className="text-xs text-slate-500">{inspectEmployee.employeeId} &bull; {inspectEmployee.department}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectEmployee(null)}
                className="rounded-lg p-2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-400 font-semibold uppercase text-[10px]">Today Worked Time</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {inspectEmployee.workedFormatted}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-400 font-semibold uppercase text-[10px]">Current Status</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {inspectEmployee.liveStatus}
                  </div>
                </div>
              </div>

              {/* Shift & Policy Rules Card */}
              <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950 text-xs">Shift & Policy Configuration</span>
                  {inspectEmployee.shiftInfo?.category && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      {inspectEmployee.shiftInfo.category} SHIFT
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div>
                    <span className="text-slate-400">Assigned Shift:</span>{' '}
                    <span className="font-semibold">{inspectEmployee.shiftInfo?.name || 'General Shift'} ({inspectEmployee.shiftInfo?.code || 'GS'})</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Timings:</span>{' '}
                    <span className="font-semibold">{inspectEmployee.shiftInfo?.timings || '09:30 – 18:30'}</span>
                  </div>
                  {inspectEmployee.shiftInfo?.category === 'SPLIT' && (
                    <div className="col-span-2 text-cyan-900 bg-cyan-100/60 p-2 rounded-lg">
                      🔀 <strong>Split Shift Slots:</strong> Slot 1 ({inspectEmployee.shiftInfo?.firstSlotStartTime || '10:00'}–{inspectEmployee.shiftInfo?.firstSlotEndTime || '14:00'}) & Slot 2 ({inspectEmployee.shiftInfo?.secondSlotStartTime || '17:00'}–{inspectEmployee.shiftInfo?.secondSlotEndTime || '21:00'})
                    </div>
                  )}
                </div>

                <div className="pt-1.5 border-t border-purple-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Flexi-Hours:</span>{' '}
                    <span className="font-bold text-cyan-800">{inspectEmployee.isFlexi ? 'Active (No Late Mark)' : 'Fixed Shift Window'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Overtime:</span>{' '}
                    <span className="font-bold text-indigo-800">{inspectEmployee.overtimeHours ? `+${inspectEmployee.overtimeHours}h OT Earned` : 'None'}</span>
                  </div>
                </div>

                {inspectEmployee.shortLeaveInfo && (
                  <div className="mt-1 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                    ⏱️ <strong>Approved Short-Leave Pass:</strong> {inspectEmployee.shortLeaveInfo.hours}h ({inspectEmployee.shortLeaveInfo.type || 'Permission'}) &bull; <em>{inspectEmployee.shortLeaveInfo.reason}</em>
                  </div>
                )}

                {inspectEmployee.isCompOffEligible && (
                  <div className="mt-1 flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-[11px]">
                    <div>
                      🎉 <strong>Comp-Off Earned:</strong> {inspectEmployee.compOffDays} Day credit available
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCreditCompOff(inspectEmployee)}
                      disabled={creditingCompOff === inspectEmployee.id}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer text-xs"
                    >
                      {creditingCompOff === inspectEmployee.id ? 'Crediting...' : 'Credit Balance Now'}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                <div className="font-bold text-slate-800 text-xs">Web Clock-In Access Configuration</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-700">Allow Browser Web Punch</div>
                    <div className="text-[11px] text-slate-500">Enable or disable clock-in from laptop or desktop</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleWebPunch(inspectEmployee)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      inspectEmployee.webPunchAllowed
                        ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {inspectEmployee.webPunchAllowed ? 'Enabled' : 'Restricted'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                <div className="font-bold text-slate-800 text-xs">Punch & Network Audit</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>IP Address: <span className="font-mono font-semibold">{inspectEmployee.clientIp || '127.0.0.1'}</span></div>
                  <div>Office Wi-Fi: <span className="font-semibold">{inspectEmployee.isOfficeIp ? 'Verified' : 'Remote'}</span></div>
                  <div>First In: <span className="font-semibold">{inspectEmployee.firstCheckIn ? new Date(inspectEmployee.firstCheckIn).toLocaleTimeString() : '--:--'}</span></div>
                  <div>Last Out: <span className="font-semibold">{inspectEmployee.lastCheckOut ? new Date(inspectEmployee.lastCheckOut).toLocaleTimeString() : 'Active'}</span></div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectEmployee(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
