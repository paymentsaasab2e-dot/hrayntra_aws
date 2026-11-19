"use client"

import * as React from 'react'
import { PageHeroBanner, SectionCard, Button, Input, Select, FormGrid } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { PACKAGE_COLORS, PACKAGE_LABELS, TenantPackageInfo, TenantPackageKey } from '@/shared/tenant-packages'
import {
  BarChart3, Building2, Eye, Globe2, Package, Pencil, Plus, Shield, Trash2, Users, X,
} from 'lucide-react'

type TenantStats = {
  userCount: number
  orgUnitCount: number
  employeeCount: number
  pendingApprovals: number
  activeUsers: number
}

type TenantRow = {
  id: string
  name: string
  slug: string
  status: 'ACTIVE' | 'SUSPENDED'
  packageKey: TenantPackageKey
  packageLabel: string
  maxUsers: number
  stats: TenantStats
  orgUnits?: { id: string; name: string }[]
  provisionedAdminEmail?: string | null
  hasProvisionedCredentials?: boolean
  createdAt: string
}

type TenantCredentials = {
  tenantId: string
  tenantName: string
  userId: string | null
  email: string | null
  password: string | null
  message?: string | null
}

type PlatformTab = 'clients' | 'stats' | 'packages'

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'ACTIVE'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-800 border-amber-200'
  return <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${cls}`}>{status}</span>
}

function PackageBadge({ pkg }: { pkg: TenantPackageKey }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${PACKAGE_COLORS[pkg]}`}>
      {PACKAGE_LABELS[pkg]}
    </span>
  )
}

