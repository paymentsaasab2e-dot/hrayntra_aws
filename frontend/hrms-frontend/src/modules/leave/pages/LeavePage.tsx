"use client"

import * as React from 'react'
import { Button, MetricStatCard, PageHeroBanner, SectionCard } from '@hryantra/ui'
import { LeaveApplicationDrawer } from '../components/LeaveApplicationDrawer'
import { LeaveRequestsTable } from '../components/LeaveRequestsTable'
import { LeaveHistoryTable } from '../components/LeaveHistoryTable'
import { WorkWeekRosterPanel } from '../components/WorkWeekRosterPanel'
import { RosterGridPlanner } from '../components/RosterGridPlanner'
import { AccrualEngineConsole } from '../components/AccrualEngineConsole'
import { TeamCalendarView } from '../components/TeamCalendarView'
import { useStore } from '@/store/StoreProvider'
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  CalendarDays,
  Briefcase,
  XCircle,
  Sparkles,
  Settings,
  Grid,
  Zap,
} from 'lucide-react'

export function LeavePage() {
  const { leaveRequests, activeEmployeeId, hasAction, employees } = useStore()
  const [isApplyOpen, setIsApplyOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'requests' | 'history' | 'accrual' | 'calendar'>('requests')

  const canApply = hasAction('leaves_apply')
  const canApprove = hasAction('leaves_approve')

  const currentUser = employees.find((e) => e.id === activeEmployeeId)
  const firstName = currentUser?.name?.split(' ')[0] || 'Team'

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const visibleRequests = React.useMemo(() => {
    if (canApprove) return leaveRequests
    return leaveRequests.filter((r) => r.employeeId === activeEmployeeId)
  }, [activeEmployeeId, canApprove, leaveRequests])

  const myLeaves = React.useMemo(
    () => leaveRequests.filter((r) => r.employeeId === activeEmployeeId),
    [activeEmployeeId, leaveRequests]
  )

  const handleExport = () => {
    const rows = visibleRequests.map((r: any) => {
      const emp = employees.find((e) => e.id === r.employeeId)
      return {
        employee: emp?.name || r.employeeId,
        type: r.type,
        start: r.startDate,
        end: r.endDate,
        status: r.status,
        reason: String(r.reason || '').replace(/"/g, '""'),
      }
    })
    const header = 'Employee,Type,Start,End,Status,Reason'
    const body = rows
      .map((r) => `"${r.employee}","${r.type}","${r.start}","${r.end}","${r.status}","${r.reason}"`)
      .join('\n')
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leave-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = React.useMemo(() => {
    const source = canApprove ? leaveRequests : myLeaves
    return {
      total: source.length,
      pending: source.filter((r) => r.status === 'Pending').length,
      approved: source.filter((r) => r.status === 'Approved').length,
      rejected: source.filter((r) => r.status === 'Rejected').length,
    }
  }, [canApprove, leaveRequests, myLeaves])

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
      {/* Executive Top Navigation & Action Row (No redundant title) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-200/80">
        {/* Segmented View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-xs font-semibold shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 transition-all cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/70 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText className="size-3.5 text-indigo-600" />
            <span>Leave Applications & Requests</span>
            {stats.pending > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white font-bold">
                {stats.pending}
              </span>
            )}
          </button>

          {canApply && myLeaves.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/70 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Clock className="size-3.5 text-slate-500" />
              <span>My Leave History</span>
            </button>
          )}

          {canApprove && (
            <button
              type="button"
              onClick={() => setActiveTab('accrual')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 transition-all cursor-pointer ${
                activeTab === 'accrual'
                  ? 'bg-white text-teal-900 shadow-xs border border-teal-200 font-bold'
                  : 'text-teal-700 hover:text-teal-900 hover:bg-teal-100/50'
              }`}
            >
              <Zap className="size-3.5 text-amber-500" />
              <span>Accrual Engine & Plans</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white text-indigo-900 shadow-xs border border-indigo-200 font-bold'
                : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100/50'
            }`}
          >
            <CalendarDays className="size-3.5 text-indigo-500" />
            <span>Team Calendar & Who&apos;s Off</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <a
            href="/roster"
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all shadow-2xs"
          >
            <Grid className="size-3.5 text-emerald-700" />
            <span>Open Roster & Shifts</span>
          </a>
          {activeTab === 'requests' && (
            <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50">
              <Download className="size-3.5 mr-1 text-slate-500" />
              Export
            </Button>
          )}
          {canApply && (
            <Button variant="default" size="sm" onClick={() => setIsApplyOpen(true)} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs">
              Apply for Leave
            </Button>
          )}
        </div>
      </div>

      {/* Modern Compact Application Summary Pill Bar (Shown for requests view) */}
      {activeTab === 'requests' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs text-slate-600 shadow-2xs">
          <span className="font-bold text-slate-900">Application Summary:</span>
          <span>Total: <strong>{stats.total}</strong></span>
          <span className="text-slate-300">•</span>
          <span className="text-amber-700 font-medium">Pending Review: <strong>{stats.pending}</strong></span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-700 font-medium">Approved: <strong>{stats.approved}</strong></span>
          <span className="text-slate-300">•</span>
          <span className="text-rose-700 font-medium">Rejected: <strong>{stats.rejected}</strong></span>
        </div>
      )}

      {activeTab === 'requests' ? (
        <LeaveRequestsTable requests={visibleRequests} showActions={canApprove} />
      ) : activeTab === 'history' ? (
        <SectionCard title="My Leave History">
          <LeaveHistoryTable requests={myLeaves} />
        </SectionCard>
      ) : activeTab === 'calendar' ? (
        <TeamCalendarView />
      ) : (
        <AccrualEngineConsole />
      )}

      {canApply && <LeaveApplicationDrawer open={isApplyOpen} onClose={() => setIsApplyOpen(false)} />}
    </div>
  )
}

