'use client'

import * as React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { PageHeroBanner, SectionCard, Button, Input, Select, FormGrid } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { ArrowLeft, Building2, Shield, Users } from 'lucide-react'
import { TenantCredentials, TenantRow, hierarchyPathLabel, statusBadgeClass } from '../types'
import { ModuleChipPicker } from '../components/ModuleChipPicker'
import {
  PACKAGE_DEFAULT_TABS,
  permissionsFromSelectedTabs,
  selectedTabsFromPermissions,
} from '../module-connections'
import { TabKey } from '@/shared/permissions'

export function ClientDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = String(params.id || '')
  const { hasAction, currentUserRole } = useStore()
  const canManage = hasAction('platform_manage_tenants')

  const [tenant, setTenant] = React.useState<TenantRow | null>(null)
  const [credentials, setCredentials] = React.useState<TenantCredentials | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState(searchParams.get('edit') === '1')

  const [editName, setEditName] = React.useState('')
  const [editSlug, setEditSlug] = React.useState('')
  const [editStatus, setEditStatus] = React.useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE')
  const [packageKey, setPackageKey] = React.useState<'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'>('STARTER')
  const [selectedModules, setSelectedModules] = React.useState<TabKey[]>(PACKAGE_DEFAULT_TABS.STARTER)
  const [showLocationCol, setShowLocationCol] = React.useState(false)

  const [adminName, setAdminName] = React.useState('')
  const [adminEmail, setAdminEmail] = React.useState('')
  const [adminPassword, setAdminPassword] = React.useState('')

  const load = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [tenantRes, credRes] = await Promise.all([
        api.platform.getTenant(id),
        api.platform.getTenantCredentials(id),
      ])
      const t = tenantRes?.data as TenantRow
      setTenant(t)
      setCredentials(credRes?.data || null)
      setEditName(t?.name || '')
      setEditSlug(t?.slug || '')
      setEditStatus((t?.status as any) || 'ACTIVE')
      setPackageKey((t?.packageKey as any) || 'STARTER')
      setSelectedModules(selectedTabsFromPermissions(t?.packagePermissions))
      setShowLocationCol(Boolean(t?.showUsersLocationColumn))
      setAdminEmail(credRes?.data?.email || t?.provisionedAdminEmail || '')
      setAdminName('')
      setAdminPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client')
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    if (canManage) load()
  }, [canManage, load])

  const handleSaveClient = async () => {
    if (!tenant) return
    setSaving(true)
    setError(null)
    try {
      await api.platform.updateTenant(tenant.id, {
        name: editName.trim(),
        slug: editSlug.trim(),
        status: editStatus,
        showUsersLocationColumn: showLocationCol,
      })
      await api.platform.updateTenantPackage(tenant.id, {
        packageKey,
        customPermissions: permissionsFromSelectedTabs(selectedModules),
      })
      setSuccess('Client updated.')
      setEditing(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateAdmin = async () => {
    if (!tenant) return
    setSaving(true)
    setError(null)
    try {
      await api.platform.updateTenantAdmin(tenant.id, {
        displayName: adminName.trim() || undefined,
        email: adminEmail.trim() || undefined,
        password: adminPassword.trim() || undefined,
      })
      setSuccess('Tenant admin credentials updated. They still log in at the client portal.')
      setAdminPassword('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant admin')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tenant) return
    if (
      !confirm(
        `Delete client "${tenant.name}"?\n\nThis wipes users + org structure. Irreversible.`
      )
    ) {
      return
    }
    try {
      await api.platform.deleteTenant(tenant.id)
      router.push('/superadmin/tenants')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (currentUserRole !== 'PlatformOwner' && !canManage) {
    return <div className="p-6 text-sm text-ds-neutral-500">Platform owner access required.</div>
  }

  if (loading) {
    return <div className="p-6 text-sm text-ds-neutral-500">Loading client...</div>
  }

  if (!tenant) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-red-600">{error || 'Client not found'}</p>
        <Button variant="outline" onClick={() => router.push('/superadmin/tenants')}>
          Back to clients
        </Button>
      </div>
    )
  }

  const stats = tenant.stats

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6 pb-12">
      <Button variant="ghost" size="sm" onClick={() => router.push('/superadmin/tenants')}>
        <ArrowLeft className="size-4 mr-1" /> Back to clients
      </Button>

      <PageHeroBanner
        compact
        eyebrow="PLATFORM OWNER"
        title={tenant.name}
        description={`Slug: ${tenant.slug} · ${hierarchyPathLabel(tenant.hierarchyLevels)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Close edit' : 'Edit client'}
            </Button>
            <Button variant="destructive-outline" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusBadgeClass(tenant.status)}`}>
          {tenant.status}
        </span>
        <span className="text-xs text-ds-neutral-500">{tenant.packageLabel}</span>
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {editing && (
        <SectionCard title="Edit client">
          <FormGrid>
            <div>
              <label className="text-xs font-medium">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Slug</label>
              <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Status</label>
              <Select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED')}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Package</label>
              <Select
                value={packageKey}
                onChange={(e) => {
                  const next = e.target.value as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'
                  setPackageKey(next)
                  setSelectedModules(PACKAGE_DEFAULT_TABS[next] || PACKAGE_DEFAULT_TABS.STARTER)
                }}
              >
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
              </Select>
            </div>
          </FormGrid>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSaveClient} disabled={saving}>
              {saving ? 'Saving...' : 'Save client'}
            </Button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Modules for this client">
        <p className="text-xs text-ds-neutral-500 mb-3">
          Toggle modules this company can open. Saving updates the package ceiling — users must refresh or log in again.
        </p>
        <ModuleChipPicker
          selected={selectedModules}
          onChange={setSelectedModules}
          packageLabel={packageKey}
          onApplyPackageDefaults={() =>
            setSelectedModules(PACKAGE_DEFAULT_TABS[packageKey] || PACKAGE_DEFAULT_TABS.STARTER)
          }
        />
        <div className="flex justify-end mt-4">
          <Button
            onClick={async () => {
              if (!tenant) return
              setSaving(true)
              setError(null)
              try {
                await api.platform.updateTenantPackage(tenant.id, {
                  packageKey,
                  customPermissions: permissionsFromSelectedTabs(selectedModules),
                })
                setSuccess('Modules saved. Ask client users to refresh or log in again.')
                await load()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save modules')
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save modules'}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Tenant admin credentials">
        <p className="text-xs text-ds-neutral-500 mb-3">
          Reset HQ login if the client forgot their password. They still sign in at the client portal — not /superadmin.
        </p>
        <FormGrid>
          <div>
            <label className="text-xs font-medium">Admin name</label>
            <Input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Login email</label>
            <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium">New password (blank = keep current)</label>
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </FormGrid>
        {credentials?.password && (
          <p className="text-xs text-ds-neutral-500 mt-2">
            Stored password on file: <span className="font-mono">{credentials.password}</span>
          </p>
        )}
        <div className="flex justify-end mt-4">
          <Button onClick={handleUpdateAdmin} disabled={saving}>
            Update tenant admin
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Users table — location column">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showLocationCol}
            onChange={(e) => setShowLocationCol(e.target.checked)}
          />
          Show extra Location column in Operations → Users
        </label>
        <p className="text-xs text-ds-neutral-500 mt-2">
          Most clients leave this off (site already maps location). Toggle on only if they asked for it.
        </p>
        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await api.platform.updateTenant(tenant.id, {
                  showUsersLocationColumn: showLocationCol,
                })
                setSuccess('Location column preference saved.')
                await load()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save preference')
              } finally {
                setSaving(false)
              }
            }}
          >
            Save preference
          </Button>
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total users', value: stats.userCount, icon: Users },
          { label: 'Employees', value: stats.employeeCount, icon: Users },
          { label: 'Managers', value: stats.managers ?? 0, icon: Shield },
          { label: 'Org units', value: stats.orgUnitCount, icon: Building2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-ds-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 text-ds-neutral-500 text-xs mb-1">
              <Icon className="size-3.5" />
              {label}
            </div>
            <div className="text-2xl font-bold text-ds-brand-navy">{value}</div>
          </div>
        ))}
      </div>

      <SectionCard title="Client analytics (read-only)">
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-semibold text-ds-brand-navy mb-2">Users by role</h4>
            {Object.entries(stats.usersByRole || {}).length === 0 ? (
              <p className="text-ds-neutral-400 text-xs">No users</p>
            ) : (
              <ul className="space-y-1">
                {Object.entries(stats.usersByRole || {}).map(([role, count]) => (
                  <li key={role} className="flex justify-between border-b border-ds-neutral-100 py-1">
                    <span>{role === 'ADMIN' ? 'Tenant admin' : role}</span>
                    <span className="font-semibold">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-semibold text-ds-brand-navy mb-2">Users by status</h4>
            {Object.entries(stats.usersByStatus || {}).length === 0 ? (
              <p className="text-ds-neutral-400 text-xs">No users</p>
            ) : (
              <ul className="space-y-1">
                {Object.entries(stats.usersByStatus || {}).map(([status, count]) => (
                  <li key={status} className="flex justify-between border-b border-ds-neutral-100 py-1">
                    <span>{status}</span>
                    <span className="font-semibold">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold text-ds-brand-navy mb-2">Per hierarchy level</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ds-neutral-500 border-b">
                <th className="py-2 pr-3">Level</th>
                <th className="py-2 pr-3">Org units</th>
                <th className="py-2">Users</th>
              </tr>
            </thead>
            <tbody>
              {(stats.byHierarchyLevel || []).map((row) => {
                const label =
                  tenant.hierarchyLevels?.find((l) => l.levelOrder === row.levelOrder)?.displayName ||
                  `L${row.levelOrder}`
                return (
                  <tr key={row.levelOrder} className="border-b border-ds-neutral-100">
                    <td className="py-2 pr-3">{label}</td>
                    <td className="py-2 pr-3">{row.orgUnitCount}</td>
                    <td className="py-2">{row.userCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Hierarchy template (read-only)">
        <p className="text-xs text-ds-neutral-500 mb-3">
          Platform owner does not edit levels after create on this screen.
        </p>
        <ul className="space-y-2">
          {[...(tenant.hierarchyLevels || [])]
            .sort((a, b) => a.levelOrder - b.levelOrder)
            .map((l) => (
              <li
                key={`${l.levelOrder}-${l.code}`}
                className="flex items-center justify-between rounded-lg border border-ds-neutral-100 px-3 py-2 text-sm"
              >
                <span>
                  <strong>{l.code}</strong> — {l.displayName}
                </span>
                {l.isLeaf && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Leaf
                  </span>
                )}
              </li>
            ))}
        </ul>
      </SectionCard>
    </div>
  )
}
