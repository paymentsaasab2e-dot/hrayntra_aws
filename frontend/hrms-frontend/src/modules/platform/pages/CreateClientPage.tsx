'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { PageHeroBanner, SectionCard, Button, Input, Select, FormGrid } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { TenantPackageKey } from '@/shared/tenant-packages'
import { ArrowLeft, Minus, Plus } from 'lucide-react'
import { DEFAULT_HIERARCHY_LEVELS, HierarchyLevel } from '../types'
import { ModuleChipPicker } from '../components/ModuleChipPicker'
import {
  PACKAGE_DEFAULT_TABS,
  permissionsFromSelectedTabs,
} from '../module-connections'
import { TabKey } from '@/shared/permissions'

export function CreateClientPage() {
  const router = useRouter()
  const { hasAction, currentUserRole } = useStore()
  const canManage = hasAction('platform_manage_tenants')

  const [clientName, setClientName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [rootOrgName, setRootOrgName] = React.useState('')
  const [packageKey, setPackageKey] = React.useState<TenantPackageKey>('STARTER')
  const [selectedModules, setSelectedModules] = React.useState<TabKey[]>(PACKAGE_DEFAULT_TABS.STARTER)
  const [adminName, setAdminName] = React.useState('')
  const [adminEmail, setAdminEmail] = React.useState('')
  const [adminPassword, setAdminPassword] = React.useState('')
  const [levels, setLevels] = React.useState<HierarchyLevel[]>(DEFAULT_HIERARCHY_LEVELS)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const setLeaf = (index: number) => {
    setLevels((prev) => prev.map((l, i) => ({ ...l, isLeaf: i === index })))
  }

  const addLevel = () => {
    setLevels((prev) => {
      const nextOrder = prev.length + 1
      const next = [
        ...prev.map((l) => ({ ...l, isLeaf: false })),
        {
          levelOrder: nextOrder,
          code: `L${nextOrder}`,
          displayName: `Level ${nextOrder}`,
          isLeaf: true,
        },
      ]
      return next
    })
  }

  const removeLevel = () => {
    setLevels((prev) => {
      if (prev.length <= 2) return prev
      const next = prev.slice(0, -1).map((l, i, arr) => ({
        ...l,
        levelOrder: i + 1,
        isLeaf: i === arr.length - 1,
      }))
      return next
    })
  }

  const handleCreate = async () => {
    if (!clientName.trim()) {
      setError('Client name is required')
      return
    }
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setError('Tenant admin name, email, and password are required')
      return
    }
    if (levels.filter((l) => l.isLeaf).length !== 1) {
      setError('Exactly one hierarchy level must be marked as Leaf')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await api.platform.createTenant({
        name: clientName.trim(),
        slug: slug.trim() || undefined,
        rootOrgName: rootOrgName.trim() || undefined,
        packageKey,
        customPermissions: permissionsFromSelectedTabs(selectedModules),
        levels: levels.map((l, i) => ({
          levelOrder: i + 1,
          code: l.code.trim() || `L${i + 1}`,
          displayName: l.displayName.trim() || `Level ${i + 1}`,
          isLeaf: l.isLeaf,
        })),
        tenantAdmin: {
          displayName: adminName.trim(),
          email: adminEmail.trim(),
          password: adminPassword,
        },
      })
      const id = res?.data?.id
      router.push(id ? `/superadmin/tenants/${id}` : '/superadmin/tenants')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client')
    } finally {
      setSaving(false)
    }
  }

  if (currentUserRole !== 'PlatformOwner' && !canManage) {
    return <div className="p-6 text-sm text-ds-neutral-500">Platform owner access required.</div>
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6 pb-12">
      <Button variant="ghost" size="sm" onClick={() => router.push('/superadmin/tenants')}>
        <ArrowLeft className="size-4 mr-1" /> Back to clients
      </Button>

      <PageHeroBanner
        compact
        eyebrow="PLATFORM OWNER"
        title="Create client"
        description="Spin up an isolated company with a hierarchy template and first Tenant admin login (they sign in at the client portal, not here)."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <SectionCard title="Client">
        <FormGrid>
          <div>
            <label className="text-xs font-medium">Client name</label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Health" />
          </div>
          <div>
            <label className="text-xs font-medium">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-health" />
          </div>
          <div>
            <label className="text-xs font-medium">Root org name (Main Branch)</label>
            <Input
              value={rootOrgName}
              onChange={(e) => setRootOrgName(e.target.value)}
              placeholder="Acme Main Branch"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Package</label>
            <Select
              value={packageKey}
              onChange={(e) => {
                const next = e.target.value as TenantPackageKey
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
      </SectionCard>

      <SectionCard title="Modules for this client">
        <ModuleChipPicker
          selected={selectedModules}
          onChange={setSelectedModules}
          packageLabel={packageKey}
          onApplyPackageDefaults={() =>
            setSelectedModules(PACKAGE_DEFAULT_TABS[packageKey] || PACKAGE_DEFAULT_TABS.STARTER)
          }
        />
      </SectionCard>

      <SectionCard title="Hierarchy levels (minimum 2)">
        <p className="text-xs text-ds-neutral-500 mb-3">
          You decide how deep this company can go. Tenant HQ later fills nodes — they do not redesign these levels.
        </p>
        <div className="space-y-3">
          {levels.map((level, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end rounded-lg border border-ds-neutral-100 p-3">
              <div>
                <label className="text-xs font-medium">Code</label>
                <Input
                  value={level.code}
                  onChange={(e) =>
                    setLevels((prev) => prev.map((l, i) => (i === index ? { ...l, code: e.target.value } : l)))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium">Display name</label>
                <Input
                  value={level.displayName}
                  onChange={(e) =>
                    setLevels((prev) =>
                      prev.map((l, i) => (i === index ? { ...l, displayName: e.target.value } : l))
                    )
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
                <input type="radio" name="leaf" checked={level.isLeaf} onChange={() => setLeaf(index)} />
                Leaf
              </label>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={addLevel}>
            <Plus className="size-3.5 mr-1" /> Level
          </Button>
          <Button variant="outline" size="sm" onClick={removeLevel} disabled={levels.length <= 2}>
            <Minus className="size-3.5 mr-1" /> Level
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Client head (Tenant admin)">
        <p className="text-xs text-ds-neutral-500 mb-3">
          This person logs in at the client portal (/login), not /superadmin.
        </p>
        <FormGrid>
          <div>
            <label className="text-xs font-medium">Name *</label>
            <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Email *</label>
            <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium">Password *</label>
            <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
          </div>
        </FormGrid>
      </SectionCard>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/superadmin/tenants')}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={saving}>
          {saving ? 'Creating...' : 'Create client'}
        </Button>
      </div>
    </div>
  )
}
