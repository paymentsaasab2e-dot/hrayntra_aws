"use client"
import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PageHeroBanner,
  SectionCard,
  Button,
  Input,
  Select,
  FormGrid,
  MetricStatCard,
  DrawerWrapper,
  EmptyState,
} from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import {
  ACTION_LABELS,
  TAB_LABELS,
  TabKey,
  ActionKey,
  UserPermissions,
  ensurePermissionShape,
  FULL_PERMISSIONS,
  PERMISSION_MODULES,
} from '@/shared/permissions'
import { suggestFromEmail } from '../utils/userFormHelpers'
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  UserCheck,
} from 'lucide-react'

type LinkedEmployee = {
  id: string
  employeeId: string
  name: string
  email?: string
  department?: string
  designation?: string
  locationId?: string | null
  locationName?: string | null
}

type ApiUser = {
  id: string
  email: string
  role: string
  displayName: string
  status: string
  permissions: UserPermissions
  employee?: LinkedEmployee | null
}

type WorkLocationOption = { id: string; name: string }
type OrgUnitOption = { id: string; name: string; isLeaf: boolean; levelOrder: number }

const BACKEND_ROLES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] as const

const ROLE_HINTS: Record<string, string> = {
  ADMIN: 'Full system access (superadmin).',
  HR: 'HR operations template — customize below.',
  MANAGER: 'Team lead template — customize below.',
  EMPLOYEE: 'Self-service template — customize below.',
}

function AttendancePunchSettings({
  permissions,
  role,
  onChange,
}: {
  permissions: UserPermissions
  role: string
  onChange: (next: UserPermissions) => void
}) {
  const setPunch = (action: ActionKey, enabled: boolean) => {
    const next = ensurePermissionShape(role, permissions)
    next.actions[action] = enabled
    if (enabled) next.tabs.attendance = true
    onChange({ ...next, tabs: { ...next.tabs }, actions: { ...next.actions } })
  }

  return (
    <div className="col-span-2 rounded-lg border border-ds-neutral-200 bg-ds-neutral-50/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-ds-brand-navy">Attendance punch mode</p>
      <p className="text-xs text-ds-neutral-500">
        Office punch uses the assigned location geofence. Remote punch allows check-in outside the fence (GPS still recorded).
      </p>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="size-4 rounded border-ds-neutral-300"
          checked={permissions.actions.attendance_punch_self === true}
          onChange={(e) => setPunch('attendance_punch_self', e.target.checked)}
        />
        <span>Office / on-site punch (geofence required)</span>
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="size-4 rounded border-ds-neutral-300"
          checked={permissions.actions.attendance_punch_remote_self === true}
          onChange={(e) => setPunch('attendance_punch_remote_self', e.target.checked)}
        />
        <span>Remote punch allowed</span>
      </label>
    </div>
  )
}

