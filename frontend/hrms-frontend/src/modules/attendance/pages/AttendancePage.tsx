"use client"
import * as React from 'react'
import { PageHeroBanner, Button, SectionCard, StatusBadge, MetricStatCard } from '@hryantra/ui'
import { AttendanceDashboard } from '../components/AttendanceDashboard'
import { WebClockInDashboardCard } from '../components/WebClockInDashboardCard'
import { LiveEmployeeAttendanceMonitor } from '../components/LiveEmployeeAttendanceMonitor'
import { AttendanceCalendar } from '../components/AttendanceCalendar'
import { AttendanceLogsDashboard } from '../components/AttendanceLogsDashboard'
import { ApprovalPanel } from '../components/ApprovalPanel'
import { RemoteRequestForm } from '../components/RemoteRequestForm'
import { BulkAttendanceImportModal } from '../components/BulkAttendanceImportModal'
import { useStore, CURRENT_USER_ID } from '@/store/StoreProvider'
import { getCurrentPosition } from '@/shared/geolocation'
import { getOutsideAreaWarning } from '@/shared/geo'
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  Play,
  UserRound,
  LayoutDashboard,
  ShieldAlert,
  Home,
  Briefcase,
  Laptop,
  FileSpreadsheet,
} from 'lucide-react'
import { useDataSync } from '@/shared/events'