export function PlatformConsolePage() {
  const { hasAction, currentUserRole } = useStore()
  const canManage = hasAction('platform_manage_tenants')

  const [tab, setTab] = React.useState<PlatformTab>('clients')
  const [tenants, setTenants] = React.useState<TenantRow[]>([])
  const [packages, setPackages] = React.useState<TenantPackageInfo[]>([])
  const [statsTotals, setStatsTotals] = React.useState({ tenants: 0, users: 0, employees: 0, pendingApprovals: 0 })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [filterPackage, setFilterPackage] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState('')
  const [filterMinUsers, setFilterMinUsers] = React.useState('')
  const [filterMaxUsers, setFilterMaxUsers] = React.useState('')

  const [showCreate, setShowCreate] = React.useState(false)
  const [editTenant, setEditTenant] = React.useState<TenantRow | null>(null)
  const [packageTenant, setPackageTenant] = React.useState<TenantRow | null>(null)
  const [viewTenant, setViewTenant] = React.useState<TenantRow | null>(null)
  const [viewCredentials, setViewCredentials] = React.useState<TenantCredentials | null>(null)
  const [loadingCredentials, setLoadingCredentials] = React.useState(false)

  const [clientName, setClientName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [rootOrgName, setRootOrgName] = React.useState('')
  const [packageKey, setPackageKey] = React.useState<TenantPackageKey>('STARTER')
  const [adminEmail, setAdminEmail] = React.useState('')
  const [adminPassword, setAdminPassword] = React.useState('')
  const [adminName, setAdminName] = React.useState('')

  const [editName, setEditName] = React.useState('')
  const [editSlug, setEditSlug] = React.useState('')
  const [editStatus, setEditStatus] = React.useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE')
  const [editRootName, setEditRootName] = React.useState('')
  const [editPackageKey, setEditPackageKey] = React.useState<TenantPackageKey>('STARTER')
  const [editMaxUsers, setEditMaxUsers] = React.useState('')

  const loadTenants = React.useCallback(async () => {
    const res = await api.platform.listTenants()
    setTenants(Array.isArray(res?.data) ? res.data : [])
  }, [])

  const loadPackages = React.useCallback(async () => {
    const res = await api.platform.listPackages()
    setPackages(Array.isArray(res?.data) ? res.data : [])
  }, [])

  const loadStats = React.useCallback(async () => {
    const res = await api.platform.getStats({
      minUsers: filterMinUsers ? Number(filterMinUsers) : undefined,
      maxUsers: filterMaxUsers ? Number(filterMaxUsers) : undefined,
      packageKey: filterPackage || undefined,
      status: filterStatus || undefined,
    })
    setStatsTotals(res?.data?.totals || { tenants: 0, users: 0, employees: 0, pendingApprovals: 0 })
    setTenants(Array.isArray(res?.data?.tenants) ? res.data.tenants : [])
  }, [filterMinUsers, filterMaxUsers, filterPackage, filterStatus])

  const loadAll = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadTenants(), loadPackages()])
      if (tab === 'stats') await loadStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform data')
    } finally {
      setLoading(false)
    }
  }, [loadTenants, loadPackages, loadStats, tab])

  React.useEffect(() => {
    if (canManage) loadAll()
  }, [canManage, loadAll])

  React.useEffect(() => {
    if (tab === 'stats' && canManage) {
      loadStats().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'))
    }
  }, [tab, canManage, loadStats])

  const resetCreateForm = () => {
    setClientName('')
    setSlug('')
    setRootOrgName('')
    setPackageKey('STARTER')
    setAdminEmail('')
    setAdminPassword('')
    setAdminName('')
  }

  const handleCreate = async () => {
    if (!clientName.trim()) {
      setError('Client name is required')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await api.platform.createTenant({
        name: clientName.trim(),
        slug: slug.trim() || undefined,
        rootOrgName: rootOrgName.trim() || undefined,
        packageKey,
        tenantAdmin: adminEmail.trim()
          ? {
              email: adminEmail.trim(),
              password: adminPassword || '',
              displayName: adminName.trim() || undefined,
            }
          : undefined,
      })
      const emailNote = res?.message || ''
      setSuccess(emailNote || `Tenant "${res?.data?.name}" created with ${PACKAGE_LABELS[packageKey]} package.`)
      if (res?.data?.tenantAdmin) {
        setViewTenant({ ...res.data, stats: res.data.stats || { userCount: 1, orgUnitCount: 1, employeeCount: 0, pendingApprovals: 0, activeUsers: 1 } })
        setViewCredentials({
          tenantId: res.data.id,
          tenantName: res.data.name,
          userId: res.data.tenantAdmin.id,
          email: res.data.tenantAdmin.email,
          password: res.data.tenantAdmin.password || null,
          message: res.data.tenantAdmin.password ? null : 'Password was not returned.',
        })
      }
      resetCreateForm()
      setShowCreate(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (t: TenantRow) => {
    setEditTenant(t)
    setEditName(t.name)
    setEditSlug(t.slug)
    setEditStatus(t.status)
    setEditRootName(t.orgUnits?.[0]?.name || '')
  }

  const handleUpdate = async () => {
    if (!editTenant) return
    setSaving(true)
    setError(null)
    try {
      await api.platform.updateTenant(editTenant.id, {
        name: editName.trim(),
        slug: editSlug.trim(),
        status: editStatus,
        rootOrgName: editRootName.trim() || undefined,
      })
      setSuccess('Tenant updated.')
      setEditTenant(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: TenantRow) => {
    if (!confirm(`Delete tenant "${t.name}" and ALL its users, org units, and employee data? This cannot be undone.`)) return
    setError(null)
    try {
      await api.platform.deleteTenant(t.id)
      setSuccess(`Tenant "${t.name}" deleted.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const openCredentials = async (t: TenantRow) => {
    setViewTenant(t)
    setViewCredentials(null)
    setLoadingCredentials(true)
    setError(null)
    try {
      const res = await api.platform.getTenantCredentials(t.id)
      setViewCredentials(res?.data || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials')
      setViewTenant(null)
    } finally {
      setLoadingCredentials(false)
    }
  }

  const openPackageEditor = (t: TenantRow) => {
    setPackageTenant(t)
    setEditPackageKey(t.packageKey)
    setEditMaxUsers(String(t.maxUsers))
  }

  const handleSavePackage = async () => {
    if (!packageTenant) return
    setSaving(true)
    setError(null)
    try {
      await api.platform.updateTenantPackage(packageTenant.id, {
        packageKey: editPackageKey,
        maxUsers: editMaxUsers ? Number(editMaxUsers) : undefined,
      })
      setSuccess(
        `Package for "${packageTenant.name}" set to ${PACKAGE_LABELS[editPackageKey]}. Tenant user tabs and permissions are updated — ask client users to refresh the page (or log in again).`
      )
      setPackageTenant(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update package')
    } finally {
      setSaving(false)
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

  if (currentUserRole !== 'PlatformOwner' && !canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <Globe2 className="size-16 text-ds-neutral-300 mb-4" />
        <h3 className="text-lg font-semibold text-ds-brand-navy">Platform HQ — restricted</h3>
      </div>
    )
  }

  const selectedPkgInfo = packages.find((p) => p.key === editPackageKey)

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6 pb-12">
      <PageHeroBanner
        compact
        eyebrow={dateEyebrow}
        title="Platform HQ"
        description="Manage client tenants, view usage stats, and assign feature packages (Starter / Professional / Enterprise)."
        actions={
          tab === 'clients' ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="size-4 mr-1" /> Add client
            </Button>
          ) : undefined
        }
      />

      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-2 border-b border-ds-neutral-200 pb-2">
        {([
          { id: 'clients', label: 'Clients', icon: Building2 },
          { id: 'stats', label: 'Client stats', icon: BarChart3 },
          { id: 'packages', label: 'Packages & permissions', icon: Package },
        ] as const).map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={tab === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(id)}
          >
            <Icon className="size-3.5 mr-1" /> {label}
          </Button>
        ))}
      </div>

      {tab === 'clients' && (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-ds-neutral-600">{tenants.length} client tenant(s)</p>
          </div>

          <SectionCard title="Client directory" icon={Building2}>
            {loading ? (
              <p className="text-sm text-ds-neutral-500">Loading...</p>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-ds-neutral-500">No clients yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ds-neutral-500 border-b">
                      <th className="py-2 pr-3">Client</th>
                      <th className="py-2 pr-3">Package</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Users</th>
                      <th className="py-2 pr-3">Employees</th>
                      <th className="py-2 pr-3">HQ</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id} className="border-b border-ds-neutral-100">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-ds-neutral-400">{t.slug}</div>
                        </td>
                        <td className="py-2 pr-3"><PackageBadge pkg={t.packageKey} /></td>
                        <td className="py-2 pr-3"><StatusBadge status={t.status} /></td>
                        <td className="py-2 pr-3">
                          {t.stats.userCount}/{t.maxUsers}
                          {t.stats.userCount >= t.maxUsers && (
                            <span className="text-[10px] text-red-600 ml-1">limit</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">{t.stats.employeeCount}</td>
                        <td className="py-2 pr-3">{t.orgUnits?.[0]?.name || '—'}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openCredentials(t)} title="View admin credentials"><Eye className="size-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(t)} title="Edit"><Pencil className="size-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => openPackageEditor(t)} title="Package"><Shield className="size-4" /></Button>
                            <Button variant="destructive-outline" size="sm" onClick={() => handleDelete(t)} title="Delete"><Trash2 className="size-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}

      {tab === 'stats' && (
        <>
          <SectionCard title="Filters" icon={BarChart3}>
            <FormGrid>
              <div>
                <label className="text-xs font-medium">Package</label>
                <Select value={filterPackage} onChange={(e) => setFilterPackage(e.target.value)}>
                  <option value="">All packages</option>
                  <option value="STARTER">Starter</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Status</label>
                <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Min users</label>
                <Input type="number" min={0} value={filterMinUsers} onChange={(e) => setFilterMinUsers(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium">Max users</label>
                <Input type="number" min={0} value={filterMaxUsers} onChange={(e) => setFilterMaxUsers(e.target.value)} placeholder="Any" />
              </div>
              <Button variant="outline" onClick={() => loadStats()}>Apply filters</Button>
            </FormGrid>
          </SectionCard>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total clients', value: statsTotals.tenants, icon: Building2 },
              { label: 'Total users', value: statsTotals.users, icon: Users },
              { label: 'Total employees', value: statsTotals.employees, icon: Users },
              { label: 'Pending approvals', value: statsTotals.pendingApprovals, icon: Shield },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-ds-neutral-200 bg-white p-4">
                <div className="flex items-center gap-2 text-ds-neutral-500 text-xs mb-1"><Icon className="size-3.5" />{label}</div>
                <div className="text-2xl font-bold text-ds-brand-navy">{value}</div>
              </div>
            ))}
          </div>

          <SectionCard title="Per-client breakdown" icon={BarChart3}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ds-neutral-500 border-b">
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 pr-3">Package</th>
                    <th className="py-2 pr-3">Users</th>
                    <th className="py-2 pr-3">Active logins</th>
                    <th className="py-2 pr-3">Employees</th>
                    <th className="py-2 pr-3">Org units</th>
                    <th className="py-2">Pending approvals</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-ds-neutral-100">
                      <td className="py-2 pr-3 font-medium">{t.name}</td>
                      <td className="py-2 pr-3"><PackageBadge pkg={t.packageKey} /></td>
                      <td className="py-2 pr-3">{t.stats.userCount} / {t.maxUsers}</td>
                      <td className="py-2 pr-3">{t.stats.activeUsers}</td>
                      <td className="py-2 pr-3">{t.stats.employeeCount}</td>
                      <td className="py-2 pr-3">{t.stats.orgUnitCount}</td>
                      <td className="py-2">{t.stats.pendingApprovals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {tab === 'packages' && (
        <>
          <SectionCard title="Feature packages" icon={Package}>
            <p className="text-sm text-ds-neutral-600 mb-4">
              Assign a package per client to control which modules and actions their tenant users can access.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {packages.map((p) => (
                <div key={p.key} className="rounded-xl border border-ds-neutral-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-ds-brand-navy">{p.label}</h4>
                    <PackageBadge pkg={p.key as TenantPackageKey} />
                  </div>
                  <p className="text-xs text-ds-neutral-500">{p.description}</p>
                  <p className="text-xs"><strong>Max users:</strong> {p.maxUsers}</p>
                  <p className="text-xs text-ds-neutral-500">
                    <strong>Modules:</strong> {p.enabledTabs.slice(0, 6).join(', ')}
                    {p.enabledTabs.length > 6 ? ` +${p.enabledTabs.length - 6} more` : ''}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Assign package to client" icon={Shield}>
            <FormGrid>
              <div className="md:col-span-2">
                <label className="text-xs font-medium">Select client</label>
                <Select
                  value={packageTenant?.id || ''}
                  onChange={(e) => {
                    const t = tenants.find((x) => x.id === e.target.value)
                    if (t) openPackageEditor(t)
                  }}
                >
                  <option value="">Choose tenant...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.packageLabel})</option>
                  ))}
                </Select>
              </div>
              {packageTenant && (
                <>
                  <div>
                    <label className="text-xs font-medium">Package</label>
                    <Select value={editPackageKey} onChange={(e) => setEditPackageKey(e.target.value as TenantPackageKey)}>
                      <option value="STARTER">Starter</option>
                      <option value="PROFESSIONAL">Professional</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Max users</label>
                    <Input type="number" value={editMaxUsers} onChange={(e) => setEditMaxUsers(e.target.value)} />
                  </div>
                  {selectedPkgInfo && (
                    <div className="md:col-span-2 rounded-lg bg-ds-neutral-50 border p-3 text-xs space-y-1">
                      <p><strong>Enabled tabs:</strong> {selectedPkgInfo.enabledTabs.join(', ')}</p>
                      <p><strong>Enabled actions:</strong> {selectedPkgInfo.enabledActions.slice(0, 12).join(', ')}
                        {selectedPkgInfo.enabledActions.length > 12 ? '…' : ''}</p>
                    </div>
                  )}
                  <Button onClick={handleSavePackage} disabled={saving}>
                    {saving ? 'Saving...' : `Save package for ${packageTenant.name}`}
                  </Button>
                </>
              )}
            </FormGrid>
          </SectionCard>
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ds-brand-navy/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-ds-brand-navy">Add client tenant</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}><X className="size-4" /></Button>
            </div>
            <FormGrid>
              <div><label className="text-xs font-medium">Company name</label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
              <div><label className="text-xs font-medium">Slug</label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto from name" /></div>
              <div><label className="text-xs font-medium">HQ root name</label><Input value={rootOrgName} onChange={(e) => setRootOrgName(e.target.value)} placeholder="Acme HQ" /></div>
              <div>
                <label className="text-xs font-medium">Package</label>
                <Select value={packageKey} onChange={(e) => setPackageKey(e.target.value as TenantPackageKey)}>
                  <option value="STARTER">Starter (25 users)</option>
                  <option value="PROFESSIONAL">Professional (100 users)</option>
                  <option value="ENTERPRISE">Enterprise (unlimited)</option>
                </Select>
              </div>
              <div><label className="text-xs font-medium">Tenant admin email</label><Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@client.com" /></div>
              <div>
                <label className="text-xs font-medium">Tenant admin password</label>
                <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Auto-generated if blank" />
              </div>
              <div className="md:col-span-2"><label className="text-xs font-medium">Admin display name</label><Input value={adminName} onChange={(e) => setAdminName(e.target.value)} /></div>
            </FormGrid>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create tenant'}</Button>
            </div>
          </div>
        </div>
      )}

      {viewTenant && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ds-brand-navy/40 p-4" onClick={() => { setViewTenant(null); setViewCredentials(null) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-ds-brand-navy">Admin credentials — {viewTenant.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => { setViewTenant(null); setViewCredentials(null) }}><X className="size-4" /></Button>
            </div>
            {loadingCredentials ? (
              <p className="text-sm text-ds-neutral-500">Loading credentials...</p>
            ) : viewCredentials ? (
              <div className="space-y-3 text-sm">
                {viewCredentials.message && !viewCredentials.password && (
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">{viewCredentials.message}</p>
                )}
                <div className="rounded-lg border border-ds-neutral-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-ds-neutral-100">
                        <td className="px-3 py-2 font-medium text-ds-neutral-500 w-28">User ID</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{viewCredentials.userId || '—'}</td>
                      </tr>
                      <tr className="border-b border-ds-neutral-100">
                        <td className="px-3 py-2 font-medium text-ds-neutral-500">Email</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{viewCredentials.email || '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-ds-neutral-500">Password</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{viewCredentials.password || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-ds-neutral-500">Credentials are emailed to the admin on tenant creation. Share only through secure channels.</p>
              </div>
            ) : (
              <p className="text-sm text-ds-neutral-500">No credentials available.</p>
            )}
          </div>
        </div>
      )}

      {editTenant && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ds-brand-navy/40 p-4" onClick={() => setEditTenant(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Edit {editTenant.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditTenant(null)}><X className="size-4" /></Button>
            </div>
            <FormGrid>
              <div><label className="text-xs font-medium">Name</label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div><label className="text-xs font-medium">Slug</label><Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} /></div>
              <div><label className="text-xs font-medium">Status</label>
                <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')}>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
              </div>
              <div><label className="text-xs font-medium">HQ root name</label><Input value={editRootName} onChange={(e) => setEditRootName(e.target.value)} /></div>
            </FormGrid>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditTenant(null)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={saving}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
