"use client"

import * as React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button, Avatar, Input } from '@hryantra/ui'
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckSquare,
  Clock,
  FileText,
  FolderOpen,
  Pencil,
  Target,
  UserRound,
  Users,
  Wallet,
  Laptop,
  History,
  FileEdit,
  SlidersHorizontal,
  HeartHandshake,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Mail,
  MapPin,
} from 'lucide-react'
import { CustomFieldDefinitionItem } from '../types'
import { EmployeeOverviewTab } from '../components/EmployeeOverviewTab'
import { EmployeeCareerHistoryTab } from '../components/EmployeeCareerHistoryTab'
import { EmployeeBeneficiariesTab } from '../components/EmployeeBeneficiariesTab'
import { EmployeeChangeRequestDrawer } from '../components/EmployeeChangeRequestDrawer'
import { EmployeeTasksTab } from '../components/EmployeeTasksTab'
import { EmployeeAttendanceTab } from '../components/EmployeeAttendanceTab'
import { EmployeeDocumentsTab } from '../components/EmployeeDocumentsTab'
import { EmployeePerformanceTab } from '../components/EmployeePerformanceTab'
import { EmployeeAssetsTab } from '../components/EmployeeAssetsTab'
import { EmployeeCompensationTab } from '../components/EmployeeCompensationTab'
import { TaskFormDrawer } from '../../tasks/components/TaskFormDrawer'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { notifyDataChanged, useDataSync } from '@/shared/events'

type TabType = 'overview' | 'history' | 'compensation' | 'beneficiaries' | 'tasks' | 'attendance' | 'assets' | 'documents' | 'performance'

const TAB_CONFIG: { key: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Overview', icon: UserRound },
  { key: 'history', label: 'Career History', icon: History },
  { key: 'compensation', label: 'Compensation', icon: Wallet },
  { key: 'beneficiaries', label: 'Family & Nominees', icon: HeartHandshake },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare },
  { key: 'attendance', label: 'Attendance', icon: Clock },
  { key: 'assets', label: 'Assets', icon: FolderOpen },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'performance', label: 'Performance', icon: Target },
]

const VALID_TABS = new Set<TabType>(TAB_CONFIG.map((t) => t.key))

function parseTab(value: string | null): TabType {
  if (value && VALID_TABS.has(value as TabType)) return value as TabType
  return 'overview'
}

