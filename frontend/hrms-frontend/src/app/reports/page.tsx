"use client"

import * as React from 'react'
import {
  PageHeroBanner,
  SectionCard,
  Button,
  DataTable,
  Input,
  Select,
  StatusBadge,
  SeverityBadge,
  MetricStatCard,
} from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Clock,
  Download,
  Search,
  Target,
  TrendingUp,
  Users,
  XCircle,
  CheckCircle2,
} from 'lucide-react'
import { EmployeeMonthlyAttendanceReport } from '@/modules/reports/components/EmployeeMonthlyAttendanceReport'
import { TeamAttendanceMusterRoll } from '@/modules/reports/components/TeamAttendanceMusterRoll'
import {
  buildMonthlyAttendanceReport,
  defaultMonthYear,
  monthYearFromInput,
} from '@/modules/reports/utils/monthlyAttendanceReport'
import { PerformanceCycle } from '@/modules/performance/types'

type ReportType = 'attendance' | 'performance' | 'tasks' | 'leave'

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

function currentQuarterCycle() {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  return `${now.getFullYear()}-Q${quarter}`
}

export default function ReportsPage() {
  const {
    employees,
    tasks,
    attendanceRecords,
    leaveRequests,
    remoteRequests,
    performanceReviews,
    currentUserRole,
    hasAction,
  } = useStore()

  const canViewReports = currentUserRole === 'HR' || hasAction('reports_view')

  const [activeTab, setActiveTab] = React.useState<ReportType>('attendance')
  const [attendanceViewMode, setAttendanceViewMode] = React.useState<'muster' | 'single'>('muster')
  const [dateRange, setDateRange] = React.useState({ start: '', end: '' })
  const [selectedEmployee, setSelectedEmployee] = React.useState('All')
  const [searchTerm, setSearchTerm] = React.useState('')
  const [reportMonth, setReportMonth] = React.useState(defaultMonthYear())
  const [monthlyEmployeeId, setMonthlyEmployeeId] = React.useState('')
  const [perfCycle, setPerfCycle] = React.useState(currentQuarterCycle())
  const [perfCycleType, setPerfCycleType] = React.useState<PerformanceCycle>('quarterly')

  React.useEffect(() => {
    if (employees.length > 0 && !monthlyEmployeeId) {
      setMonthlyEmployeeId(employees[0].id)
    }
  }, [employees, monthlyEmployeeId])

  const tabs = [
    { id: 'attendance' as const, label: 'Attendance', icon: Clock },
    { id: 'performance' as const, label: 'Performance', icon: Target },
    { id: 'tasks' as const, label: 'Tasks', icon: CheckSquare },
    { id: 'leave' as const, label: 'Leave', icon: CalendarDays },
  ]

  const attendanceData = React.useMemo(() => {
    return attendanceRecords
      .filter((r) => {
        const emp = employees.find((e) => e.id === r.employeeId)
        const matchesSearch =
          emp?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesEmp = selectedEmployee === 'All' || r.employeeId === selectedEmployee
        const matchesStart = !dateRange.start || r.date >= dateRange.start
        const matchesEnd = !dateRange.end || r.date <= dateRange.end
        return matchesSearch && matchesEmp && matchesStart && matchesEnd
      })
      .map((r) => ({
        ...r,
        employeeName: employees.find((e) => e.id === r.employeeId)?.name || 'Unknown',
      }))
  }, [attendanceRecords, employees, searchTerm, selectedEmployee, dateRange])

  const monthlyEmployee = employees.find((e) => e.id === monthlyEmployeeId)

  const monthlyReport = React.useMemo(() => {
    if (!monthlyEmployeeId) return null
    const { year, month } = monthYearFromInput(reportMonth)
    const empRecords = attendanceRecords.filter((r) => r.employeeId === monthlyEmployeeId)
    const empLeaves = leaveRequests.filter((l) => l.employeeId === monthlyEmployeeId)
    const empRemote = remoteRequests.filter((r) => r.employeeId === monthlyEmployeeId)
    return buildMonthlyAttendanceReport({
      year,
      month,
      records: empRecords,
      leaves: empLeaves,
      remoteRequests: empRemote,
    })
  }, [attendanceRecords, leaveRequests, remoteRequests, monthlyEmployeeId, reportMonth])

  const monthLabel = React.useMemo(() => {
    const { year, month } = monthYearFromInput(reportMonth)
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [reportMonth])

  const attendanceKPIs = React.useMemo(() => {
    const total = attendanceData.length
    const present = attendanceData.filter((r) => ['Present', 'Late', 'Half-day'].includes(r.status)).length
    const late = attendanceData.filter((r) => r.status === 'Late').length
    const absent = attendanceData.filter((r) => r.status === 'Absent').length
    return [
      { label: 'Total Records', value: total, subtitle: 'Filtered punch logs', tone: 'blue' as const, icon: Users },
      { label: 'Present', value: present, subtitle: 'On-time & late', tone: 'mint' as const, icon: CheckCircle2 },
      { label: 'Late Marks', value: late, subtitle: 'Needs review', tone: 'amber' as const, icon: Clock },
      { label: 'Absent', value: absent, subtitle: 'No punch recorded', tone: 'rose' as const, icon: XCircle },
    ]
  }, [attendanceData])

  const taskData = React.useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assignee.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesEmp = selectedEmployee === 'All' || t.assignee.id === selectedEmployee
      return matchesSearch && matchesEmp
    })
  }, [tasks, searchTerm, selectedEmployee])

  const taskKPIs = React.useMemo(() => {
    const total = taskData.length
    const completed = taskData.filter((t) => t.status === 'completed').length
    const overdue = taskData.filter(
      (t) => t.status !== 'completed' && new Date(t.dueDate) < new Date()
    ).length
    const rate = total ? Math.round((completed / total) * 100) : 0
    return [
      { label: 'Total Tasks', value: total, subtitle: 'In scope', tone: 'blue' as const, icon: CheckSquare },
      { label: 'Completion Rate', value: `${rate}%`, subtitle: `${completed} done`, tone: 'mint' as const, icon: BarChart3 },
      { label: 'Overdue', value: overdue, subtitle: 'Past due date', tone: 'rose' as const, icon: TrendingUp },
      { label: 'In Progress', value: total - completed, subtitle: 'Open tasks', tone: 'amber' as const, icon: Clock },
    ]
  }, [taskData])

  const performanceData = React.useMemo(() => {
    return performanceReviews
      .filter((r) => {
        const emp = employees.find((e) => e.id === r.employeeId)
        const matchesSearch = emp?.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesEmp = selectedEmployee === 'All' || r.employeeId === selectedEmployee
        const matchesCycle = r.cycle === perfCycle && r.cycleType === perfCycleType
        return matchesSearch && matchesEmp && matchesCycle
      })
      .map((r) => ({
        ...r,
        employeeName: employees.find((e) => e.id === r.employeeId)?.name || 'Unknown',
        period: `${r.cycle} (${r.cycleType})`,
        displayScore:
          r.status === 'Completed'
            ? r.metrics.finalScore
            : r.metrics.breakdown?.provisionalScore || r.metrics.finalScore || 0,
        onTimeRate: r.metrics.breakdown?.task?.onTimeRate ?? null,
      }))
  }, [performanceReviews, employees, searchTerm, selectedEmployee, perfCycle, perfCycleType])

  const performanceKPIs = React.useMemo(() => {
    const total = performanceData.length
    const avgScore = total
      ? Math.round(performanceData.reduce((acc, r) => acc + (r.displayScore || 0), 0) / total)
      : 0
    const completed = performanceData.filter((r) => r.status === 'Completed').length
    const topPerformers = performanceData.filter((r) => (r.displayScore || 0) >= 90).length
    const avgOnTime = total
      ? Math.round(performanceData.reduce((acc, r) => acc + (r.onTimeRate || 0), 0) / total)
      : 0
    return [
      { label: 'Reviews', value: total, subtitle: `${perfCycle} · ${perfCycleType}`, tone: 'blue' as const, icon: Target },
      { label: 'Avg Score', value: avgScore, subtitle: 'Out of 100', tone: 'mint' as const, icon: BarChart3 },
      { label: 'Avg On-time', value: `${avgOnTime}%`, subtitle: 'Task delivery', tone: 'indigo' as const, icon: Users },
      { label: 'Top Performers', value: topPerformers, subtitle: 'Score ≥ 90', tone: 'lavender' as const, icon: TrendingUp },
      { label: 'Completed', value: completed, subtitle: 'Finalized reviews', tone: 'amber' as const, icon: CheckCircle2 },
    ]
  }, [performanceData, perfCycle, perfCycleType])

  const leaveData = React.useMemo(() => {
    return leaveRequests
      .filter((r) => {
        const emp = employees.find((e) => e.id === r.employeeId)
        const matchesSearch = emp?.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesEmp = selectedEmployee === 'All' || r.employeeId === selectedEmployee
        return matchesSearch && matchesEmp
      })
      .map((r) => ({
        ...r,
        employeeName: employees.find((e) => e.id === r.employeeId)?.name || 'Unknown',
      }))
  }, [leaveRequests, employees, searchTerm, selectedEmployee])

  const leaveKPIs = React.useMemo(() => {
    const total = leaveData.length
    const approved = leaveData.filter((r) => r.status === 'Approved').length
    const pending = leaveData.filter((r) => r.status === 'Pending').length
    const totalDays = leaveData.filter((r) => r.status === 'Approved').reduce((acc, r) => acc + r.totalDays, 0)
    return [
      { label: 'Total Requests', value: total, subtitle: 'All applications', tone: 'blue' as const, icon: CalendarDays },
      { label: 'Approved', value: approved, subtitle: 'Granted leaves', tone: 'mint' as const, icon: CheckCircle2 },
      { label: 'Pending', value: pending, subtitle: 'Awaiting action', tone: 'amber' as const, icon: Clock },
      { label: 'Days Taken', value: totalDays, subtitle: 'Approved total', tone: 'indigo' as const, icon: BarChart3 },
    ]
  }, [leaveData])

  const activeKPIs =
    activeTab === 'attendance'
      ? attendanceKPIs
      : activeTab === 'tasks'
        ? taskKPIs
        : activeTab === 'performance'
          ? performanceKPIs
          : leaveKPIs

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const handleExportReport = () => {
    let rows: Record<string, string | number>[] = []
    let filename = 'report'
    if (activeTab === 'leave') {
      filename = 'leave-report'
      rows = leaveData.map((r) => ({
        Employee: r.employeeName,
        Type: r.type,
        Start: r.startDate,
        End: r.endDate,
        Status: r.status,
        Days: r.totalDays,
      }))
    } else if (activeTab === 'tasks') {
      filename = 'tasks-report'
      rows = taskData.map((t: any) => ({
        Title: t.title,
        Assignee: t.assignee?.name || '',
        Status: t.status,
        Priority: t.priority,
      }))
    } else if (activeTab === 'performance') {
      filename = 'performance-report'
      rows = performanceData.map((p: any) => ({
        Employee: p.employeeName || p.employeeId,
        Cycle: p.cycle,
        Score: p.displayScore ?? p.metrics?.finalScore ?? '',
        Status: p.status,
      }))
    } else {
      filename = 'attendance-report'
      rows = [{ Note: 'Use the monthly attendance sheet below for detailed export' }]
    }
    if (rows.length === 0) {
      alert('No rows to export for this report tab')
      return
    }
    const keys = Object.keys(rows[0])
    const csv = [
      keys.join(','),
      ...rows.map((row) => keys.map((k) => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-ds-neutral-50">
        <Target className="size-16 text-ds-neutral-200 mb-4" />
        <h3 className="text-ds-heading text-ds-brand-navy">Analytics Restricted</h3>
        <p className="text-ds-body text-ds-neutral-500 max-w-md">
          Reports and analytics are only available to HR and Administrative roles.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6 pb-10">
      <section className="flex flex-col gap-4">
        <PageHeroBanner
          compact
          eyebrow={dateEyebrow}
          title="Reports & Analytics"
          description="Tab-wise workforce reports — attendance sheets, performance scores, tasks, and leave summaries."
          actions={
            <Button variant="outline" onClick={handleExportReport}>
              <Download className="size-4" />
              Export Report
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {activeKPIs.slice(0, 4).map((kpi) => (
            <MetricStatCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              subtitle={kpi.subtitle}
              tone={kpi.tone}
              icon={kpi.icon}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-ds-neutral-200 pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activeTab === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(id)}
          >
            <Icon className="size-3.5 mr-1.5" />
            {label}
          </Button>
        ))}
      </div>

      {activeTab === 'attendance' && (
        <div className="flex flex-col gap-5">
          <SectionCard title="Attendance Register & Muster Roll">
            {/* View Switcher Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('muster')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    attendanceViewMode === 'muster'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Team Muster Roll (Form T)
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('single')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    attendanceViewMode === 'single'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Individual Employee Sheet
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Month:</label>
                <Input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="w-40 text-xs"
                />
              </div>
            </div>

            {/* View 1: Team Muster Roll */}
            {attendanceViewMode === 'muster' && (
              <TeamAttendanceMusterRoll reportMonth={reportMonth} />
            )}

            {/* View 2: Single Employee Sheet */}
            {attendanceViewMode === 'single' && (
              <div className="flex flex-col gap-4">
                <div className="w-full max-w-sm">
                  <label className="text-xs font-semibold text-ds-neutral-500 uppercase tracking-wide mb-1 block">
                    Select Employee
                  </label>
                  <Select
                    value={monthlyEmployeeId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMonthlyEmployeeId(e.target.value)}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.id})
                      </option>
                    ))}
                  </Select>
                </div>

                {monthlyEmployee && monthlyReport ? (
                  <EmployeeMonthlyAttendanceReport
                    employee={monthlyEmployee}
                    monthLabel={monthLabel}
                    days={monthlyReport.days}
                    summary={monthlyReport.summary}
                  />
                ) : (
                  <p className="text-sm text-ds-neutral-500 py-4">Select an employee to view their monthly attendance sheet.</p>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Punch log report">
            <ReportFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedEmployee={selectedEmployee}
              onEmployeeChange={setSelectedEmployee}
              employees={employees}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
            <DataTable<any>
              data={attendanceData}
              columns={[
                { id: 'date', accessorKey: 'date', header: 'Date', sortable: true },
                { id: 'employee', accessorKey: 'employeeName', header: 'Employee', sortable: true },
                {
                  id: 'checkIn',
                  accessorKey: 'checkIn',
                  header: 'Check-in',
                  cell: ({ row }) => (row.checkIn ? formatTime(row.checkIn) : '—'),
                },
                {
                  id: 'checkOut',
                  accessorKey: 'checkOut',
                  header: 'Check-out',
                  cell: ({ row }) => (row.checkOut ? formatTime(row.checkOut) : '—'),
                },
                { id: 'status', accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.status} /> },
                { id: 'mode', accessorKey: 'mode', header: 'Mode', cell: ({ row }) => <span className="capitalize">{row.mode}</span> },
              ]}
              keyExtractor={(r) => r.id}
            />
          </SectionCard>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="flex flex-col gap-5">
          <SectionCard title="Performance review report">
            <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-end">
              <div className="flex-1 max-w-xs">
                <label className="text-xs font-semibold text-ds-neutral-500 uppercase tracking-wide mb-1 block">
                  Review cycle
                </label>
                <Input value={perfCycle} onChange={(e) => setPerfCycle(e.target.value)} placeholder="e.g. 2026-Q2" />
              </div>
              <div className="w-full md:w-44">
                <label className="text-xs font-semibold text-ds-neutral-500 uppercase tracking-wide mb-1 block">
                  Cycle type
                </label>
                <Select
                  value={perfCycleType}
                  onChange={(e) => setPerfCycleType(e.target.value as PerformanceCycle)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </Select>
              </div>
            </div>

            <ReportFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedEmployee={selectedEmployee}
              onEmployeeChange={setSelectedEmployee}
              employees={employees}
              showDateRange={false}
            />

            <DataTable<any>
              data={performanceData}
              columns={[
                { id: 'employee', accessorKey: 'employeeName', header: 'Employee', sortable: true },
                { id: 'period', accessorKey: 'period', header: 'Review Period', sortable: true },
                { id: 'task', header: 'Task Score', sortable: true, cell: ({ row }) => row.metrics.taskScore },
                { id: 'attendance', header: 'Attendance', sortable: true, cell: ({ row }) => row.metrics.attendanceScore },
                { id: 'leave', header: 'Leave', sortable: true, cell: ({ row }) => row.metrics.leaveScore },
                {
                  id: 'score',
                  header: 'Final Score',
                  sortable: true,
                  cell: ({ row }) => <span className="font-bold text-ds-brand-navy">{row.displayScore}</span>,
                },
                {
                  id: 'onTime',
                  header: 'On-time %',
                  sortable: true,
                  cell: ({ row }) => <span>{row.onTimeRate ?? '—'}%</span>,
                },
                {
                  id: 'category',
                  header: 'Category',
                  cell: ({ row }) => (
                    <StatusBadge
                      status={
                        row.metrics.category === 'Outstanding'
                          ? 'Verified'
                          : row.metrics.category === 'Needs Improvement'
                            ? 'Failed'
                            : 'Active'
                      }
                    />
                  ),
                },
                {
                  id: 'status',
                  accessorKey: 'status',
                  header: 'Status',
                  cell: ({ row }) => (
                    <StatusBadge status={row.status === 'Completed' ? 'Approved' : 'Pending'} />
                  ),
                },
              ]}
              keyExtractor={(r) => r.id}
            />
          </SectionCard>
        </div>
      )}

      {activeTab === 'tasks' && (
        <SectionCard title="Task completion report">
          <ReportFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedEmployee={selectedEmployee}
            onEmployeeChange={setSelectedEmployee}
            employees={employees}
            showDateRange={false}
          />
          <DataTable<any>
            data={taskData}
            columns={[
              { id: 'title', accessorKey: 'title', header: 'Task', sortable: true },
              { id: 'assignee', header: 'Assignee', sortable: true, cell: ({ row }) => row.assignee.name },
              {
                id: 'priority',
                accessorKey: 'priority',
                header: 'Priority',
                cell: ({ row }) => (
                  <SeverityBadge
                    level={row.priority.charAt(0).toUpperCase() + row.priority.slice(1)}
                    uppercase={false}
                  />
                ),
              },
              {
                id: 'status',
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => (
                  <span className="capitalize px-2 py-0.5 rounded-full bg-ds-neutral-100 text-ds-body-xs font-medium">
                    {row.status.replace('_', ' ')}
                  </span>
                ),
              },
              {
                id: 'dueDate',
                accessorKey: 'dueDate',
                header: 'Due Date',
                sortable: true,
                cell: ({ row }) => formatDate(row.dueDate),
              },
            ]}
            keyExtractor={(t) => t.id}
          />
        </SectionCard>
      )}

      {activeTab === 'leave' && (
        <SectionCard title="Leave utilization report">
          <ReportFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedEmployee={selectedEmployee}
            onEmployeeChange={setSelectedEmployee}
            employees={employees}
            showDateRange={false}
          />
          <DataTable<any>
            data={leaveData}
            columns={[
              { id: 'employee', accessorKey: 'employeeName', header: 'Employee', sortable: true },
              { id: 'type', accessorKey: 'type', header: 'Type', sortable: true },
              { id: 'totalDays', accessorKey: 'totalDays', header: 'Days', sortable: true },
              {
                id: 'startDate',
                accessorKey: 'startDate',
                header: 'Start Date',
                sortable: true,
                cell: ({ row }) => formatDate(row.startDate),
              },
              {
                id: 'endDate',
                accessorKey: 'endDate',
                header: 'End Date',
                sortable: true,
                cell: ({ row }) => formatDate(row.endDate),
              },
              { id: 'status', accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.status} /> },
            ]}
            keyExtractor={(r) => r.id}
          />
        </SectionCard>
      )}
    </div>
  )
}

function ReportFilters({
  searchTerm,
  onSearchChange,
  selectedEmployee,
  onEmployeeChange,
  employees,
  dateRange,
  onDateRangeChange,
  showDateRange = true,
}: {
  searchTerm: string
  onSearchChange: (v: string) => void
  selectedEmployee: string
  onEmployeeChange: (v: string) => void
  employees: { id: string; name: string }[]
  dateRange?: { start: string; end: string }
  onDateRangeChange?: (v: { start: string; end: string }) => void
  showDateRange?: boolean
}) {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ds-neutral-400" />
        <Input
          placeholder="Search by name or ID..."
          className="pl-10"
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="w-full md:w-64">
        <Select value={selectedEmployee} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onEmployeeChange(e.target.value)}>
          <option value="All">All Employees</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </Select>
      </div>
      {showDateRange && dateRange && onDateRangeChange && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onDateRangeChange({ ...dateRange, start: e.target.value })
            }
            className="w-40"
          />
          <span className="text-ds-neutral-400">to</span>
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onDateRangeChange({ ...dateRange, end: e.target.value })
            }
            className="w-40"
          />
        </div>
      )}
    </div>
  )
}