function PermissionsEditor({
  role,
  permissions,
  expandedModules,
  onPermissionsChange,
  onToggleModule,
  onTabEnabled,
  onActionEnabled,
  onGrantAll,
  onResetTemplate,
  onClearAll,
}: {
  role: string
  permissions: UserPermissions
  expandedModules: Record<string, boolean>
  onPermissionsChange: (p: UserPermissions) => void
  onToggleModule: (tab: TabKey) => void
  onTabEnabled: (tab: TabKey, enabled: boolean) => void
  onActionEnabled: (action: ActionKey, enabled: boolean) => void
  onGrantAll: () => void
  onResetTemplate: () => void
  onClearAll: () => void
}) {
  const enabledTabCount = PERMISSION_MODULES.filter((m) => permissions.tabs[m.tab] === true).length
  const enabledActionCount = Object.values(permissions.actions).filter(Boolean).length

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={onGrantAll}>Grant all</Button>
        <Button variant="outline" size="sm" onClick={onResetTemplate}>Reset to {role} template</Button>
        <Button variant="outline" size="sm" onClick={onClearAll}>Clear all</Button>
        <span className="text-xs text-ds-neutral-500 ml-auto">
          {enabledTabCount} tabs · {enabledActionCount} actions selected
        </span>
      </div>

      <div className="rounded-lg border border-ds-neutral-200 divide-y divide-ds-neutral-100">
        {PERMISSION_MODULES.map((module) => {
          const tabEnabled = permissions.tabs[module.tab] === true
          const isExpanded = expandedModules[module.tab] ?? tabEnabled
          const hasActions = module.actions.length > 0
          const enabledActionsInModule = module.actions.filter((a) => permissions.actions[a] === true).length

          return (
            <div key={module.tab} className="bg-white">
              <div className="flex items-center gap-3 px-4 py-3">
                {hasActions ? (
                  <button type="button" onClick={() => onToggleModule(module.tab)} className="text-ds-neutral-400 hover:text-ds-brand-navy">
                    {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                ) : (
                  <span className="w-4" />
                )}
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-ds-neutral-300"
                    checked={tabEnabled}
                    onChange={(e) => onTabEnabled(module.tab, e.target.checked)}
                  />
                  <span className="text-sm font-semibold text-ds-brand-navy">{TAB_LABELS[module.tab]}</span>
                </label>
                {hasActions && (
                  <span className="text-xs text-ds-neutral-500">
                    {enabledActionsInModule}/{module.actions.length} actions
                  </span>
                )}
              </div>
              {hasActions && isExpanded && (
                <div className={`px-4 pb-3 pl-11 grid sm:grid-cols-2 gap-2 ${tabEnabled ? '' : 'opacity-50'}`}>
                  {module.actions.map((action) => (
                    <label key={action} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-ds-neutral-300"
                        checked={permissions.actions[action] === true}
                        disabled={!tabEnabled}
                        onChange={(e) => onActionEnabled(action, e.target.checked)}
                      />
                      <span className="text-ds-neutral-700">{ACTION_LABELS[action]}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function UserManagementPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasAction, employees, refreshEmployees, showUsersLocationColumn } = useStore()
  const [users, setUsers] = React.useState<ApiUser[]>([])
  const [workLocations, setWorkLocations] = React.useState<WorkLocationOption[]>([])
  const [orgUnits, setOrgUnits] = React.useState<OrgUnitOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [displayName, setDisplayName] = React.useState('')
  const [role, setRole] = React.useState<string>('EMPLOYEE')
  const [profileMode, setProfileMode] = React.useState<'auto' | 'link'>('link')
  const [department, setDepartment] = React.useState('General')
  const [designation, setDesignation] = React.useState('')
  const [employeeCode, setEmployeeCode] = React.useState('')
  const [locationId, setLocationId] = React.useState('')
  const [orgUnitId, setOrgUnitId] = React.useState('')
  const [linkEmployeeRecordId, setLinkEmployeeRecordId] = React.useState('')
  const [permissions, setPermissions] = React.useState<UserPermissions>(() => ensurePermissionShape('EMPLOYEE'))
  const [expandedModules, setExpandedModules] = React.useState<Record<string, boolean>>({})

  const [createDrawerOpen, setCreateDrawerOpen] = React.useState(false)
  const deepLinkHandled = React.useRef(false)

  const [editingUser, setEditingUser] = React.useState<ApiUser | null>(null)
  const [editEmail, setEditEmail] = React.useState('')
  const [editPassword, setEditPassword] = React.useState('')
  const [editDisplayName, setEditDisplayName] = React.useState('')
  const [editRole, setEditRole] = React.useState('EMPLOYEE')
  const [editLocationId, setEditLocationId] = React.useState('')
  const [editOrgUnitId, setEditOrgUnitId] = React.useState('')
  const [editPermissions, setEditPermissions] = React.useState<UserPermissions>(() => ensurePermissionShape('EMPLOYEE'))
  const [editExpandedModules, setEditExpandedModules] = React.useState<Record<string, boolean>>({})

  const canManage = hasAction('users_manage')

  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.getAll()
      setUsers(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLocations = React.useCallback(async () => {
    try {
      const res = await api.locations.getAll(true)
      setWorkLocations(Array.isArray(res?.data) ? res.data.map((l: any) => ({ id: l.id, name: l.name })) : [])
    } catch {
      setWorkLocations([])
    }
  }, [])

  const loadOrgUnits = React.useCallback(async () => {
    try {
      const res = await api.orgUnits.getTree()
      const data = Array.isArray(res?.data) ? res.data : []
      setOrgUnits(
        data
          .filter((u: any) => u.status === 'ACTIVE')
          .map((u: any) => ({ id: u.id, name: u.name, isLeaf: u.isLeaf, levelOrder: u.levelOrder }))
      )
    } catch {
      setOrgUnits([])
    }
  }, [])

  React.useEffect(() => {
    if (canManage) {
      loadUsers()
      loadLocations()
      loadOrgUnits()
    }
  }, [canManage, loadUsers, loadLocations, loadOrgUnits])

  const employeesWithoutLogin = React.useMemo(
    () => employees.filter((emp) => !emp.hasLogin),
    [employees]
  )

  const fillFromLinkedEmployee = React.useCallback((recordId: string) => {
    const emp = employees.find((e) => e.recordId === recordId)
    if (!emp) return
    setEmail(emp.email)
    setDisplayName(emp.name)
    setEmployeeCode(emp.id)
    setDepartment(emp.department)
    setDesignation(emp.designation)
    setLocationId(emp.locationId || '')
    setOrgUnitId(emp.orgUnitId || '')
  }, [employees])

  React.useEffect(() => {
    if (profileMode === 'link' && linkEmployeeRecordId) {
      fillFromLinkedEmployee(linkEmployeeRecordId)
    }
  }, [profileMode, linkEmployeeRecordId, fillFromLinkedEmployee])

  const handleEmailBlur = () => {
    if (profileMode !== 'auto' || !email.trim()) return
    const { displayName: suggestedName, employeeCode: suggestedCode } = suggestFromEmail(email)
    if (!displayName.trim() && suggestedName) setDisplayName(suggestedName)
    if (!employeeCode.trim() && suggestedCode) setEmployeeCode(suggestedCode)
  }

  const applyRoleTemplate = React.useCallback((nextRole: string, setter: (p: UserPermissions) => void) => {
    setter(ensurePermissionShape(nextRole))
  }, [])

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole)
    applyRoleTemplate(nextRole, setPermissions)
  }

  const makePermissionHandlers = (
    currentRole: string,
    setter: React.Dispatch<React.SetStateAction<UserPermissions>>,
    expandSetter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  ) => ({
    setTabEnabled: (tab: TabKey, enabled: boolean) => {
      setter((prev) => {
        const next = ensurePermissionShape(currentRole, prev)
        next.tabs[tab] = enabled
        const module = PERMISSION_MODULES.find((m) => m.tab === tab)
        if (!enabled && module) module.actions.forEach((a) => { next.actions[a] = false })
        return { ...next, tabs: { ...next.tabs }, actions: { ...next.actions } }
      })
    },
    setActionEnabled: (action: ActionKey, enabled: boolean) => {
      setter((prev) => {
        const next = ensurePermissionShape(currentRole, prev)
        next.actions[action] = enabled
        return { ...next, actions: { ...next.actions } }
      })
    },
    toggleModule: (tab: TabKey) => expandSetter((prev) => ({ ...prev, [tab]: !prev[tab] })),
  })

  const createPerm = makePermissionHandlers(role, setPermissions, setExpandedModules)
  const editPerm = makePermissionHandlers(editRole, setEditPermissions, setEditExpandedModules)

  const resetCreateForm = () => {
    setEmail('')
    setPassword('')
    setDisplayName('')
    setDepartment('General')
    setDesignation('')
    setEmployeeCode('')
    setLocationId('')
    setOrgUnitId('')
    setLinkEmployeeRecordId('')
    // Always prefer link — never default to auto-create (avoids duplicate employees)
    setProfileMode('link')
    setRole('EMPLOYEE')
    setPermissions(ensurePermissionShape('EMPLOYEE'))
  }

  const openCreateDrawer = React.useCallback((preselectRecordId?: string) => {
    resetCreateForm()
    setError(null)
    setProfileMode('link')
    if (preselectRecordId) {
      setLinkEmployeeRecordId(preselectRecordId)
    }
    setCreateDrawerOpen(true)
  }, [employees])

  // Deep-link from Onboarding: /users?create=1&linkEmployee=<recordId>
  React.useEffect(() => {
    if (!canManage || deepLinkHandled.current) return
    const shouldCreate = searchParams.get('create') === '1'
    const linkId = searchParams.get('linkEmployee')
    if (!shouldCreate && !linkId) return
    deepLinkHandled.current = true
    openCreateDrawer(linkId || undefined)
    setSuccess(
      linkId
        ? 'Employee ready — set password, role, and permissions to finish login.'
        : null
    )
    router.replace('/users')
  }, [canManage, searchParams, openCreateDrawer, router])

  // When employees load after deep-link, fill form fields from linked employee
  React.useEffect(() => {
    if (createDrawerOpen && profileMode === 'link' && linkEmployeeRecordId) {
      fillFromLinkedEmployee(linkEmployeeRecordId)
    }
  }, [createDrawerOpen, employees, linkEmployeeRecordId, profileMode, fillFromLinkedEmployee])

  const handleCreate = async () => {
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    if (profileMode === 'link' && !linkEmployeeRecordId) {
      setError('Select an employee to link. Complete onboarding first if the list is empty.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await api.users.create({
        email,
        password,
        displayName: displayName || email,
        role,
        permissions: ensurePermissionShape(role, permissions),
        department,
        designation: designation || undefined,
        employeeCode: employeeCode || undefined,
        locationId: locationId || undefined,
        orgUnitId: orgUnitId || undefined,
        createEmployee: profileMode === 'auto',
        linkEmployeeRecordId: profileMode === 'link' ? linkEmployeeRecordId : undefined,
      })
      const employeeNote = res?.employee?.employeeId ? ` Linked to employee ${res.employee.employeeId}.` : ''
      const emailNote = res?.email?.sent ? ` Welcome email sent.` : ''
      setSuccess((res?.message || 'User created.') + employeeNote + emailNote)
      resetCreateForm()
      setCreateDrawerOpen(false)
      await Promise.all([loadUsers(), refreshEmployees()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (user: ApiUser) => {
    setEditingUser(user)
    setEditEmail(user.email)
    setEditPassword('')
    setEditDisplayName(user.displayName)
    setEditRole(user.role)
    setEditLocationId(user.employee?.locationId || '')
    setEditOrgUnitId((user as any).orgUnitId || user.employee?.orgUnitId || '')
    setEditPermissions(ensurePermissionShape(user.role, user.permissions))
  }

  const handleUpdate = async () => {
    if (!editingUser) return
    if (!editEmail.trim()) {
      setError('Email is required')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await api.users.update(editingUser.id, {
        email: editEmail,
        displayName: editDisplayName || editEmail,
        role: editRole,
        ...(editPassword ? { password: editPassword } : {}),
        permissions: ensurePermissionShape(editRole, editPermissions),
        locationId: editLocationId || null,
        orgUnitId: editOrgUnitId || null,
      })
      setSuccess('User updated. Employee must log out and log in again for permission changes.')
      setEditingUser(null)
      await Promise.all([loadUsers(), refreshEmployees()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user account?')) return
    try {
      await api.users.delete(id)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const userStats = React.useMemo(() => {
    const linked = users.filter((u) => u.employee?.employeeId).length
    const privileged = users.filter((u) => u.role === 'ADMIN' || u.role === 'HR').length
    return { linked, privileged }
  }, [users])

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-ds-neutral-50">
        <ShieldCheck className="size-16 text-ds-neutral-200 mb-4" />
        <h3 className="text-ds-heading text-ds-brand-navy">Access restricted</h3>
        <p className="text-ds-body text-ds-neutral-500 max-w-md">
          You do not have permission to manage users. Contact a superadmin.
        </p>
      </div>
    )
  }

  const accountDetailsForm = (
    <FormGrid cols={2}>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Email (login)</label>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleEmailBlur}
          placeholder="user@company.com"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Password</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set login password" />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Display name</label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Auto-filled from email or employee" />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Role template</label>
        <Select value={role} onChange={(e) => handleRoleChange(e.target.value)}>
          {BACKEND_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Select>
        <p className="text-xs text-ds-neutral-500 mt-1">{ROLE_HINTS[role]}</p>
      </div>

      <div className="col-span-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Employee profile</label>
        <Select
          value={profileMode}
          onChange={(e) => {
            const mode = e.target.value as 'auto' | 'link'
            setProfileMode(mode)
            if (mode === 'auto') setLinkEmployeeRecordId('')
          }}
        >
          <option value="link">Link existing employee (recommended)</option>
          <option value="auto">Emergency only: auto-create employee (risk of duplicates)</option>
        </Select>
        <p className="text-xs text-slate-500 mt-1">
          Prefer Onboarding → Complete, then link here. Auto-create skips onboarding and can duplicate people.
        </p>
      </div>

      {profileMode === 'link' ? (
        <div className="col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Employee without login</label>
          <Select value={linkEmployeeRecordId} onChange={(e) => setLinkEmployeeRecordId(e.target.value)}>
            <option value="">Select employee</option>
            {employeesWithoutLogin.map((emp) => (
              <option key={emp.recordId || emp.id} value={emp.recordId || ''}>
                {emp.name} ({emp.id}) — {emp.department}
                {emp.locationName ? ` · ${emp.locationName}` : ''}
              </option>
            ))}
          </Select>
          {employeesWithoutLogin.length === 0 && (
            <p className="text-xs text-amber-700 mt-1">
              No employees waiting for login.{' '}
              <Link href="/onboarding" className="font-semibold underline">
                Complete onboarding
              </Link>{' '}
              or{' '}
              <Link href="/employees" className="font-semibold underline">
                quick-add an employee
              </Link>{' '}
              first.
            </p>
          )}
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Department</label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Designation</label>
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Employee ID</label>
            <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="Auto-suggested from email" />
          </div>
        </>
      )}

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Org unit</label>
        <Select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}>
          <option value="">No org unit</option>
          {orgUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.isLeaf ? 'Site' : u.levelOrder === 1 ? 'HQ' : 'Division'})
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Assigned location</label>
        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">No location assigned</option>
          {workLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </Select>
      </div>

      <AttendancePunchSettings permissions={permissions} role={role} onChange={setPermissions} />
    </FormGrid>
  )

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6 pb-10">
      <section className="flex flex-col gap-4">
        <PageHeroBanner
          compact
          eyebrow={dateEyebrow}
          title="User Management"
          description="Create login for existing employees (link). Do not auto-create a second employee after onboarding."
          actions={
            <Button variant="default" onClick={() => openCreateDrawer()}>
              <UserPlus className="size-4" />
              Add login
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard label="Total Accounts" value={users.length} subtitle="Active login users" tone="blue" icon={Users} />
          <MetricStatCard label="Linked Employees" value={userStats.linked} subtitle="Profile connected" tone="mint" icon={UserCheck} />
          <MetricStatCard label="Awaiting Login" value={employeesWithoutLogin.length} subtitle="Employees without account" tone="amber" icon={Link2} />
          <MetricStatCard label="Admin / HR" value={userStats.privileged} subtitle="Privileged roles" tone="lavender" icon={ShieldCheck} />
        </div>
      </section>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <SectionCard
        title="User accounts"
        titleAction={
          <span className="text-xs font-medium text-ds-neutral-500">
            {loading ? 'Loading…' : `${users.length} account${users.length === 1 ? '' : 's'}`}
          </span>
        }
      >
        {loading ? (
          <p className="text-sm text-ds-neutral-500 py-8 text-center">Loading users...</p>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="size-10 text-ds-neutral-300" />}
            title="No user accounts yet"
            description="Create the first login account and link it to an employee profile."
            action={
            <Button variant="default" onClick={() => openCreateDrawer()}>
              <UserPlus className="size-4" />
              Add login
            </Button>
          }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Name</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Email</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Role</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Employee</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Org unit</th>
                  {showUsersLocationColumn && (
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Location</th>
                  )}
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Punch</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const perms = ensurePermissionShape(user.role, user.permissions)
                  const remote = perms.actions.attendance_punch_remote_self
                  const office = perms.actions.attendance_punch_self
                  return (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-ds-brand-navy">{user.displayName}</td>
                      <td className="px-4 py-3 text-slate-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{user.role}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{user.employee?.employeeId || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{(user as any).orgUnitName || (user.employee as any)?.orgUnitName || '—'}</td>
                      {showUsersLocationColumn && (
                        <td className="px-4 py-3 text-slate-600">{user.employee?.locationName || '—'}</td>
                      )}
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {office ? 'Office' : ''}{office && remote ? ' + ' : ''}{remote ? 'Remote' : ''}
                        {!office && !remote ? '—' : ''}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          {user.role !== 'ADMIN' && (
                            <Button variant="destructive-outline" size="sm" onClick={() => handleDelete(user.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <DrawerWrapper
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        title="Create login"
        subtitle="Link an existing employee, set password and permissions. Prefer this after Onboarding complete."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateDrawerOpen(false)} className="mr-auto" disabled={saving}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating...' : 'Create user'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="text-sm font-bold text-ds-brand-navy mb-3">Account details</h4>
            {accountDetailsForm}
          </div>
          <div>
            <h4 className="text-sm font-bold text-ds-brand-navy mb-3">Permissions (tabs + actions)</h4>
            <PermissionsEditor
              role={role}
              permissions={permissions}
              expandedModules={expandedModules}
              onPermissionsChange={setPermissions}
              onToggleModule={createPerm.toggleModule}
              onTabEnabled={createPerm.setTabEnabled}
              onActionEnabled={createPerm.setActionEnabled}
              onGrantAll={() => setPermissions(FULL_PERMISSIONS)}
              onResetTemplate={() => applyRoleTemplate(role, setPermissions)}
              onClearAll={() => setPermissions(ensurePermissionShape(role, { tabs: {}, actions: {} }))}
            />
          </div>
        </div>
      </DrawerWrapper>

      <DrawerWrapper
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={editingUser ? `Edit user — ${editingUser.displayName}` : 'Edit user'}
        subtitle="Update credentials, location, and permission overrides."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingUser(null)} className="mr-auto" disabled={saving}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleUpdate} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </>
        }
      >
        {editingUser && (
          <div className="flex flex-col gap-6">
            <FormGrid cols={2}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Email</label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">New password</label>
                <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Leave blank to keep current" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Display name</label>
                <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Role</label>
                <Select value={editRole} onChange={(e) => { setEditRole(e.target.value); applyRoleTemplate(e.target.value, setEditPermissions) }}>
                  {BACKEND_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Org unit</label>
                <Select value={editOrgUnitId} onChange={(e) => setEditOrgUnitId(e.target.value)}>
                  <option value="">No org unit</option>
                  {orgUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.isLeaf ? 'Site' : u.levelOrder === 1 ? 'HQ' : 'Division'})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Assigned location</label>
                <Select value={editLocationId} onChange={(e) => setEditLocationId(e.target.value)}>
                  <option value="">No location</option>
                  {workLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </Select>
              </div>
              <AttendancePunchSettings permissions={editPermissions} role={editRole} onChange={setEditPermissions} />
            </FormGrid>

            <div>
              <h4 className="text-sm font-bold text-ds-brand-navy mb-3">Permissions</h4>
              <PermissionsEditor
                role={editRole}
                permissions={editPermissions}
                expandedModules={editExpandedModules}
                onPermissionsChange={setEditPermissions}
                onToggleModule={editPerm.toggleModule}
                onTabEnabled={editPerm.setTabEnabled}
                onActionEnabled={editPerm.setActionEnabled}
                onGrantAll={() => setEditPermissions(FULL_PERMISSIONS)}
                onResetTemplate={() => applyRoleTemplate(editRole, setEditPermissions)}
                onClearAll={() => setEditPermissions(ensurePermissionShape(editRole, { tabs: {}, actions: {} }))}
              />
            </div>
          </div>
        )}
      </DrawerWrapper>
    </div>
  )
}