export function EmployeeProfilePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string
  const { employees, currentUserRole, updateEmployee, hasAction } = useStore()
  const canEditCompensation = currentUserRole === 'HR' || currentUserRole === 'Superadmin'
  const canEdit = hasAction('employees_edit') || canEditCompensation

  const [activeTab, setActiveTab] = React.useState<TabType>(() => parseTab(searchParams.get('tab')))
  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isChangeRequestOpen, setIsChangeRequestOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [workLocations, setWorkLocations] = React.useState<{ id: string; name: string }[]>([])
  const [customFieldDefs, setCustomFieldDefs] = React.useState<CustomFieldDefinitionItem[]>([])
  const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, any>>({})
  const [editForm, setEditForm] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    locationId: '',
    status: 'ACTIVE',
    allowWebPunch: true,
  })

  const employee = employees.find((emp) => emp.id === id)
  const initials = employee?.name
    ? employee.name
        .split(' ')
        .map((n) => n.charAt(0))
        .join('')
        .substring(0, 2)
    : '??'

  // Pending Change Requests Banner & Review
  const [pendingRequests, setPendingRequests] = React.useState<any[]>([])
  const [selectedPendingRequest, setSelectedPendingRequest] = React.useState<any | null>(null)
  const [reviewRemark, setReviewRemark] = React.useState('')
  const [actingOnRequest, setActingOnRequest] = React.useState(false)

  const loadPendingRequests = React.useCallback(async () => {
    if (!employee) return
    const empDbId = employee.recordId || employee.id
    try {
      const res = await api.employees.getChangeRequests({ employeeId: empDbId, status: 'PENDING' })
      const list = res?.data || res || []
      setPendingRequests(Array.isArray(list) ? list : [])
    } catch {
      setPendingRequests([])
    }
  }, [employee?.id, employee?.recordId])

  React.useEffect(() => {
    loadPendingRequests()
  }, [loadPendingRequests])

  useDataSync(['employees', 'approvals'], () => {
    loadPendingRequests()
  })

  const handleReviewAction = async (action: 'APPROVED' | 'REJECTED') => {
    if (!selectedPendingRequest) return
    setActingOnRequest(true)
    try {
      await api.employees.updateChangeRequestStatus(selectedPendingRequest.id, {
        status: action,
        reviewRemark: reviewRemark.trim() || undefined,
      })
      notifyDataChanged('employees', { employeeId: employee?.id, action })
      notifyDataChanged('approvals', { action })
      setSelectedPendingRequest(null)
      setReviewRemark('')
      await loadPendingRequests()
    } catch (err: any) {
      alert(err?.message || `Failed to ${action.toLowerCase()} request`)
    } finally {
      setActingOnRequest(false)
    }
  }

  React.useEffect(() => {
    setActiveTab(parseTab(searchParams.get('tab')))
  }, [searchParams])

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const openEdit = React.useCallback(async () => {
    if (!employee) return
    const parts = employee.name.trim().split(/\s+/)
    let allowWebPunch = true
    try {
      const punchRes = await api.attendance.getWebPunchPermission(employee.id)
      if (punchRes?.data) {
        allowWebPunch = Boolean(punchRes.data.allowed)
      }
    } catch {}

    setEditForm({
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: employee.email || '',
      phone: '',
      designation: employee.designation || '',
      department: employee.department || '',
      locationId: employee.locationId || '',
      status: employee.status === 'Active' ? 'ACTIVE' : employee.status === 'On Leave' ? 'ON_LEAVE' : 'INACTIVE',
      allowWebPunch,
    })

    setCustomFieldValues({ ...((employee.customFields as Record<string, any>) || {}) })
    setIsEditOpen(true)

    try {
      const [locRes, defsRes] = await Promise.all([
        api.locations.getAll(true),
        api.customFields.list(false),
      ])
      const rows = Array.isArray(locRes?.data) ? locRes.data : []
      setWorkLocations(rows.map((loc: any) => ({ id: loc.id, name: loc.name })))
      if (Array.isArray(defsRes?.data)) {
        setCustomFieldDefs(defsRes.data)
      }
    } catch {
      setWorkLocations([])
    }
  }, [employee])

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee) return
    setSaving(true)
    try {
      await updateEmployee(employee.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone || null,
        designation: editForm.designation.trim(),
        department: editForm.department.trim(),
        locationId: editForm.locationId || null,
        status: editForm.status,
        customFields: customFieldValues,
      })

      // Update Web Clock-in permission
      await api.attendance.setWebPunchPermission({
        employeeId: employee.id,
        allowed: editForm.allowWebPunch,
      }).catch(() => {})

      // Directly update custom fields on employee
      const empDbId = employee.recordId || employee.id
      await api.customFields.updateEmployeeValues(empDbId, customFieldValues).catch(() => {})

      setIsEditOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update employee')
    } finally {
      setSaving(false)
    }
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    const url = tab === 'overview' ? `/employees/${id}` : `/employees/${id}?tab=${tab}`
    router.replace(url, { scroll: false })
  }

  if (!employee) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs text-center">
          <h2 className="text-base font-bold text-slate-900">Employee Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">This employee record could not be loaded or may have been removed.</p>
          <Button variant="outline" size="sm" onClick={() => router.push('/employees')} className="mt-4">
            <ArrowLeft className="size-3.5 mr-1.5" /> Back to Employees
          </Button>
        </div>
      </div>
    )
  }

  const isActiveStatus = employee.status === 'Active' || employee.status === 'ACTIVE'
  const isOnLeaveStatus = employee.status === 'On Leave' || employee.status === 'ON_LEAVE'

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5 pb-10">
      {/* ── Breadcrumb Navigation ── */}
      <button
        type="button"
        onClick={() => router.push('/employees')}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-indigo-600 cursor-pointer"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to Employee Directory</span>
      </button>

      {/* ── 1. Modern Executive Profile Hero Card ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className="relative shrink-0">
            <Avatar
              initials={initials}
              size="xl"
              gradient="indigo"
              className="ring-4 ring-slate-100 shadow-sm"
            />
            <span className={`absolute bottom-0.5 right-0.5 size-3.5 rounded-full ring-2 ring-white ${
              isActiveStatus ? 'bg-emerald-500' : isOnLeaveStatus ? 'bg-amber-500' : 'bg-slate-400'
            }`} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{employee.name}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {employee.id}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                isActiveStatus
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isOnLeaveStatus
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                <span className={`size-1.5 rounded-full ${
                  isActiveStatus ? 'bg-emerald-500' : isOnLeaveStatus ? 'bg-amber-500' : 'bg-slate-400'
                }`} />
                {employee.status === 'ACTIVE' ? 'Active' : employee.status === 'ON_LEAVE' ? 'On Leave' : employee.status}
              </span>
              {employee.hasLogin && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  Portal Access Active
                </span>
              )}
            </div>

            <p className="text-xs font-semibold text-slate-700 mt-1">
              {employee.designation} · {employee.department} {employee.orgUnitName ? `(${employee.orgUnitName})` : ''}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 font-medium">
              <a href={`mailto:${employee.email}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Mail className="size-3 text-slate-400" /> {employee.email}
              </a>
              <span className="flex items-center gap-1.5">
                <Users className="size-3 text-slate-400" /> Reports to <strong className="text-slate-800">{employee.manager || 'Unassigned'}</strong>
              </span>
              {employee.locationName && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3 text-slate-400" /> {employee.locationName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChangeRequestOpen(true)}
            className="text-xs h-8 px-3 border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold shadow-2xs"
          >
            <FileEdit className="size-3.5 text-purple-600 mr-1.5" />
            Request Change
          </Button>
          {canEdit && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={openEdit}
              className="text-xs h-8 px-3 border-slate-200 hover:bg-slate-50 font-semibold shadow-2xs"
            >
              <Pencil className="size-3.5 text-slate-500 mr-1.5" />
              Edit Profile
            </Button>
          )}
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => setIsTaskFormOpen(true)}
            className="text-xs h-8 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-2xs"
          >
            <CheckSquare className="size-3.5 mr-1.5" />
            Assign Task
          </Button>
        </div>
      </div>

      {/* ── 2. Subtle Gradient KPI Stat Cards (Profile Context) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Employee ID */}
        <div className="bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Employee ID</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 truncate">{employee.id}</span>
            <span className="text-[11px] text-blue-600/90 font-medium truncate">Unique identifier</span>
          </div>
          <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <BadgeCheck className="size-5" />
          </div>
        </div>

        {/* Card 2: Department */}
        <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Department</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 truncate">{employee.department}</span>
            <span className="text-[11px] text-emerald-700/90 font-medium truncate">{employee.orgUnitName || 'Main division'}</span>
          </div>
          <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Building2 className="size-5" />
          </div>
        </div>

        {/* Card 3: Designation */}
        <div className="bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/40 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Designation</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 truncate">{employee.designation}</span>
            <span className="text-[11px] text-indigo-600/90 font-medium truncate">Current role</span>
          </div>
          <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <UserRound className="size-5" />
          </div>
        </div>

        {/* Card 4: Reporting Manager */}
        <div className="bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Reporting Line</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 truncate">{employee.manager || 'Unassigned'}</span>
            <span className="text-[11px] text-amber-700/90 font-medium truncate">Manager contact</span>
          </div>
          <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Users className="size-5" />
          </div>
        </div>
      </div>

      {/* Pending Change Request Alert Banner */}
      {pendingRequests.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
              <Clock className="size-4 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold flex items-center gap-2">
                Pending Profile Change Request
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-200/80 text-amber-800">
                  {pendingRequests[0].category || 'JOB_ROLE'}
                </span>
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Submitted {new Date(pendingRequests[0].createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                {pendingRequests[0].effectiveDate ? ` · Effective: ${new Date(pendingRequests[0].effectiveDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                {pendingRequests[0].reason ? ` · "${pendingRequests[0].reason}"` : ''}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setReviewRemark('')
              setSelectedPendingRequest(pendingRequests[0])
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 shrink-0 rounded-xl"
          >
            {canEdit ? 'Review Request' : 'View Request Details'}
          </Button>
        </div>
      )}

      {/* ── 3. Modern Segmented Tab Bar ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80 no-scrollbar">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === key
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-[320px]">
        {activeTab === 'overview' && (
          <EmployeeOverviewTab
            employee={employee}
            onOpenEdit={openEdit}
            onOpenChangeRequest={() => setIsChangeRequestOpen(true)}
            onNavigateTab={handleTabChange}
          />
        )}
        {activeTab === 'history' && <EmployeeCareerHistoryTab employee={employee} />}
        {activeTab === 'compensation' && (
          <EmployeeCompensationTab employeeId={employee.id} canEdit={canEditCompensation} />
        )}
        {activeTab === 'beneficiaries' && <EmployeeBeneficiariesTab employee={employee} />}
        {activeTab === 'tasks' && <EmployeeTasksTab employeeId={employee.id} />}
        {activeTab === 'attendance' && <EmployeeAttendanceTab employeeId={employee.id} />}
        {activeTab === 'assets' && <EmployeeAssetsTab />}
        {activeTab === 'documents' && <EmployeeDocumentsTab employeeId={employee.id} />}
        {activeTab === 'performance' && <EmployeePerformanceTab />}
      </div>

      <TaskFormDrawer
        open={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        defaultAssigneeId={employee.id}
      />

      <EmployeeChangeRequestDrawer
        employee={employee}
        isOpen={isChangeRequestOpen}
        onClose={() => setIsChangeRequestOpen(false)}
      />

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">Edit employee</h3>
              <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setIsEditOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4 p-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">First name</label>
                  <Input
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Last name</label>
                  <Input
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
                <Input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Department</label>
                  <Input
                    required
                    value={editForm.department}
                    onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Designation</label>
                  <Input
                    required
                    value={editForm.designation}
                    onChange={(e) => setEditForm((p) => ({ ...p, designation: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ON_LEAVE">On Leave</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Assigned location</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={editForm.locationId}
                    onChange={(e) => setEditForm((p) => ({ ...p, locationId: e.target.value }))}
                  >
                    <option value="">None</option>
                    {workLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Organization Attributes */}
              {customFieldDefs.length > 0 && (
                <div className="rounded-xl border border-purple-200/80 bg-purple-50/20 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                    <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <SlidersHorizontal className="size-3.5 text-purple-600" />
                      Custom Profile Attributes
                    </span>
                    <span className="text-[10px] font-semibold text-purple-600">
                      {customFieldDefs.length} configurable fields
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customFieldDefs.map((def) => {
                      const val = customFieldValues[def.key] ?? ''

                      return (
                        <div key={def.id} className={def.type === 'TEXTAREA' ? 'sm:col-span-2' : ''}>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            {def.label}
                            {def.required && <span className="text-rose-500 ml-0.5">*</span>}
                          </label>

                          {def.type === 'SELECT' ? (
                            <select
                              value={val}
                              required={def.required}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [def.key]: e.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">{def.placeholder || `Select ${def.label}`}</option>
                              {def.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : def.type === 'DATE' ? (
                            <input
                              type="date"
                              value={val}
                              required={def.required}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [def.key]: e.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                            />
                          ) : def.type === 'NUMBER' ? (
                            <input
                              type="number"
                              value={val}
                              required={def.required}
                              placeholder={def.placeholder || `Enter ${def.label}`}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [def.key]: e.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                            />
                          ) : def.type === 'BOOLEAN' ? (
                            <select
                              value={String(val)}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [def.key]: e.target.value === 'true' })}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">Select option</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : def.type === 'TEXTAREA' ? (
                            <textarea
                              rows={2}
                              value={val}
                              required={def.required}
                              placeholder={def.placeholder || `Enter ${def.label}`}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [def.key]: e.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                            />
                          ) : (
                            <input
                              type="text"
                              value={val}
                              required={def.required}
                              placeholder={def.placeholder || `Enter ${def.label}`}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [def.key]: e.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                            />
                          )}

                          {def.description && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{def.description}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="size-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Browser Web Clock-In Permission
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editForm.allowWebPunch}
                    onClick={() => setEditForm(p => ({ ...p, allowWebPunch: !p.allowWebPunch }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      editForm.allowWebPunch ? 'bg-purple-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        editForm.allowWebPunch ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Allow employee to clock in and out from their web browser on authorized networks.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={saving}>
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending Change Request Review Modal */}
      {selectedPendingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <FileEdit className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Review Change Request ({selectedPendingRequest.category || 'JOB_ROLE'})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Employee: <strong>{employee.name}</strong> ({employee.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPendingRequest(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* Meta pills */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Submitted On</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {new Date(selectedPendingRequest.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Effective Date</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedPendingRequest.effectiveDate
                      ? new Date(selectedPendingRequest.effectiveDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Immediate'}
                  </p>
                </div>
                {selectedPendingRequest.reason && (
                  <div className="col-span-2 pt-1 border-t border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reason</span>
                    <p className="italic text-slate-700 mt-0.5 font-medium">"{selectedPendingRequest.reason}"</p>
                  </div>
                )}
              </div>

              {/* Changes comparison table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">Requested Modifications:</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Attribute</th>
                        <th className="py-2.5 px-3">Current Value</th>
                        <th className="py-2.5 px-3">Proposed Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedPendingRequest.changes && Object.entries(selectedPendingRequest.changes).map(([field, val]: any) => (
                        <tr key={field}>
                          <td className="py-2.5 px-3 font-bold text-slate-700 capitalize">
                            {field.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 line-through">
                            {String(val.oldValue ?? '—')}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-purple-700">
                            {String(val.newValue ?? '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Review remarks textarea for HR */}
              {canEdit ? (
                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-700">HR Review Remarks (Optional)</label>
                  <textarea
                    rows={2}
                    value={reviewRemark}
                    onChange={(e) => setReviewRemark(e.target.value)}
                    placeholder="Enter approval note or rejection reasoning..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200 flex items-center gap-2">
                  <Clock className="size-4 shrink-0 text-amber-600" />
                  <span>This request has been submitted to HR and is currently awaiting review.</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 bg-slate-50/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedPendingRequest(null)}
                disabled={actingOnRequest}
                className="text-xs"
              >
                Close
              </Button>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive-outline"
                    size="sm"
                    disabled={actingOnRequest}
                    onClick={() => handleReviewAction('REJECTED')}
                    className="text-xs"
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={actingOnRequest}
                    onClick={() => handleReviewAction('APPROVED')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    {actingOnRequest ? 'Processing...' : 'Approve & Apply Changes'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