export function AttendancePage() {
  const { attendanceRecords, remoteRequests, leaveRequests, employees, currentUserRole, activeEmployeeId, checkIn, checkOut, workLocation, permissions } = useStore()
  const [geoWarning, setGeoWarning] = React.useState<string | null>(null)
  const [isRequestOpen, setIsRequestOpen] = React.useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState(CURRENT_USER_ID)
  const [isSelfPanelOpen, setIsSelfPanelOpen] = React.useState(currentUserRole === 'Employee')
  const [hrTab, setHrTab] = React.useState<'live-monitor' | 'logs'>('live-monitor')
  const [isBulkImportOpen, setIsBulkImportOpen] = React.useState(false)

  const isHrUser = currentUserRole === 'HR' || currentUserRole === 'Superadmin' || currentUserRole === 'Manager'
  const canReviewApprovals = currentUserRole !== 'Employee'
  const todayDate = new Date().toLocaleDateString('en-CA')

  React.useEffect(() => {
    if (currentUserRole === 'Employee') {
      setIsSelfPanelOpen(true)
    }
  }, [currentUserRole])

  React.useEffect(() => {
    if (!workLocation) {
      setGeoWarning(null)
      return
    }

    getCurrentPosition()
      .then((coords) => {
        const warning = getOutsideAreaWarning(
          coords.lat,
          coords.lng,
          workLocation.lat,
          workLocation.lng,
          workLocation.radiusMeters,
          workLocation.name,
          permissions.actions.attendance_punch_remote_self === true
        )
        setGeoWarning(warning)
      })
      .catch(() => setGeoWarning(null))
  }, [workLocation])

  const currentEmployeeId = React.useMemo(() => {
    if (employees.some(employee => employee.id === activeEmployeeId)) return activeEmployeeId
    return employees[0]?.id || CURRENT_USER_ID
  }, [activeEmployeeId, employees])

  React.useEffect(() => {
    if (employees.length === 0) return
    const hasSelectedEmployee = employees.some(employee => employee.id === selectedEmployeeId)
    if (!hasSelectedEmployee) {
      setSelectedEmployeeId(employees[0].id)
    }
  }, [employees, selectedEmployeeId])

  const selectedEmployee = employees.find(employee => employee.id === selectedEmployeeId)
  const selfEmployee = employees.find(employee => employee.id === currentEmployeeId)

  const selfLogs = React.useMemo(() => {
    return attendanceRecords.filter(record => record.employeeId === currentEmployeeId)
  }, [attendanceRecords, currentEmployeeId])

  const selectedOpenRecord = React.useMemo(() => {
    return [...attendanceRecords]
      .filter(record => record.employeeId === selectedEmployeeId && record.date === todayDate && !record.checkOut)
      .sort((a, b) => new Date(b.checkIn || b.date).getTime() - new Date(a.checkIn || a.date).getTime())[0]
  }, [attendanceRecords, selectedEmployeeId, todayDate])

  const selfTodayRecord = React.useMemo(() => {
    return [...attendanceRecords]
      .filter(record => record.employeeId === currentEmployeeId && record.date === todayDate)
      .sort((a, b) => new Date(b.checkIn || b.date).getTime() - new Date(a.checkIn || a.date).getTime())[0]
  }, [attendanceRecords, currentEmployeeId, todayDate])

  const isTodayWfh = React.useMemo(() => {
    return (
      remoteRequests.some((r) => {
        if (r.status !== 'Approved') return false
        if (r.employeeId !== currentEmployeeId) return false
        const isWfh = r.type === 'WFH' || (!r.type && r.location?.toLowerCase().includes('home'))
        if (!isWfh) return false
        const sDate = r.startDate || r.date
        const eDate = r.endDate || sDate
        return todayDate >= sDate && todayDate <= eDate
      }) ||
      selfTodayRecord?.flags?.includes('wfh') ||
      selfTodayRecord?.location?.toLowerCase().includes('home') ||
      false
    )
  }, [remoteRequests, currentEmployeeId, todayDate, selfTodayRecord])

  const isTodayOd = React.useMemo(() => {
    return (
      remoteRequests.some((r) => {
        if (r.status !== 'Approved') return false
        if (r.employeeId !== currentEmployeeId) return false
        if (r.type !== 'ON_DUTY') return false
        const sDate = r.startDate || r.date
        const eDate = r.endDate || sDate
        return todayDate >= sDate && todayDate <= eDate
      }) ||
      selfTodayRecord?.flags?.includes('on_duty') ||
      false
    )
  }, [remoteRequests, currentEmployeeId, todayDate, selfTodayRecord])

  const todayLeave = React.useMemo(() => {
    return leaveRequests.find((l) => {
      const isApproved = l.status === 'Approved' || (l.status as string) === 'APPROVED'
      if (!isApproved) return false
      if (currentEmployeeId && l.employeeId !== currentEmployeeId) return false
      const sDate = (l.startDate || '').slice(0, 10)
      const eDate = (l.endDate || sDate).slice(0, 10)
      return todayDate >= sDate && todayDate <= eDate
    })
  }, [leaveRequests, currentEmployeeId, todayDate])

  const todayDisplayStatus = todayLeave
    ? `On Leave (${todayLeave.type})`
    : isTodayWfh
    ? 'Work From Home (Approved)'
    : isTodayOd
    ? 'On-Duty (Approved)'
    : selfTodayRecord?.status || 'Not Marked'

  const pendingLateApprovals = React.useMemo(() => {
    return attendanceRecords.filter(record =>
      record.date === todayDate &&
      record.status === 'Late' &&
      (record.approvalStatus === undefined || record.approvalStatus === 'Pending')
    ).length
  }, [attendanceRecords, todayDate])

  const now = new Date()
  const monthlySelfRecords = React.useMemo(() => {
    return selfLogs.filter(record => {
      const recordDate = new Date(record.date)
      return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear()
    })
  }, [selfLogs, now])

  const selfPresentDays = monthlySelfRecords.filter(record => ['Present', 'Late', 'Half-day'].includes(record.status)).length
  const selfLateDays = monthlySelfRecords.filter(record => record.status === 'Late').length
  const selfPendingApprovals = selfLogs.filter(record => record.approvalStatus === 'Pending').length
  const noEmployees = employees.length === 0

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const todayStats = React.useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA')
    const todayRecords = attendanceRecords.filter((record) => record.date === today)
    const accepted = todayRecords.filter(
      (r) => r.punchStatus === 'Accepted' || (!r.punchStatus && r.status !== 'Absent')
    ).length
    const active = todayRecords.filter((r) => r.isActive && r.punchStatus !== 'Rejected').length
    return {
      total: todayRecords.length,
      accepted,
      active,
      label: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    }
  }, [attendanceRecords])

  if (isSelfPanelOpen) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6">
        <section className="flex flex-col gap-4">
          <PageHeroBanner
            compact
            eyebrow={dateEyebrow}
            title="My Attendance"
            description="Review your punch history, calendar, and daily status."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {currentUserRole !== 'Employee' && (
                  <Button variant="outline" onClick={() => setIsSelfPanelOpen(false)}>
                    <LayoutDashboard className="size-4" />
                    Back to Overview
                  </Button>
                )}
                <Button variant="default" onClick={() => setIsRequestOpen(true)}>
                  <Home className="size-4 mr-1.5" />
                  Attendance Requests (WFH / OD / Regularize)
                </Button>
              </div>
            }
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricStatCard
              label="Today's Status"
              value={todayDisplayStatus}
              subtitle={selfEmployee?.name || currentEmployeeId}
              tone={isTodayWfh ? 'blue' : isTodayOd ? 'indigo' : 'lavender'}
              icon={isTodayWfh ? Home : isTodayOd ? Briefcase : CheckCircle2}
            />
            <MetricStatCard
              label="Check In"
              value={
                selfTodayRecord?.checkIn
                  ? new Date(selfTodayRecord.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                  : '--:--'
              }
              subtitle="First punch for today"
              tone="blue"
              icon={LogIn}
            />
            <MetricStatCard
              label="Monthly Present Days"
              value={selfPresentDays}
              subtitle={`${selfLateDays} late mark${selfLateDays === 1 ? '' : 's'} this month`}
              tone="mint"
              icon={BarChart3}
            />
            <MetricStatCard
              label="Pending Approvals"
              value={selfPendingApprovals}
              subtitle="Awaiting HR review"
              tone="amber"
              icon={Clock3}
            />
          </div>
        </section>

        {geoWarning && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{geoWarning}</span>
          </div>
        )}

        <WebClockInDashboardCard />

        <AttendanceDashboard employeeId={currentEmployeeId} employeeName={selfEmployee?.name} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <AttendanceCalendar records={selfLogs} employeeId={currentEmployeeId} />
          <SectionCard title="Today's Summary">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {isTodayWfh ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold bg-cyan-100 text-cyan-900 border border-cyan-300 shadow-xs">
                    <Home className="size-3.5 text-cyan-700" />
                    Work From Home (Approved)
                  </span>
                ) : isTodayOd ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-xs">
                    <Briefcase className="size-3.5 text-indigo-700" />
                    On-Duty (Approved)
                  </span>
                ) : (
                  <StatusBadge status={selfTodayRecord?.status || 'Not Marked'} />
                )}
                {selfTodayRecord?.approvalStatus ? <StatusBadge status={selfTodayRecord.approvalStatus} /> : null}
              </div>
              <p className="text-ds-body-sm text-ds-neutral-600">
                {isTodayWfh
                  ? 'Your Work From Home request is approved for today. This day is registered as WFH in your monthly muster roll and counts as a worked present day.'
                  : isTodayOd
                  ? 'Your On-Duty (OD) request is approved for today. This day is counted as a payable present day in the muster roll.'
                  : selfTodayRecord?.approvalRemark || 'No approval note for today.'}
              </p>
              <div className="flex items-center gap-2 text-ds-brand-navy pt-2">
                <Clock3 className="size-4" />
                <span className="text-ds-body-sm font-semibold">{monthlySelfRecords.length} entries this month</span>
              </div>
            </div>
          </SectionCard>
        </div>

        <AttendanceLogsDashboard
          records={selfLogs}
          showEmployeeColumn={false}
          title="My Attendance Logs"
          description="Your punch-in / punch-out history with location and duration."
          showExport={false}
        />

        <RemoteRequestForm open={isRequestOpen} onClose={() => setIsRequestOpen(false)} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
      {/* Executive Top Navigation & Action Row (No double title) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200/80">
        {/* HR View Switcher: Live Monitor vs Logs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-xs font-semibold w-fit shadow-2xs">
          <button
            type="button"
            onClick={() => setHrTab('live-monitor')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 transition-all cursor-pointer ${
              hrTab === 'live-monitor'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/70 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Laptop className="size-3.5 text-indigo-600" />
            <span>Live Web Punch & Who&apos;s In</span>
            <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-1.5 py-0.2 text-[10px] font-bold">
              Live
            </span>
          </button>

          <button
            type="button"
            onClick={() => setHrTab('logs')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 transition-all cursor-pointer ${
              hrTab === 'logs'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/70 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <BarChart3 className="size-3.5 text-slate-500" />
            <span>Attendance History Logs</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={() => setIsSelfPanelOpen(true)} className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50">
            <UserRound className="size-3.5 mr-1 text-slate-500" />
            My Attendance
          </Button>
          <Button variant="default" size="sm" onClick={() => setIsRequestOpen(true)} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs">
            <Home className="size-3.5 mr-1.5" />
            Attendance Requests (WFH / OD / Regularize)
          </Button>
          {isHrUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkImportOpen(true)}
              className="h-8 text-xs border-indigo-200 bg-indigo-50/60 text-indigo-800 hover:bg-indigo-100 font-semibold"
            >
              <FileSpreadsheet className="size-3.5 mr-1 text-indigo-600" />
              Bulk Import & Corrections
            </Button>
          )}
        </div>
      </div>

      {isHrUser && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-indigo-500" />
              <div>
                <h3 className="text-xs font-bold text-slate-900">HR Direct Punch Controls</h3>
                <p className="text-[11px] text-slate-500">Record a punch-in or punch-out on behalf of an active employee.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <select
                className="min-w-48 h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none"
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                disabled={noEmployees}
              >
                {noEmployees && <option value="">No employees available</option>}
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.id})
                  </option>
                ))}
              </select>
              <Button variant="default" size="sm" onClick={() => checkIn('office', undefined, selectedEmployeeId)} disabled={noEmployees} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs">
                <LogIn className="size-3.5 mr-1" />
                Punch In
              </Button>
              <Button
                variant="destructive-outline"
                size="sm"
                onClick={() => checkOut(selectedEmployeeId)}
                disabled={!selectedOpenRecord || noEmployees}
                className="h-8 text-xs"
              >
                <LogOut className="size-3.5 mr-1" />
                Punch Out
              </Button>
            </div>
          </div>
          {!noEmployees && (
            <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${selectedOpenRecord ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {selectedOpenRecord
                ? `${selectedEmployee?.name || selectedEmployeeId} is currently punched in.`
                : `${selectedEmployee?.name || selectedEmployeeId} has no open session today.`}
            </div>
          )}
        </div>
      )}

      {canReviewApprovals && pendingLateApprovals > 0 && <ApprovalPanel />}

      {hrTab === 'live-monitor' ? (
        <LiveEmployeeAttendanceMonitor />
      ) : (
        <AttendanceLogsDashboard
          records={attendanceRecords}
          showEmployeeColumn
          title=""
          description=""
        />
      )}

      <RemoteRequestForm open={isRequestOpen} onClose={() => setIsRequestOpen(false)} />
      <BulkAttendanceImportModal open={isBulkImportOpen} onClose={() => setIsBulkImportOpen(false)} />
    </div>
  )
}
