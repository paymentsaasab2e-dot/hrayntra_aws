"use client"

import * as React from 'react'
import { Button, SectionCard } from '@hryantra/ui'
import { api } from '@/shared/api'
import { ApproverDelegationModal } from '@/modules/approvals/components/ApproverDelegationModal'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserCheck,
  Users,
  Sun,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Umbrella,
} from 'lucide-react'

export function TeamCalendarView() {
  const [year, setYear] = React.useState<number>(new Date().getFullYear())
  const [month, setMonth] = React.useState<number>(new Date().getMonth() + 1)
  const [department, setDepartment] = React.useState<string>('ALL')
  const [calendarData, setCalendarData] = React.useState<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDelegationOpen, setIsDelegationOpen] = React.useState(false)

  const fetchCalendar = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await api.leaves.getTeamCalendar({
        year,
        month,
        department: department !== 'ALL' ? department : undefined,
      })
      if (res?.success) {
        setCalendarData(res.data)
      }
    } catch (err: any) {
      console.error('Error fetching team calendar:', err)
    } finally {
      setIsLoading(false)
    }
  }, [year, month, department])

  React.useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' })

  return (
    <div className="space-y-6">
      {/* Top Controls & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-ds-brand-navy text-sm">Team Calendar & Availability</h3>
            <p className="text-xs text-slate-500">Track department leaves, who is off today, and manage approval delegations</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white rounded text-slate-700 transition-all cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-bold text-slate-900 px-2 min-w-28 text-center">
              {monthName} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white rounded text-slate-700 transition-all cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Department Filter */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {calendarData?.departments?.map((dept: string) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Delegate Approver Button */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsDelegationOpen(true)}
            className="gap-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold h-9 text-xs"
          >
            <UserCheck className="size-4" />
            Delegate Approver
          </Button>

          <button
            type="button"
            onClick={fetchCalendar}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
            title="Refresh Calendar"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Team Size</span>
            <Users className="size-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{calendarData?.summary?.totalEmployees || 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Active in {department === 'ALL' ? 'company' : department}</p>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">Off Today</span>
            <Umbrella className="size-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-950 mt-1">{calendarData?.summary?.offTodayCount || 0}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Leaves, holidays & week offs</p>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-bold uppercase tracking-wider">On Approved Leave</span>
            <CheckCircle2 className="size-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-950 mt-1">{calendarData?.summary?.onLeaveTodayCount || 0}</p>
          <p className="text-[11px] text-blue-700 mt-0.5">Approved out of office today</p>
        </div>

        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 shadow-2xs">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-bold uppercase tracking-wider">Month Total Leaves</span>
            <CalendarDays className="size-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-950 mt-1">{calendarData?.summary?.upcomingLeavesCount || 0}</p>
          <p className="text-[11px] text-purple-700 mt-0.5">Total scheduled in {monthName}</p>
        </div>
      </div>

      {/* Who is Off Today Highlight Box */}
      {calendarData?.summary?.onLeaveToday?.length > 0 && (
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-2">
              <Sun className="size-4 text-amber-500" />
              Who is on Leave Today ({calendarData.todayStr})
            </h4>
            <span className="text-xs font-bold text-indigo-700">
              {calendarData.summary.onLeaveToday.length} Colleagues
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {calendarData.summary.onLeaveToday.map((person: any) => (
              <div
                key={person.employeeId}
                className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 shadow-2xs flex items-center gap-2 text-xs"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                  {person.name.charAt(0)}
                </div>
                <div>
                  <span className="font-bold text-slate-900">{person.name}</span>
                  <span className="text-slate-500 ml-1">({person.department})</span>
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    {person.leaveType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Interactive Calendar Grid */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-xs text-slate-900">
              {monthName} {year} Department Availability Grid
            </h4>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" /> Present / Working
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-purple-600" /> Approved Leave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" /> Pending Approval
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-slate-300" /> Week Off
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500" /> Holiday
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="sticky left-0 bg-slate-100 z-10 px-3 py-2.5 font-bold min-w-44 border-r border-slate-200">
                  Employee
                </th>
                {calendarData?.daysHeader?.map((d: any) => (
                  <th
                    key={d.day}
                    className={`px-1.5 py-2 text-center font-bold min-w-8 border-r border-slate-200/60 ${
                      d.isToday
                        ? 'bg-indigo-600 text-white font-black'
                        : d.isHoliday
                        ? 'bg-rose-50 text-rose-800'
                        : d.isWeekOff
                        ? 'bg-slate-200/60 text-slate-600'
                        : 'text-slate-700'
                    }`}
                  >
                    <div className="text-[10px] leading-none uppercase">{d.dayName.slice(0, 2)}</div>
                    <div className="text-xs mt-0.5 leading-none">{d.day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calendarData?.calendar?.map((item: any) => (
                <tr key={item.employee.id} className="hover:bg-slate-50/50">
                  <td className="sticky left-0 bg-white hover:bg-slate-50 z-10 px-3 py-2 border-r border-slate-200">
                    <p className="font-bold text-slate-900 leading-tight">{item.employee.name}</p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      {item.employee.employeeCode} · {item.employee.department}
                    </p>
                  </td>
                  {item.days?.map((d: any) => {
                    const isToday = d.date === calendarData.todayStr
                    return (
                      <td
                        key={d.day}
                        className={`p-1 text-center border-r border-slate-100 ${
                          isToday
                            ? 'bg-indigo-50/30'
                            : d.status === 'WEEK_OFF'
                            ? 'bg-slate-50/60'
                            : d.status === 'HOLIDAY'
                            ? 'bg-rose-50/30'
                            : ''
                        }`}
                        title={
                          d.status === 'LEAVE'
                            ? `Leave: ${d.leaveType} (${d.reason || 'Approved'})`
                            : d.status === 'PENDING_LEAVE'
                            ? `Pending Leave: ${d.leaveType}`
                            : d.status === 'HOLIDAY'
                            ? `Holiday: ${d.holidayName}`
                            : d.status === 'WEEK_OFF'
                            ? 'Scheduled Weekly Off'
                            : 'Working Day'
                        }
                      >
                        {d.status === 'LEAVE' ? (
                          <span className="inline-flex items-center justify-center size-6 rounded bg-purple-600 text-white font-black text-[9px] shadow-2xs">
                            {d.leaveType?.slice(0, 2) || 'LV'}
                          </span>
                        ) : d.status === 'PENDING_LEAVE' ? (
                          <span className="inline-flex items-center justify-center size-6 rounded bg-amber-500 text-white font-black text-[9px] shadow-2xs">
                            ?
                          </span>
                        ) : d.status === 'HOLIDAY' ? (
                          <span className="inline-flex items-center justify-center size-6 rounded bg-rose-100 text-rose-800 font-bold text-[9px]">
                            H
                          </span>
                        ) : d.status === 'WEEK_OFF' ? (
                          <span className="text-slate-300 font-bold text-[10px]">WO</span>
                        ) : (
                          <span className="text-slate-200">•</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approver Delegation Drawer */}
      <ApproverDelegationModal
        open={isDelegationOpen}
        onClose={() => setIsDelegationOpen(false)}
        onSuccess={fetchCalendar}
      />
    </div>
  )
}
