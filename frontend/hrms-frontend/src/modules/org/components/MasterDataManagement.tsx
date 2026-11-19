"use client"

import * as React from 'react'
import {
  Building2,
  Briefcase,
  Award,
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  X,
  Users,
  AlertCircle,
  IndianRupee,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react'
import { api } from '@/shared/api'

// =============================================================================
// Types
// =============================================================================

export type DepartmentMaster = {
  id: string
  code: string
  name: string
  description?: string
  headEmployeeId?: string
  headEmployeeName?: string
  costCenterId?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  employeeCount?: number
}

export type DesignationMaster = {
  id: string
  code: string
  title: string
  departmentId?: string
  departmentName?: string
  gradeId?: string
  gradeCode?: string
  approvalLevel?: 'L1' | 'L2' | 'L3' | 'NONE'
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  employeeCount?: number
}

export type GradeMaster = {
  id: string
  code: string
  name: string
  minSalary?: number
  maxSalary?: number
  leaveQuota?: number
  noticePeriodDays?: number
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
}

export type CostCentreMaster = {
  id: string
  code: string
  name: string
  description?: string
  departmentId?: string
  departmentName?: string
  annualBudget?: number
  currency?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
}

type EmployeeOption = {
  id: string
  employeeId: string
  name: string
  department?: string
  designation?: string
}

type MasterDataPayload = {
  departments: DepartmentMaster[]
  designations: DesignationMaster[]
  grades: GradeMaster[]
  costCentres: CostCentreMaster[]
  totalEmployees: number
  employeeOptions: EmployeeOption[]
}

type ActiveTab = 'departments' | 'designations' | 'grades' | 'costCentres'

// =============================================================================
// Main MasterDataManagement Component
// =============================================================================

export function MasterDataManagement() {
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('departments')
  const [data, setData] = React.useState<MasterDataPayload>({
    departments: [],
    designations: [],
    grades: [],
    costCentres: [],
    totalEmployees: 0,
    employeeOptions: [],
  })
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  // Modal State
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<any | null>(null)
  const [modalType, setModalType] = React.useState<ActiveTab>('departments')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = React.useState<{ type: ActiveTab; id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Success Notification
  const [toastMessage, setToastMessage] = React.useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await api.masterData.getAll()
      if (res?.data) {
        setData(res.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load master data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Stats calculation
  const stats = React.useMemo(() => {
    const activeDepts = data.departments.filter((d) => d.status === 'ACTIVE').length
    const activeDesigs = data.designations.filter((d) => d.status === 'ACTIVE').length
    const activeGrades = data.grades.filter((g) => g.status === 'ACTIVE').length
    const totalBudget = data.costCentres.reduce((sum, c) => sum + (c.annualBudget || 0), 0)

    return {
      depts: data.departments.length,
      activeDepts,
      desigs: data.designations.length,
      activeDesigs,
      grades: data.grades.length,
      activeGrades,
      costCentres: data.costCentres.length,
      totalBudget,
    }
  }, [data])

  // Filtered lists
  const filteredDepartments = React.useMemo(() => {
    return data.departments.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.headEmployeeName && d.headEmployeeName.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data.departments, searchQuery, statusFilter])

  const filteredDesignations = React.useMemo(() => {
    return data.designations.filter((d) => {
      const matchesSearch =
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.departmentName && d.departmentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.gradeCode && d.gradeCode.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data.designations, searchQuery, statusFilter])

  const filteredGrades = React.useMemo(() => {
    return data.grades.filter((g) => {
      const matchesSearch =
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.code.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'ALL' || g.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data.grades, searchQuery, statusFilter])

  const filteredCostCentres = React.useMemo(() => {
    return data.costCentres.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.departmentName && c.departmentName.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data.costCentres, searchQuery, statusFilter])

  // Handlers for Add / Edit
  const handleOpenAdd = (type: ActiveTab) => {
    setModalType(type)
    setEditingItem(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (type: ActiveTab, item: any) => {
    setModalType(type)
    setEditingItem(item)
    setModalOpen(true)
  }

  const handleSaveItem = async (formData: any) => {
    setIsSubmitting(true)
    setError(null)
    try {
      let res
      if (modalType === 'departments') {
        res = await api.masterData.upsertDepartment(formData)
        showToast(`Department ${formData.id ? 'updated' : 'created'} successfully`)
      } else if (modalType === 'designations') {
        res = await api.masterData.upsertDesignation(formData)
        showToast(`Designation ${formData.id ? 'updated' : 'created'} successfully`)
      } else if (modalType === 'grades') {
        res = await api.masterData.upsertGrade(formData)
        showToast(`Grade level ${formData.id ? 'updated' : 'created'} successfully`)
      } else if (modalType === 'costCentres') {
        res = await api.masterData.upsertCostCentre(formData)
        showToast(`Cost Centre ${formData.id ? 'updated' : 'created'} successfully`)
      }

      if (res?.data) {
        setData(res.data)
      }
      setModalOpen(false)
      setEditingItem(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handlers for Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      let res
      if (deleteTarget.type === 'departments') {
        res = await api.masterData.deleteDepartment(deleteTarget.id)
        showToast(`Department "${deleteTarget.name}" deleted`)
      } else if (deleteTarget.type === 'designations') {
        res = await api.masterData.deleteDesignation(deleteTarget.id)
        showToast(`Designation "${deleteTarget.name}" deleted`)
      } else if (deleteTarget.type === 'grades') {
        res = await api.masterData.deleteGrade(deleteTarget.id)
        showToast(`Grade "${deleteTarget.name}" deleted`)
      } else if (deleteTarget.type === 'costCentres') {
        res = await api.masterData.deleteCostCentre(deleteTarget.id)
        showToast(`Cost Centre "${deleteTarget.name}" deleted`)
      }

      if (res?.data) {
        setData(res.data)
      }
      setDeleteTarget(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }

  // Currency Formatter
  const formatINR = (val?: number) => {
    if (val === undefined || val === null) return '—'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <div className="space-y-6 w-full">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-xl animate-in slide-in-from-bottom-3 duration-200">
          <Check className="size-4 text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Hero Summary */}
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 size-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
              <Layers className="size-3.5" />
              <span>HR Organization Master Repository</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Master Data Architecture</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Standardize your organizational backbone across Departments, Designations, Grades & Bands, and Cost Centres. Changes immediately flow to employee profiles, salary structures, and approval matrices.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 text-xs font-semibold backdrop-blur transition-all border border-white/10 disabled:opacity-50"
              title="Refresh master data"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => handleOpenAdd(activeTab)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-xs font-bold shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="size-4" />
              <span>
                Add{' '}
                {activeTab === 'departments'
                  ? 'Department'
                  : activeTab === 'designations'
                  ? 'Designation'
                  : activeTab === 'grades'
                  ? 'Grade'
                  : 'Cost Centre'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Departments Stat */}
        <div
          onClick={() => setActiveTab('departments')}
          className={`cursor-pointer rounded-xl border p-4.5 transition-all ${
            activeTab === 'departments'
              ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-500'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Departments</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <Building2 className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.depts}</span>
            <span className="text-xs font-medium text-emerald-600">{stats.activeDepts} Active</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Core organizational divisions</p>
        </div>

        {/* Designations Stat */}
        <div
          onClick={() => setActiveTab('designations')}
          className={`cursor-pointer rounded-xl border p-4.5 transition-all ${
            activeTab === 'designations'
              ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-500'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Designations</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Briefcase className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.desigs}</span>
            <span className="text-xs font-medium text-emerald-600">{stats.activeDesigs} Active</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Roles & approval authorities</p>
        </div>

        {/* Grades Stat */}
        <div
          onClick={() => setActiveTab('grades')}
          className={`cursor-pointer rounded-xl border p-4.5 transition-all ${
            activeTab === 'grades'
              ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-500'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grades / Bands</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Award className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.grades}</span>
            <span className="text-xs font-medium text-emerald-600">{stats.activeGrades} Active</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Hierarchy & CTC compensation bands</p>
        </div>

        {/* Cost Centres Stat */}
        <div
          onClick={() => setActiveTab('costCentres')}
          className={`cursor-pointer rounded-xl border p-4.5 transition-all ${
            activeTab === 'costCentres'
              ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-500'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cost Centres</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Landmark className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.costCentres}</span>
            <span className="text-xs font-medium text-slate-600">
              {stats.totalBudget > 0 ? formatINR(stats.totalBudget) : 'Allocated'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Financial budgeting units</p>
        </div>
      </div>

      {/* Main Tab Controls & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Sub-tab pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
            <button
              onClick={() => {
                setActiveTab('departments')
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'departments'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Building2 className="size-4 text-indigo-600" />
              <span>Departments</span>
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                {data.departments.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('designations')
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'designations'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Briefcase className="size-4 text-blue-600" />
              <span>Designations</span>
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                {data.designations.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('grades')
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'grades'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Award className="size-4 text-amber-600" />
              <span>Grades & Bands</span>
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                {data.grades.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('costCentres')
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'costCentres'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Landmark className="size-4 text-emerald-600" />
              <span>Cost Centres</span>
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                {data.costCentres.length}
              </span>
            </button>
          </div>

          {/* Quick Add Button */}
          <button
            onClick={() => handleOpenAdd(activeTab)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Plus className="size-3.5" />
            <span>
              New{' '}
              {activeTab === 'departments'
                ? 'Department'
                : activeTab === 'designations'
                ? 'Designation'
                : activeTab === 'grades'
                ? 'Grade'
                : 'Cost Centre'}
            </span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search in ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`rounded-md px-2.5 py-1 font-semibold transition-all ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`rounded-md px-2.5 py-1 font-semibold transition-all ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('INACTIVE')}
                className={`rounded-md px-2.5 py-1 font-semibold transition-all ${
                  statusFilter === 'INACTIVE'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
            <AlertCircle className="size-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Table by Tab */}
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="mx-auto size-8 animate-spin text-indigo-500" />
            <p className="mt-2 text-xs font-semibold text-slate-500">Loading master repository...</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            {/* 1. DEPARTMENTS TAB */}
            {activeTab === 'departments' && (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Department Name</th>
                    <th className="py-3 px-4">Head of Department (HOD)</th>
                    <th className="py-3 px-4">Cost Centre Link</th>
                    <th className="py-3 px-4">Staff Count</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredDepartments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No departments found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDepartments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          <span className="inline-block rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-indigo-700">
                            {dept.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{dept.name}</div>
                          {dept.description && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{dept.description}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {dept.headEmployeeName ? (
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                              <div className="size-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                                {dept.headEmployeeName.charAt(0)}
                              </div>
                              <span>{dept.headEmployeeName}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Not Assigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-600">
                          {dept.costCenterId ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                              <Landmark className="size-3 text-emerald-600" />
                              {dept.costCenterId}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700">
                            <Users className="size-3" />
                            {dept.employeeCount || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              dept.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                dept.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {dept.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEdit('departments', dept)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                              title="Edit department"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteTarget({ type: 'departments', id: dept.id, name: dept.name })
                              }
                              className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Delete department"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 2. DESIGNATIONS TAB */}
            {activeTab === 'designations' && (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Designation Title</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Grade / Band</th>
                    <th className="py-3 px-4">Approval Authority</th>
                    <th className="py-3 px-4">Staff Count</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredDesignations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No designations found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDesignations.map((desig) => (
                      <tr key={desig.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          <span className="inline-block rounded bg-blue-50 border border-blue-100 px-2 py-0.5 text-blue-700">
                            {desig.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{desig.title}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {desig.departmentName || <span className="text-slate-400 italic">All Depts</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          {desig.gradeCode ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-bold text-amber-800">
                              <Award className="size-3 text-amber-600" />
                              {desig.gradeCode}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {desig.approvalLevel === 'L3' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                              <Shield className="size-3 text-purple-600" />
                              L3 (Executive)
                            </span>
                          ) : desig.approvalLevel === 'L2' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                              <Shield className="size-3 text-indigo-600" />
                              L2 (Manager)
                            </span>
                          ) : desig.approvalLevel === 'L1' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                              <Shield className="size-3 text-sky-600" />
                              L1 (Supervisor)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              None (Staff)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700">
                            <Users className="size-3" />
                            {desig.employeeCount || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              desig.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                desig.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {desig.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEdit('designations', desig)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                              title="Edit designation"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteTarget({ type: 'designations', id: desig.id, name: desig.title })
                              }
                              className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Delete designation"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 3. GRADES & BANDS TAB */}
            {activeTab === 'grades' && (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Band / Code</th>
                    <th className="py-3 px-4">Level Name</th>
                    <th className="py-3 px-4">Annual CTC Salary Band (INR)</th>
                    <th className="py-3 px-4">Annual Leave Quota</th>
                    <th className="py-3 px-4">Notice Period</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredGrades.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No grades found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredGrades.map((grade) => (
                      <tr key={grade.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          <span className="inline-block rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-800">
                            {grade.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{grade.name}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {grade.minSalary || grade.maxSalary ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                              {formatINR(grade.minSalary)} – {formatINR(grade.maxSalary)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Open band</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {grade.leaveQuota ? `${grade.leaveQuota} days / yr` : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {grade.noticePeriodDays ? `${grade.noticePeriodDays} days` : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              grade.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                grade.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {grade.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEdit('grades', grade)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                              title="Edit grade band"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteTarget({ type: 'grades', id: grade.id, name: grade.name })
                              }
                              className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Delete grade band"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 4. COST CENTRES TAB */}
            {activeTab === 'costCentres' && (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Cost Centre Code</th>
                    <th className="py-3 px-4">Cost Centre Name</th>
                    <th className="py-3 px-4">Department Link</th>
                    <th className="py-3 px-4">Annual Budget</th>
                    <th className="py-3 px-4">Currency</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredCostCentres.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No cost centres found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCostCentres.map((cc) => (
                      <tr key={cc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          <span className="inline-block rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-800">
                            {cc.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{cc.name}</div>
                          {cc.description && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{cc.description}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {cc.departmentName || <span className="text-slate-400 italic">General / Org-wide</span>}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {cc.annualBudget ? formatINR(cc.annualBudget) : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-slate-700">
                          {cc.currency || 'INR'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              cc.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                cc.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {cc.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEdit('costCentres', cc)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                              title="Edit cost centre"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteTarget({ type: 'costCentres', id: cc.id, name: cc.name })
                              }
                              className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Delete cost centre"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <MasterDataModal
          isOpen={modalOpen}
          type={modalType}
          item={editingItem}
          departments={data.departments}
          grades={data.grades}
          costCentres={data.costCentres}
          employeeOptions={data.employeeOptions}
          isSubmitting={isSubmitting}
          onClose={() => {
            setModalOpen(false)
            setEditingItem(null)
          }}
          onSave={handleSaveItem}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="size-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Deletion</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mt-2">
              Are you sure you want to delete <strong className="font-semibold text-slate-900">{deleteTarget.name}</strong>?
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Unified Form Modal for all 4 Master Data Entities
// =============================================================================

interface MasterDataModalProps {
  isOpen: boolean
  type: ActiveTab
  item?: any
  departments: DepartmentMaster[]
  grades: GradeMaster[]
  costCentres: CostCentreMaster[]
  employeeOptions: EmployeeOption[]
  isSubmitting: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
}

function MasterDataModal({
  isOpen,
  type,
  item,
  departments,
  grades,
  costCentres,
  employeeOptions,
  isSubmitting,
  onClose,
  onSave,
}: MasterDataModalProps) {
  // Form State initialized from item
  const [formData, setFormData] = React.useState<any>({
    id: item?.id || '',
    code: item?.code || '',
    name: item?.name || item?.title || '',
    title: item?.title || item?.name || '',
    description: item?.description || '',
    status: item?.status || 'ACTIVE',
    // Department specific
    headEmployeeId: item?.headEmployeeId || '',
    headEmployeeName: item?.headEmployeeName || '',
    costCenterId: item?.costCenterId || '',
    // Designation specific
    departmentId: item?.departmentId || '',
    departmentName: item?.departmentName || '',
    gradeId: item?.gradeId || '',
    gradeCode: item?.gradeCode || '',
    approvalLevel: item?.approvalLevel || 'NONE',
    // Grade specific
    minSalary: item?.minSalary ?? '',
    maxSalary: item?.maxSalary ?? '',
    leaveQuota: item?.leaveQuota ?? '',
    noticePeriodDays: item?.noticePeriodDays ?? '',
    // Cost Centre specific
    annualBudget: item?.annualBudget ?? '',
    currency: item?.currency || 'INR',
  })

  // Watch for HOD change to populate employee name automatically
  const handleHeadEmployeeChange = (empId: string) => {
    const selected = employeeOptions.find((e) => e.id === empId || e.employeeId === empId)
    setFormData({
      ...formData,
      headEmployeeId: empId,
      headEmployeeName: selected ? selected.name : '',
    })
  }

  // Watch for Department change in Designation or Cost Centre
  const handleDepartmentChange = (deptId: string) => {
    const selected = departments.find((d) => d.id === deptId)
    setFormData({
      ...formData,
      departmentId: deptId,
      departmentName: selected ? selected.name : '',
    })
  }

  // Watch for Grade change in Designation
  const handleGradeChange = (gradeId: string) => {
    const selected = grades.find((g) => g.id === gradeId)
    setFormData({
      ...formData,
      gradeId,
      gradeCode: selected ? selected.code : '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload: any = {
      id: formData.id || undefined,
      code: formData.code.trim().toUpperCase(),
      status: formData.status,
    }

    if (type === 'departments') {
      payload.name = formData.name.trim()
      payload.description = formData.description?.trim() || undefined
      payload.headEmployeeId = formData.headEmployeeId || undefined
      payload.headEmployeeName = formData.headEmployeeName || undefined
      payload.costCenterId = formData.costCenterId || undefined
    } else if (type === 'designations') {
      payload.title = (formData.title || formData.name).trim()
      payload.departmentId = formData.departmentId || undefined
      payload.departmentName = formData.departmentName || undefined
      payload.gradeId = formData.gradeId || undefined
      payload.gradeCode = formData.gradeCode || undefined
      payload.approvalLevel = formData.approvalLevel || 'NONE'
    } else if (type === 'grades') {
      payload.name = formData.name.trim()
      payload.minSalary = formData.minSalary !== '' ? Number(formData.minSalary) : undefined
      payload.maxSalary = formData.maxSalary !== '' ? Number(formData.maxSalary) : undefined
      payload.leaveQuota = formData.leaveQuota !== '' ? Number(formData.leaveQuota) : undefined
      payload.noticePeriodDays = formData.noticePeriodDays !== '' ? Number(formData.noticePeriodDays) : undefined
    } else if (type === 'costCentres') {
      payload.name = formData.name.trim()
      payload.description = formData.description?.trim() || undefined
      payload.departmentId = formData.departmentId || undefined
      payload.departmentName = formData.departmentName || undefined
      payload.annualBudget = formData.annualBudget !== '' ? Number(formData.annualBudget) : undefined
      payload.currency = formData.currency || 'INR'
    }

    onSave(payload)
  }

  if (!isOpen) return null

  const getTitle = () => {
    const action = item ? 'Edit' : 'Create'
    switch (type) {
      case 'departments':
        return `${action} Department`
      case 'designations':
        return `${action} Designation`
      case 'grades':
        return `${action} Grade / Band`
      case 'costCentres':
        return `${action} Cost Centre`
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              {type === 'departments' && <Building2 className="size-5" />}
              {type === 'designations' && <Briefcase className="size-5" />}
              {type === 'grades' && <Award className="size-5" />}
              {type === 'costCentres' && <Landmark className="size-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{getTitle()}</h3>
              <p className="text-xs text-slate-500">Configure master record attributes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Row 1: Code and Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={
                  type === 'departments'
                    ? 'e.g. ENG'
                    : type === 'designations'
                    ? 'e.g. SE-II'
                    : type === 'grades'
                    ? 'e.g. L3'
                    : 'e.g. CC-101'
                }
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          {/* Row 2: Title / Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {type === 'designations' ? 'Designation Title' : 'Name'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={
                type === 'departments'
                  ? 'e.g. Engineering'
                  : type === 'designations'
                  ? 'e.g. Senior Software Engineer'
                  : type === 'grades'
                  ? 'e.g. Senior Associate / Lead'
                  : 'e.g. Platform Research & Development'
              }
              value={type === 'designations' ? formData.title : formData.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  name: e.target.value,
                  title: e.target.value,
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* DEPARTMENT SPECIFIC FIELDS */}
          {type === 'departments' && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Head of Department (HOD)
                </label>
                <select
                  value={formData.headEmployeeId}
                  onChange={(e) => handleHeadEmployeeChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Select HOD from active staff...</option>
                  {employeeOptions.map((emp) => (
                    <option key={emp.id} value={emp.employeeId || emp.id}>
                      {emp.name} ({emp.employeeId || 'No ID'}) {emp.designation ? `— ${emp.designation}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Default Cost Centre Link
                </label>
                <select
                  value={formData.costCenterId}
                  onChange={(e) => setFormData({ ...formData, costCenterId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">None / Unlinked</option>
                  {costCentres.map((cc) => (
                    <option key={cc.id} value={cc.code}>
                      {cc.code} — {cc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Department mission or operational mandate..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {/* DESIGNATION SPECIFIC FIELDS */}
          {type === 'designations' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">All Departments / Org-wide</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Grade / Band
                  </label>
                  <select
                    value={formData.gradeId}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {grades.map((grd) => (
                      <option key={grd.id} value={grd.id}>
                        {grd.code} — {grd.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Approval Authority Hierarchy
                </label>
                <select
                  value={formData.approvalLevel}
                  onChange={(e) => setFormData({ ...formData, approvalLevel: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="NONE">None (Individual Contributor / Standard Staff)</option>
                  <option value="L1">Level 1 (Direct Supervisor / Team Lead)</option>
                  <option value="L2">Level 2 (Department Head / Functional Manager)</option>
                  <option value="L3">Level 3 (Vice President / Executive Leadership)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Used by leave, attendance regularization, and expense approval routing algorithms.
                </p>
              </div>
            </>
          )}

          {/* GRADE SPECIFIC FIELDS */}
          {type === 'grades' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Min CTC (Annual INR ₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 600000"
                    value={formData.minSalary}
                    onChange={(e) => setFormData({ ...formData, minSalary: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Max CTC (Annual INR ₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 1200000"
                    value={formData.maxSalary}
                    onChange={(e) => setFormData({ ...formData, maxSalary: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Annual Leave Quota (Days)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 24"
                    value={formData.leaveQuota}
                    onChange={(e) => setFormData({ ...formData, leaveQuota: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Notice Period (Days)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 60"
                    value={formData.noticePeriodDays}
                    onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* COST CENTRE SPECIFIC FIELDS */}
          {type === 'costCentres' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">General / Org-wide</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Annual Budget
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000000"
                  value={formData.annualBudget}
                  onChange={(e) => setFormData({ ...formData, annualBudget: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Cost centre scope or financial accounting codes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : item ? 'Save Changes' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
