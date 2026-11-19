"use client"
import * as React from 'react'
import { SectionCard, SeverityBadge, Button, DataTable } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { useRouter } from 'next/navigation'
import { 
  Users2, CheckSquare, AlertTriangle, Target, 
  ArrowUpRight, Bell, FileText, UserCheck, UserX, Inbox, Calendar, Sparkles, ChevronRight
} from 'lucide-react'
import { CelebrationsDashboardWidget } from '@/modules/employees/components/CelebrationsDashboardWidget'

// Locale-pinned formatters — must be identical on server and client to avoid hydration mismatch
const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

// =============================================================================
// Main Dashboard Page — Executive Modern Streamlined Layout
// =============================================================================

export default function DashboardPage() {
  const { 
    tasks, employees, performanceReviews, attendanceRecords, 
    leaveRequests, remoteRequests, currentUserRole, activeEmployeeId, notifications 
  } = useStore()
  const router = useRouter()
  const currentUser = employees.find(employee => employee.id === activeEmployeeId)
  const isAdminRole = currentUserRole === 'HR' || currentUserRole === 'Superadmin'

  // --- Common Calculations ---
  const today = new Date().toISOString().split('T')[0]
  const isTaskComplete = React.useCallback((status: string) => {
    return status === 'done' || status === 'completed'
  }, [])
  const pendingApprovalsCount = 
    leaveRequests.filter(r => r.status === 'Pending').length + 
    remoteRequests.filter(r => r.status === 'Pending').length
  
  const todayAttendance = attendanceRecords.filter(r => r.date === today)
  const presentTodayIds = new Set(todayAttendance.filter(r => r.checkIn).map(r => r.employeeId))
  const presentCount = presentTodayIds.size
  const absentCount = Math.max(employees.length - presentCount, 0)
  const pendingLeaveCount = leaveRequests.filter(r => r.status === 'Pending').length
  const attendanceRate = employees.length > 0 
    ? Math.round((presentCount / employees.length) * 100) 
    : 0

  const myTasks = tasks.filter(t => t.assignee?.id === activeEmployeeId)
  const activeTasksCount = tasks.filter(t => !isTaskComplete(t.status)).length
  const completedTasksCount = tasks.filter(t => isTaskComplete(t.status)).length
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0
  const completedReviews = performanceReviews.filter(r => r.status === 'Completed')
  const myLatestCompletedReview = [...performanceReviews]
    .filter(review => review.employeeId === activeEmployeeId && review.status === 'Completed')
    .sort((a, b) => new Date(b.managerAssessment?.submittedAt || b.selfAssessment?.submittedAt || b.cycle).getTime() - new Date(a.managerAssessment?.submittedAt || a.selfAssessment?.submittedAt || a.cycle).getTime())[0]
  const myTodayAttendance = attendanceRecords.some(record => record.employeeId === activeEmployeeId && record.date === today && !!record.checkIn)

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }, [])

  // --- Alerts / Action Items ---
  const alerts = React.useMemo(() => {
    const items: { id: string; type: string; title: string; severity: string; date: string }[] = []
    
    // Overdue Tasks
    const overdue = tasks.filter(t => !isTaskComplete(t.status) && !!t.dueDate && new Date(t.dueDate) < new Date())
    overdue.forEach(t => items.push({ id: t.id, type: 'Task', title: `Overdue: ${t.title}`, severity: 'High', date: t.dueDate }))

    // Pending Approvals (for Managers/HR)
    if (currentUserRole !== 'Employee') {
      const pendingLeave = leaveRequests.filter(r => r.status === 'Pending')
      pendingLeave.forEach(r => items.push({ id: r.id, type: 'Leave', title: `Pending Approval: ${r.type}`, severity: 'Medium', date: r.createdAt }))
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
  }, [tasks, leaveRequests, currentUserRole, isTaskComplete])

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    []
  )

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
      {/* ── 1. Clean Top Context & Action Row (No oversized double title) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {greeting}{currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : ''}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {isAdminRole ? 'HQ Operations' : currentUserRole === 'Manager' ? 'Team Pulse' : 'Personal Desk'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium truncate">
              {dateEyebrow} · Real-time workforce activity & operational controls
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push('/notifications')}
            className="text-xs h-8 px-3 border-slate-200/80 hover:bg-slate-50 font-semibold text-slate-700 shadow-2xs"
          >
            <Bell className="size-3.5 text-slate-500 mr-1.5" />
            <span>{notifications.filter(n => !n.isRead).length} Alerts</span>
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => router.push(isAdminRole ? '/employees' : '/tasks')}
            className="text-xs h-8 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-2xs"
          >
            <span>{isAdminRole ? 'Employee Directory' : 'My Tasks'}</span>
            <ArrowUpRight className="size-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* ── 2. Subtle Gradient KPI Stat Cards (Matching Celebrations Tab Style) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {isAdminRole ? (
          <>
            {/* Card 1: Total Employees (Blue) */}
            <div className="bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Total Workforce</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{employees.length}</span>
                <span className="text-[11px] text-blue-600/90 font-medium">Across organization</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Users2 className="size-5" />
              </div>
            </div>

            {/* Card 2: Present Today (Emerald / Mint) */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Present Today</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{presentCount}</span>
                <span className="text-[11px] text-emerald-700/90 font-medium">{attendanceRate}% attendance rate</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <UserCheck className="size-5" />
              </div>
            </div>

            {/* Card 3: Absent / On Leave (Rose) */}
            <div className="bg-gradient-to-br from-rose-50/90 via-white to-pink-50/40 border border-rose-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Absent / On Leave</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{absentCount}</span>
                <span className="text-[11px] text-rose-700/90 font-medium">{pendingLeaveCount} pending leave(s)</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <UserX className="size-5" />
              </div>
            </div>

            {/* Card 4: Action Items / Approvals (Amber) */}
            <div className="bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Actions</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{pendingApprovalsCount + alerts.length}</span>
                <span className="text-[11px] text-amber-700/90 font-medium">{alerts.length} action item(s)</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Inbox className="size-5" />
              </div>
            </div>
          </>
        ) : currentUserRole === 'Manager' ? (
          <>
            {/* Manager View */}
            <div className="bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Team Members</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{employees.length}</span>
                <span className="text-[11px] text-blue-600/90 font-medium">Active team roster</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Users2 className="size-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Present Today</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{presentCount}</span>
                <span className="text-[11px] text-emerald-700/90 font-medium">{attendanceRate}% attendance rate</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <UserCheck className="size-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/40 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Open Tasks</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{activeTasksCount}</span>
                <span className="text-[11px] text-indigo-600/90 font-medium">In-flight milestones</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <CheckSquare className="size-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Approvals</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{pendingApprovalsCount}</span>
                <span className="text-[11px] text-amber-700/90 font-medium">{pendingLeaveCount} leave request(s)</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Inbox className="size-5" />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Employee View */}
            <div className="bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/40 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">My Active Tasks</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{myTasks.filter(t => !isTaskComplete(t.status)).length}</span>
                <span className="text-[11px] text-indigo-600/90 font-medium">Assigned to you</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <CheckSquare className="size-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Attendance Today</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{myTodayAttendance ? 'Marked' : 'Pending'}</span>
                <span className="text-[11px] text-emerald-700/90 font-medium">{myTodayAttendance ? 'Checked in today' : 'Not punched yet'}</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <UserCheck className="size-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">My Review Score</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{myLatestCompletedReview?.metrics?.finalScore ?? 0}%</span>
                <span className="text-[11px] text-blue-600/90 font-medium">Latest appraisal</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Target className="size-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-50/90 via-white to-pink-50/40 border border-rose-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">New Alerts</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{notifications.filter(n => !n.isRead).length}</span>
                <span className="text-[11px] text-rose-700/90 font-medium">Unread updates</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Bell className="size-5" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 3. Balanced Workspace Grid (8 cols primary / 4 cols intelligence) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Primary Operational Workstream (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          
          {/* Priority Action Items */}
          <SectionCard 
            title="Priority Actions & Approvals" 
            titleAction={
              <span className="text-xs font-semibold text-slate-500">
                {alerts.length} actionable item{alerts.length === 1 ? '' : 's'}
              </span>
            }
          >
            <div className="flex flex-col divide-y divide-slate-100">
              {alerts.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs font-medium">
                  ✓ All systems clear. No urgent action items pending.
                </div>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                        alert.severity === 'High' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        <AlertTriangle className="size-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate">{alert.title}</span>
                        <span className="text-[11px] text-slate-400">
                          {alert.type} · Due {formatDate(alert.date)}
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="xs"
                      onClick={() => router.push(alert.type === 'Leave' ? '/leave' : '/tasks')}
                      className="ml-3 shrink-0 text-[11px] h-7 px-2.5"
                    >
                      Review
                    </Button>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* Activity / Workforce Table */}
          <SectionCard 
            title={isAdminRole ? "Active Workforce Snapshot" : "Active Milestones"}
            noPadding
            titleAction={
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => router.push(isAdminRole ? '/employees' : '/tasks')} 
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-0 h-auto"
              >
                View All {isAdminRole ? 'Employees' : 'Tasks'} <ArrowUpRight className="size-3.5 ml-1" />
              </Button>
            }
          >
            {isAdminRole ? (
              <DataTable<any> 
                data={employees.slice(0, 6)}
                columns={[
                  { 
                    id: 'employee', 
                    accessorKey: 'name', 
                    header: 'Employee', 
                    cell: ({ row }) => {
                      const name = row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Employee'
                      const initials = name
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()
                      return (
                        <div className="flex items-center gap-2.5 py-1">
                          <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-2xs shrink-0">
                            {initials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-900 truncate">{name}</span>
                            <span className="text-[11px] text-slate-400 font-medium truncate">{row.email || row.id}</span>
                          </div>
                        </div>
                      )
                    }
                  },
                  { 
                    id: 'designation', 
                    accessorKey: 'designation', 
                    header: 'Role & Dept',
                    cell: ({ row }) => (
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-800 truncate">{row.designation || 'Specialist'}</span>
                        <span className="text-[11px] text-slate-400 font-medium truncate">{row.department || 'General'}</span>
                      </div>
                    )
                  },
                  { 
                    id: 'status', 
                    accessorKey: 'status', 
                    header: 'Status', 
                    cell: ({ row }) => (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        row.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                          : row.status === 'On Leave'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        <span className={`size-1.5 rounded-full ${
                          row.status === 'Active' ? 'bg-emerald-500' : row.status === 'On Leave' ? 'bg-amber-500' : 'bg-slate-400'
                        }`} />
                        {row.status}
                      </span>
                    )
                  },
                  {
                    id: 'actions',
                    header: '',
                    width: 70,
                    cell: ({ row }) => (
                      <div className="flex items-center justify-end pr-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => router.push(`/employees/${row.id}`)}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/60 h-7 px-2"
                        >
                          View <ChevronRight className="size-3 ml-0.5" />
                        </Button>
                      </div>
                    )
                  }
                ]}
                keyExtractor={(r) => r.id}
              />
            ) : (
              <DataTable<any>
                data={tasks.filter(t => !isTaskComplete(t.status)).slice(0, 6)}
                columns={[
                  { 
                    id: 'title', 
                    accessorKey: 'title', 
                    header: 'Task Name', 
                    cell: ({ row }) => (
                      <div className="flex flex-col min-w-0 py-1">
                        <span className="text-xs font-bold text-slate-900 truncate">{row.title}</span>
                        {row.dueDate && (
                          <span className="text-[11px] text-slate-400 font-medium">Due {formatDate(row.dueDate)}</span>
                        )}
                      </div>
                    )
                  },
                  { 
                    id: 'assignee', 
                    accessorKey: 'assignee.name', 
                    header: 'Assignee',
                    cell: ({ row }) => (
                      <span className="text-xs font-medium text-slate-700">{row.assignee?.name || 'Unassigned'}</span>
                    )
                  },
                  { 
                    id: 'priority', 
                    accessorKey: 'priority', 
                    header: 'Priority', 
                    cell: ({ row }) => (
                      <SeverityBadge level={row.priority ? (row.priority.charAt(0).toUpperCase() + row.priority.slice(1)) : 'Medium'} />
                    )
                  },
                  { 
                    id: 'status', 
                    accessorKey: 'status', 
                    header: 'Status', 
                    cell: ({ row }) => (
                      <span className="capitalize text-xs font-semibold text-slate-600">{row.status?.replace('_', ' ')}</span>
                    )
                  }
                ]}
                keyExtractor={(r) => r.id}
              />
            )}
          </SectionCard>
        </div>

        {/* Right Column: Intelligence & Launchpad (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Celebrations & Milestones */}
          <CelebrationsDashboardWidget />

          {/* Operational Summary */}
          <SectionCard title="Operational Health">
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5 pb-3 border-b border-slate-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">Daily Attendance Rate</span>
                  <span className="font-bold text-slate-900">{attendanceRate}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${attendanceRate}%` }} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pb-3 border-b border-slate-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">Task Completion Rate</span>
                  <span className="font-bold text-slate-900">{taskCompletionRate}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${taskCompletionRate}%` }} />
                </div>
              </div>

              <div className="flex justify-between items-center text-xs pt-0.5">
                <span className="font-semibold text-slate-600">Completed Performance Reviews</span>
                <span className="font-bold text-slate-900">{completedReviews.length}</span>
              </div>
            </div>
          </SectionCard>

          {/* Quick Actions Launchpad */}
          <SectionCard title="Quick Actions">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push('/leave')} className="justify-start text-xs font-semibold h-8.5">
                <Calendar className="size-3.5 mr-1.5 text-indigo-600" />
                Apply Leave
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/attendance')} className="justify-start text-xs font-semibold h-8.5">
                <UserCheck className="size-3.5 mr-1.5 text-emerald-600" />
                Time Logs
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/documents')} className="justify-start text-xs font-semibold h-8.5">
                <FileText className="size-3.5 mr-1.5 text-blue-600" />
                Documents
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/org-chart')} className="justify-start text-xs font-semibold h-8.5">
                <Users2 className="size-3.5 mr-1.5 text-purple-600" />
                Org Chart
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
