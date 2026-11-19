"use client"

import * as React from 'react'
import {
  SectionCard,
  DataTable,
  Button,
  Avatar,
  type ColumnDef,
  type SortDirection
} from '@hryantra/ui'
import Link from 'next/link'
import { 
  Trash2, UserPlus, Users, Network, PartyPopper, Search, 
  ChevronRight, UserCheck, UserX, ShieldCheck, Sparkles, Building2,
  Mail, Phone
} from 'lucide-react'
import { Employee } from '../types'
import { OrgChartView } from '../components/OrgChartView'
import { CelebrationsDirectory } from '../components/CelebrationsDirectory'

import { useRouter } from 'next/navigation'

import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'

export function EmployeeListPage() {
  const router = useRouter()
  const { employees, addEmployee, deleteEmployee, hasAction } = useStore()
  const canCreate = hasAction('employees_create')
  const canDelete = hasAction('employees_delete')
  const [activeViewTab, setActiveViewTab] = React.useState<'directory' | 'org-chart' | 'celebrations'>('directory')
  
  // Search and Filtering State
  const [searchQuery, setSearchQuery] = React.useState('')
  const [departmentFilter, setDepartmentFilter] = React.useState('ALL')
  const [statusFilter, setStatusFilter] = React.useState('ALL')
  
  const [sortColumn, setSortColumn] = React.useState<string | undefined>()
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)
  const [page, setPage] = React.useState(1)
  const perPage = 10

  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [formData, setFormData] = React.useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    locationId: '',
    allowWebPunch: true,
  })
  const [workLocations, setWorkLocations] = React.useState<{ id: string; name: string }[]>([])
  const [masterDepartments, setMasterDepartments] = React.useState<{ id: string; name: string; code: string }[]>([])
  const [masterDesignations, setMasterDesignations] = React.useState<{ id: string; title: string; code: string; departmentName?: string }[]>([])

  React.useEffect(() => {
    if (!isAddModalOpen) return
    api.locations.getAll(true)
      .then((res) => {
        const rows = Array.isArray(res?.data) ? res.data : []
        setWorkLocations(rows.map((loc: any) => ({ id: loc.id, name: loc.name })))
      })
      .catch(() => setWorkLocations([]))

    api.masterData.getAll()
      .then((res) => {
        if (res?.data) {
          setMasterDepartments(res.data.departments || [])
          setMasterDesignations(res.data.designations || [])
        }
      })
      .catch(() => {})
  }, [isAddModalOpen])

  // Sync tab from URL
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'org-chart' || tab === 'celebrations' || tab === 'directory') {
        setActiveViewTab(tab)
      }
    }
  }, [])

  const handleTabChange = (tab: 'directory' | 'org-chart' | 'celebrations') => {
    setActiveViewTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (tab === 'directory') {
        url.searchParams.delete('tab')
      } else {
        url.searchParams.set('tab', tab)
      }
      window.history.replaceState({}, '', url.toString())
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await addEmployee(formData)
      if (formData.allowWebPunch !== undefined && formData.employeeId) {
        await api.attendance.setWebPunchPermission({
          employeeId: formData.employeeId,
          allowed: formData.allowWebPunch,
        }).catch(() => {})
      }
      setIsAddModalOpen(false)
      setFormData({
        employeeId: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        designation: '',
        department: '',
        joiningDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
        locationId: '',
        allowWebPunch: true,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add employee')
    }
  }

  const handleDelete = async (employee: Employee, event: React.MouseEvent) => {
    event.stopPropagation()
    const confirmed = window.confirm(`Delete employee ${employee.name}?`)
    if (!confirmed) return

    try {
      await deleteEmployee(employee.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete employee')
    }
  }

  // Summary statistics
  const stats = React.useMemo(() => {
    const total = employees.length
    const active = employees.filter(e => e.status === 'Active' || e.status === 'ACTIVE').length
    const onLeave = employees.filter(e => e.status === 'On Leave' || e.status === 'ON_LEAVE').length
    const withLogin = employees.filter(e => e.hasLogin).length
    const activePct = total > 0 ? Math.round((active / total) * 100) : 0
    return { total, active, onLeave, withLogin, activePct }
  }, [employees])

  // Extract distinct departments for filtering
  const departments = React.useMemo(() => {
    const set = new Set<string>()
    employees.forEach(e => { if (e.department) set.add(e.department) })
    return Array.from(set).sort()
  }, [employees])

  // Filter employees based on search, department, and status
  const filteredEmployees = React.useMemo(() => {
    return employees.filter(emp => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch = !q || 
        (emp.name && emp.name.toLowerCase().includes(q)) ||
        (emp.email && emp.email.toLowerCase().includes(q)) ||
        (emp.id && emp.id.toLowerCase().includes(q)) ||
        (emp.designation && emp.designation.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q))

      const matchesDept = departmentFilter === 'ALL' || emp.department === departmentFilter
      const matchesStatus = statusFilter === 'ALL' || 
        (statusFilter === 'ACTIVE' && (emp.status === 'Active' || emp.status === 'ACTIVE')) ||
        (statusFilter === 'ON_LEAVE' && (emp.status === 'On Leave' || emp.status === 'ON_LEAVE')) ||
        (statusFilter === 'INACTIVE' && (emp.status === 'Inactive' || emp.status === 'INACTIVE'))

      return matchesSearch && matchesDept && matchesStatus
    })
  }, [employees, searchQuery, departmentFilter, statusFilter])

  // Sorting
  const sortedEmployees = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredEmployees
    return [...filteredEmployees].sort((a, b) => {
      const aVal = a[sortColumn as keyof Employee] ?? ''
      const bVal = b[sortColumn as keyof Employee] ?? ''
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return 0
    })
  }, [filteredEmployees, sortColumn, sortDirection])

  const handleSort = (columnId: string, direction: SortDirection) => {
    setSortColumn(columnId)
    setSortDirection(direction)
  }

  // Paginated Data
  const paginatedEmployees = React.useMemo(() => {
    const start = (page - 1) * perPage
    return sortedEmployees.slice(start, start + perPage)
  }, [sortedEmployees, page, perPage])

  // Compact, modern columns matching Attendance & Dashboard efficiency
  const columns: ColumnDef<Employee>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Employee',
      sortable: true,
      cell: ({ row }) => {
        const name = row.name || 'Unnamed'
        const initials = name
          .split(' ')
          .map(n => n.charAt(0))
          .join('')
          .substring(0, 2)
          .toUpperCase()
        return (
          <div className="flex items-center gap-2.5 py-1">
            <Avatar 
              initials={initials} 
              size="sm" 
              gradient="indigo" 
            />
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {name}
              </span>
              <span className="truncate text-[11px] font-semibold text-slate-400">
                {row.id}
              </span>
            </div>
          </div>
        )
      }
    },
    {
      id: 'role_dept',
      header: 'Role & Dept',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-0">
          <span className="truncate text-xs font-semibold text-slate-800">
            {row.designation || 'Specialist'}
          </span>
          <span className="truncate text-[11px] font-medium text-slate-400">
            {row.department || 'General'}
          </span>
        </div>
      )
    },
    {
      id: 'email',
      accessorKey: 'email',
      header: 'Contact',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-0">
          <span className="truncate text-xs font-medium text-slate-600">
            {row.email || '—'}
          </span>
          {row.locationName && (
            <span className="truncate text-[10px] text-slate-400 font-medium">
              {row.locationName}
            </span>
          )}
        </div>
      )
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      sortable: true,
      cell: ({ row }) => {
        const isActive = row.status === 'Active' || row.status === 'ACTIVE'
        const isOnLeave = row.status === 'On Leave' || row.status === 'ON_LEAVE'
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
            isActive
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
              : isOnLeave
              ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}>
            <span className={`size-1.5 rounded-full ${
              isActive ? 'bg-emerald-500' : isOnLeave ? 'bg-amber-500' : 'bg-slate-400'
            }`} />
            {row.status === 'ACTIVE' ? 'Active' : row.status === 'ON_LEAVE' ? 'On Leave' : row.status}
          </span>
        )
      }
    },
    {
      id: 'login',
      header: 'HRMS Login',
      cell: ({ row }) => (
        row.hasLogin ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
            <span className="size-1 rounded-full bg-emerald-500" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
            <span className="size-1 rounded-full bg-amber-500" /> Not Created
          </span>
        )
      )
    },
    {
      id: 'manager',
      accessorKey: 'manager',
      header: 'Manager',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-slate-700">
          {row.manager || 'Unassigned'}
        </span>
      )
    },
    {
      id: 'actions',
      header: '',
      width: 110,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1 pr-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => router.push(`/employees/${row.id}`)}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/80 h-7 px-2.5"
          >
            View <ChevronRight className="size-3 ml-0.5" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e: React.MouseEvent) => handleDelete(row, e)}
              aria-label={`Delete ${row.name}`}
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-7 w-7"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
      {/* ── 1. Executive Top Switcher & Action Bar (Clean, no oversized double title) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleTabChange('directory')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeViewTab === 'directory'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Users className="size-3.5" />
            Employee Directory ({employees.length})
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('org-chart')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeViewTab === 'org-chart'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Network className="size-3.5" />
            Visual Org Tree
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('celebrations')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeViewTab === 'celebrations'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <PartyPopper className="size-3.5" />
            Celebrations & Anniversaries
          </button>
        </div>

        {canCreate && (
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/onboarding">
              <Button variant="default" size="sm" className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 shadow-2xs font-semibold">
                <UserPlus className="size-3.5 mr-1.5" />
                New joiner (Onboarding)
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-slate-200 font-semibold" onClick={() => setIsAddModalOpen(true)}>
              Quick add
            </Button>
          </div>
        )}
      </div>

      {activeViewTab === 'org-chart' && <OrgChartView />}

      {activeViewTab === 'celebrations' && <CelebrationsDirectory />}

      {activeViewTab === 'directory' && (
        <>
          {/* ── 2. Subtle Gradient KPI Stat Cards (Matching Celebrations Tab Style) ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Total Employees (Blue) */}
            <div className="bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Total Workforce</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</span>
                <span className="text-[11px] text-blue-600/90 font-medium">Across organization</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Users className="size-5" />
              </div>
            </div>

            {/* Card 2: Active Workforce (Emerald) */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Active Status</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{stats.active}</span>
                <span className="text-[11px] text-emerald-700/90 font-medium">{stats.activePct}% operational</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <UserCheck className="size-5" />
              </div>
            </div>

            {/* Card 3: On Leave (Rose) */}
            <div className="bg-gradient-to-br from-rose-50/90 via-white to-pink-50/40 border border-rose-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">On Leave</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{stats.onLeave}</span>
                <span className="text-[11px] text-rose-700/90 font-medium">Scheduled time-off</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <UserX className="size-5" />
              </div>
            </div>

            {/* Card 4: Portal Ready (Indigo) */}
            <div className="bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/40 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Portal Access</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5">{stats.withLogin}</span>
                <span className="text-[11px] text-indigo-600/90 font-medium">Self-service accounts</span>
              </div>
              <div className="size-11 rounded-2xl bg-white/95 shadow-2xs border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <ShieldCheck className="size-5" />
              </div>
            </div>
          </div>

          {/* ── 3. Search & Filter Controls Bar ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2.5 flex-1 flex-wrap">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, role, email..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-7 py-1.5 rounded-xl border border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Department Filter */}
              <select
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-xl border border-slate-200/90 bg-slate-50/50 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-xl border border-slate-200/90 bg-slate-50/50 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              {(searchQuery || departmentFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setDepartmentFilter('ALL'); setStatusFilter('ALL'); setPage(1); }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 cursor-pointer"
                >
                  Reset filters
                </button>
              )}
            </div>

            <div className="text-xs font-medium text-slate-500 self-start sm:self-auto shrink-0">
              Showing <strong className="text-slate-900">{filteredEmployees.length}</strong> of <strong className="text-slate-900">{employees.length}</strong> employees
            </div>
          </div>

          {/* ── 4. Compact Notification / Flow Helper Chip ── */}
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="size-5 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-600">i</span>
              <span>
                <strong>Tip:</strong> Provision new hires via Onboarding tab. To configure login credentials, link accounts in{' '}
                <Link href="/users" className="font-semibold text-indigo-600 underline hover:text-indigo-800">
                  Users
                </Link>.
              </span>
            </div>
            {employees.some((e) => !e.hasLogin) && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {employees.filter(e => !e.hasLogin).length} pending portal link
              </span>
            )}
          </div>

          {/* ── 5. Efficient, Compact Table Block (Matching Attendance Layout) ── */}
          <SectionCard noPadding bodyClassName="p-0">
            <DataTable
              data={paginatedEmployees}
              columns={columns}
              keyExtractor={(row) => row.id}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              onRowClick={(row) => router.push(`/employees/${row.id}`)}
              pagination={{
                page: page,
                perPage: perPage,
                total: sortedEmployees.length,
                onPageChange: setPage,
                perPageOptions: [10, 20, 50]
              }}
            />
          </SectionCard>
        </>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm transition-all duration-200">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/40">
              <h2 className="text-ds-title-sm font-semibold text-foreground">Add Employee</h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Employee ID</label>
                  <input
                    type="text"
                    required
                    placeholder="EMP-005"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">Department</label>
                    {masterDepartments.length > 0 && (
                      <span className="text-[10px] text-indigo-600 font-semibold">{masterDepartments.length} in Master Data</span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    list="master-dept-list"
                    placeholder="Engineering"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                  <datalist id="master-dept-list">
                    {masterDepartments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Assigned location (auto-punch)</label>
                <select
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
                  value={formData.locationId}
                  onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                >
                  <option value="">None</option>
                  {workLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="John"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Last Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Doe"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="john.doe@company.com"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">Designation</label>
                  {masterDesignations.length > 0 && (
                    <span className="text-[10px] text-indigo-600 font-semibold">{masterDesignations.length} in Master Data</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  list="master-desig-list"
                  placeholder="Software Engineer"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                />
                <datalist id="master-desig-list">
                  {masterDesignations.map((des) => (
                    <option key={des.id} value={des.title}>
                      {des.title} ({des.code})
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Joining Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Status</label>
                  <select
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ON_LEAVE">ON LEAVE</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Web clock-in permission</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.allowWebPunch}
                    onChange={(e) => setFormData({ ...formData, allowWebPunch: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="default"
                >
                  Save Employee
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
