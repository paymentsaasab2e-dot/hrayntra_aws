"use client"

import * as React from 'react'
import {
  PageHeroBanner,
  SectionCard,
  Button,
  Input,
  StatusBadge,
  ModalWrapper,
} from '@hryantra/ui'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import {
  GraduationCap,
  ShieldAlert,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Send,
  Users,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Award,
  Play,
  FileCheck,
} from 'lucide-react'

export default function TrainingPage() {
  const { currentUserRole } = useStore()
  const isHRorAdmin = currentUserRole === 'HR' || currentUserRole === 'Superadmin'

  const [loading, setLoading] = React.useState(true)
  const [dashboard, setDashboard] = React.useState<any>(null)
  const [courses, setCourses] = React.useState<any[]>([])
  const [myAssignments, setMyAssignments] = React.useState<any[]>([])
  const [allAssignments, setAllAssignments] = React.useState<any[]>([])
  const [assignmentsTotal, setAssignmentsTotal] = React.useState(0)
  const [activeTab, setActiveTab] = React.useState<'my' | 'all' | 'catalog'>('my')

  // Modals & Drawers
  const [assignModalOpen, setAssignModalOpen] = React.useState(false)
  const [selectedCourseId, setSelectedCourseId] = React.useState('')
  const [targetScope, setTargetScope] = React.useState<'ALL' | 'DEPARTMENT'>('ALL')
  const [selectedDept, setSelectedDept] = React.useState('Engineering')
  const [dueInDays, setDueInDays] = React.useState(30)
  const [assigning, setAssigning] = React.useState(false)

  // Simulation Course Modal
  const [courseModalOpen, setCourseModalOpen] = React.useState(false)
  const [activeAssignment, setActiveAssignment] = React.useState<any>(null)
  const [simScore, setSimScore] = React.useState(90)
  const [submittingProgress, setSubmittingProgress] = React.useState(false)

  // Notification banners
  const [bannerMsg, setBannerMsg] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Search & filter for assignments
  const [searchTerm, setSearchTerm] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('ALL')

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [coursesRes, myRes, dashRes, allRes] = await Promise.all([
        api.training.listCourses().catch(() => ({ data: [] })),
        api.training.getMyAssignments().catch(() => ({ data: [] })),
        api.training.getComplianceDashboard().catch(() => ({ data: null })),
        api.training.listAssignments({ limit: 100 }).catch(() => ({ data: { items: [], total: 0 } })),
      ])

      if (coursesRes?.data) setCourses(coursesRes.data)
      if (myRes?.data) setMyAssignments(myRes.data)
      if (dashRes?.data) setDashboard(dashRes.data)
      if (allRes?.data?.items) {
        setAllAssignments(allRes.data.items)
        setAssignmentsTotal(allRes.data.total || 0)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleSeedStandards = async () => {
    try {
      setBannerMsg(null)
      const res = await api.training.seedStandards()
      setBannerMsg({ text: res.message || 'Seeded standard statutory courses', type: 'success' })
      loadData()
    } catch (err: any) {
      setBannerMsg({ text: err.message || 'Failed to seed courses', type: 'error' })
    }
  }

  const handleAssignCourse = async () => {
    if (!selectedCourseId) return
    setAssigning(true)
    setBannerMsg(null)
    try {
      const payload: any = {
        courseId: selectedCourseId,
        dueInDays,
      }
      if (targetScope === 'ALL') {
        payload.targetAll = true
      } else {
        payload.department = selectedDept
      }

      const res = await api.training.assign(payload)
      setBannerMsg({
        text: `Assigned "${res.courseTitle}" to ${res.assignedCount} employees (Due in ${dueInDays} days).`,
        type: 'success',
      })
      setAssignModalOpen(false)
      loadData()
    } catch (err: any) {
      setBannerMsg({ text: err.message || 'Failed to assign course', type: 'error' })
    } finally {
      setAssigning(false)
    }
  }

  const handleSendReminders = async () => {
    try {
      setBannerMsg(null)
      const res = await api.training.sendReminders()
      setBannerMsg({
        text: res.data?.message || `Dispatched automated reminders to pending employees`,
        type: 'success',
      })
      loadData()
    } catch (err: any) {
      setBannerMsg({ text: err.message || 'Failed to send reminders', type: 'error' })
    }
  }

  const handleCompleteTraining = async () => {
    if (!activeAssignment) return
    setSubmittingProgress(true)
    try {
      await api.training.updateProgress(activeAssignment.id, {
        status: 'COMPLETED',
        score: simScore,
        notes: `Statutory assessment completed with score of ${simScore}%`,
      })
      setBannerMsg({
        text: `Congratulations! Completed ${activeAssignment.course?.title} with ${simScore}% score. Certificate issued.`,
        type: 'success',
      })
      setCourseModalOpen(false)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to record completion')
    } finally {
      setSubmittingProgress(false)
    }
  }

  const filteredAllAssignments = allAssignments.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const emp = `${item.employee?.firstName || ''} ${item.employee?.lastName || ''}`.toLowerCase()
      const dept = (item.employee?.department || '').toLowerCase()
      const course = (item.course?.title || '').toLowerCase()
      return emp.includes(term) || dept.includes(term) || course.includes(term)
    }
    return true
  })

  const posh = dashboard?.statutoryCompliance?.posh
  const safety = dashboard?.statutoryCompliance?.safety

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeroBanner
        eyebrow="Workplace Learning & Governance"
        title="Mandatory Training & Statutory Compliance"
        description="Statutory POSH Act 2013 certifications, workplace fire & evacuation drills, DPDP Act cybersecurity awareness, and automated employee reminders."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            {isHRorAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={handleSendReminders}>
                  <Send className="size-3.5" />
                  <span>Send Reminders</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (courses.length > 0) setSelectedCourseId(courses[0].id)
                    setAssignModalOpen(true)
                  }}
                >
                  <Users className="size-3.5" />
                  <span>Assign Course</span>
                </Button>
              </>
            )}
            {courses.length === 0 && isHRorAdmin && (
              <Button variant="default" size="sm" onClick={handleSeedStandards}>
                <Sparkles className="size-3.5" />
                <span>Seed Standard Courses</span>
              </Button>
            )}
          </div>
        }
      />

      {bannerMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3.5 text-sm ${
            bannerMsg.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {bannerMsg.type === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="size-4 text-rose-600" />
          )}
          <span>{bannerMsg.text}</span>
        </div>
      )}

      {/* Statutory Compliance Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* POSH Compliance Card */}
        <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50/80 via-white to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-700">
              <ShieldAlert className="size-4" />
              <span>POSH Act 2013</span>
            </div>
            <StatusBadge status={posh?.compliantStatus === 'FULLY_COMPLIANT' ? 'Compliant' : 'Action Required'} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-3xl font-extrabold text-slate-900">
              {posh?.complianceRatePercent ?? 0}%
            </div>
            <span className="text-xs text-slate-500">certified</span>
          </div>
          <div className="mt-2 text-xs text-slate-600">
            {posh?.completedCount ?? 0} of {posh?.assignedCount ?? 0} employees completed annual sensitization.
          </div>
        </div>

        {/* Fire & Safety Card */}
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 via-white to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
              <Flame className="size-4" />
              <span>Workplace Safety</span>
            </div>
            <StatusBadge status={safety?.complianceRatePercent >= 80 ? 'Compliant' : 'Action Required'} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-3xl font-extrabold text-slate-900">
              {safety?.complianceRatePercent ?? 0}%
            </div>
            <span className="text-xs text-slate-500">trained</span>
          </div>
          <div className="mt-2 text-xs text-slate-600">
            {safety?.completedCount ?? 0} of {safety?.assignedCount ?? 0} personnel fire & evacuation drilled.
          </div>
        </div>

        {/* Overall Completion Rate */}
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/80 via-white to-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-purple-700">
            Overall Course Completion
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-3xl font-extrabold text-slate-900">
              {dashboard?.overallCompletionRatePercent ?? 100}%
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-600">
            {dashboard?.completedAssignments ?? 0} of {dashboard?.totalAssignments ?? 0} course modules passed.
          </div>
        </div>

        {/* Overdue Alert */}
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/80 via-white to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-700">
              Overdue Modules
            </div>
            {dashboard?.overdueAssignments > 0 && (
              <StatusBadge status="Action Required" />
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-3xl font-extrabold text-slate-900">
              {dashboard?.overdueAssignments ?? 0}
            </div>
            <span className="text-xs text-slate-500">assignments</span>
          </div>
          <div className="mt-2 text-xs text-slate-600">
            Pending past statutory due date. Reminders recommended.
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold text-slate-600">
        <button
          onClick={() => setActiveTab('my')}
          className={`pb-3 font-semibold transition-colors ${
            activeTab === 'my'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'hover:text-slate-900'
          }`}
        >
          My Mandatory Trainings ({myAssignments.length})
        </button>
        {isHRorAdmin && (
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 font-semibold transition-colors ${
              activeTab === 'all'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'hover:text-slate-900'
            }`}
          >
            All Employee Assignments ({assignmentsTotal})
          </button>
        )}
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 font-semibold transition-colors ${
            activeTab === 'catalog'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'hover:text-slate-900'
          }`}
        >
          Course Catalog ({courses.length})
        </button>
      </div>

      {/* TAB 1: My Mandatory Courses */}
      {activeTab === 'my' && (
        <SectionCard title="My Assigned Training Modules">
          <div className="p-4 border-b border-slate-100 text-xs text-slate-500">
            Courses assigned to your employee profile with statutory completion deadlines.
          </div>
          {myAssignments.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CheckCircle2 className="mx-auto size-10 text-emerald-500 mb-2" />
              <p className="font-semibold text-slate-800">You are fully up to date!</p>
              <p className="text-xs mt-1">No pending mandatory courses or assessments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              {myAssignments.map((item) => {
                const isCompleted = item.status === 'COMPLETED'
                const isOverdue = item.isOverdue
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-5 shadow-sm transition-all ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : isOverdue
                        ? 'border-rose-300 bg-rose-50/40'
                        : 'border-slate-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            {item.course?.category}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">{item.course?.code}</span>
                        </div>
                        <h4 className="mt-1.5 text-base font-bold text-slate-900">{item.course?.title}</h4>
                      </div>
                      <div>
                        {isCompleted ? (
                          <StatusBadge status="Active" withDot />
                        ) : isOverdue ? (
                          <StatusBadge status="Action Required" />
                        ) : (
                          <StatusBadge status="Pending" />
                        )}
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                      {item.course?.description}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-slate-400" />
                        <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                      </div>
                      {isCompleted && item.score && (
                        <div className="flex items-center gap-1 font-semibold text-emerald-700">
                          <Award className="size-3.5" />
                          <span>Score: {item.score}%</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                      {isCompleted ? (
                        <a
                          href={item.certificateUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          <FileCheck className="size-4" />
                          <span>View Certificate</span>
                        </a>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setActiveAssignment(item)
                            setSimScore(85)
                            setCourseModalOpen(true)
                          }}
                        >
                          <Play className="size-3.5" />
                          <span>Start & Complete Assessment</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* TAB 2: HR / Admin All Assignments Grid */}
      {activeTab === 'all' && isHRorAdmin && (
        <SectionCard title="Workforce Training Roster & Status">
          <div className="p-4 border-b border-slate-100 text-xs text-slate-500">
            Track mandatory course completions, overdue statuses, and reminder alert dispatches.
          </div>
          <div className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
                <Input
                  placeholder="Search employee, dept, course..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="NOT_STARTED">Not Started</option>
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredAllAssignments.length} of {assignmentsTotal} records
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">Reminders Sent</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAllAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No assignments found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAllAssignments.map((row) => {
                    const empName = `${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`
                    const isDone = row.status === 'COMPLETED'
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{empName}</div>
                          <div className="text-[11px] text-slate-500">{row.employee?.email}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {row.employee?.department || 'General'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900">{row.course?.title}</div>
                          <div className="font-mono text-[11px] text-purple-700">{row.course?.code}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {new Date(row.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3">
                          {isDone ? (
                            <StatusBadge status="Active" withDot />
                          ) : row.isOverdue ? (
                            <StatusBadge status="Action Required" />
                          ) : (
                            <StatusBadge status="Pending" />
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold">
                          {row.score !== null && row.score !== undefined ? `${row.score}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                            {row.remindersSentCount} alert{row.remindersSentCount !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!isDone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await api.training.updateProgress(row.id, {
                                  status: 'COMPLETED',
                                  score: 90,
                                  notes: 'HR manual verification complete',
                                })
                                loadData()
                              }}
                            >
                              Verify Pass
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* TAB 3: Course Catalog */}
      {activeTab === 'catalog' && (
        <SectionCard title="Course Catalog & Curriculum Benchmark">
          <div className="p-4 border-b border-slate-100 text-xs text-slate-500">
            Standard modules aligned with POSH Act, Factories Act safety mandates, and data security policies.
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-purple-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      {course.category}
                    </span>
                    <h4 className="mt-2 text-base font-bold text-slate-900">{course.title}</h4>
                    <p className="mt-1 text-xs text-slate-500 font-mono">{course.code}</p>
                  </div>
                  {course.isMandatory ? (
                    <StatusBadge status="Action Required" />
                  ) : (
                    <StatusBadge status="Draft" />
                  )}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  {course.description}
                </p>

                {/* Progress bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Company Completion Rate</span>
                    <span className="font-semibold text-slate-800">
                      {course.stats?.completionRatePercent ?? 0}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all"
                      style={{ width: `${course.stats?.completionRatePercent ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Duration: {course.durationMinutes} mins</span>
                  <span>Pass Threshold: {course.passScorePercent}%</span>
                  <span>Validity: {course.validityDays} days</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Course Assignment Modal */}
      <ModalWrapper
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Course to Employees"
        subtitle={<span className="text-xs text-purple-700">Statutory learning rollout</span>}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)} disabled={assigning}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleAssignCourse} disabled={assigning || !selectedCourseId}>
              {assigning ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Course</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.category}] {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Audience</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('ALL')}
                className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all ${
                  targetScope === 'ALL'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                All Active Employees
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('DEPARTMENT')}
                className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all ${
                  targetScope === 'DEPARTMENT'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                By Department
              </button>
            </div>
          </div>

          {targetScope === 'DEPARTMENT' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                <option value="Engineering">Engineering</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Finance">Finance</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Due in (Days)</label>
            <Input
              type="number"
              value={dueInDays}
              onChange={(e) => setDueInDays(parseInt(e.target.value, 10) || 30)}
              min={1}
              max={365}
            />
          </div>
        </div>
      </ModalWrapper>

      {/* Complete Assessment Simulation Modal */}
      {activeAssignment && (
        <ModalWrapper
          open={courseModalOpen}
          onClose={() => setCourseModalOpen(false)}
          title={`Complete: ${activeAssignment.course?.title}`}
          subtitle={<span className="text-xs text-purple-700">Mandatory Assessment</span>}
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCourseModalOpen(false)} disabled={submittingProgress}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleCompleteTraining} disabled={submittingProgress}>
                {submittingProgress ? 'Recording...' : 'Submit & Certify'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900">
              <strong>Module Overview:</strong> {activeAssignment.course?.description}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assessment Score Achieved (%)
              </label>
              <Input
                type="number"
                value={simScore}
                onChange={(e) => setSimScore(parseInt(e.target.value, 10) || 0)}
                min={0}
                max={100}
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Required passing threshold: {activeAssignment.course?.passScorePercent}%
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900">Statutory Certification Stamp:</div>
              <div>Course: {activeAssignment.course?.code}</div>
              <div>Passing Status: {simScore >= (activeAssignment.course?.passScorePercent || 80) ? 'PASSED' : 'FAILED'}</div>
              <div>Validity: 365 Days (Annual Renewal)</div>
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  )
}
