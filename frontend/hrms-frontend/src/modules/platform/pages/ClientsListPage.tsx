'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { PageHeroBanner, SectionCard, Button } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { PACKAGE_COLORS, PACKAGE_LABELS, TenantPackageKey } from '@/shared/tenant-packages'
import { Building2, Eye, Globe2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { TenantRow, hierarchyPathLabel, statusBadgeClass } from '../types'

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusBadgeClass(status)}`}>
      {status}
    </span>
  )
}

export function ClientsListPage() {
  const router = useRouter()
  const { hasAction, currentUserRole } = useStore()
  const canManage = hasAction('platform_manage_tenants')

  const [tenants, setTenants] = React.useState<TenantRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.platform.listTenants()
      setTenants(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (canManage) load()
  }, [canManage, load])

  const handleDelete = async (t: TenantRow) => {
    if (
      !confirm(
        `Delete client "${t.name}"?\n\nThis wipes that client’s users and org structure. Irreversible.`
      )
    ) {
      return
    }
    try {
      await api.platform.deleteTenant(t.id)
      setSuccess(`Client "${t.name}" deleted.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (currentUserRole !== 'PlatformOwner' && !canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <Globe2 className="size-16 text-ds-neutral-300 mb-4" />
        <h3 className="text-lg font-semibold text-ds-brand-navy">Platform Console — restricted</h3>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6 pb-12">
      <PageHeroBanner
        compact
        eyebrow="PLATFORM OWNER"
        title="Clients"
        description="Every company you sold Framework to. Create clients, hand HQ logins, monitor — never run their day-to-day attendance or leave."
        actions={
          <Button onClick={() => router.push('/superadmin/tenants/new')}>
            <Plus className="size-4 mr-1" /> Create client
          </Button>
        }
      />

      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 space-y-1">
        <p className="font-semibold">Demo logins (so you can try both layers)</p>
        <p>
          Platform owner (this page): <strong>platform.owner@hrms.local</strong> / <strong>PlatformOwner@123</strong>
          {' '}at <code className="text-xs">/superadmin/login</code>
        </p>
        <p>
          Tenant HQ admin (company app): <strong>superadmin@hrms.local</strong> / <strong>SuperAdmin@123</strong>
          {' '}at <code className="text-xs">/login</code>
        </p>
        <p className="text-xs text-violet-800">
          Seeded client is usually named like Framework / Hryantra HQ. Open <strong>View</strong> to see modules chips, credentials, and analytics.
          Use <strong>Create client</strong> to try hierarchy + module combinations.
        </p>
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionCard title={`Client directory (${tenants.length})`} icon={Building2}>
        {loading ? (
          <p className="text-sm text-ds-neutral-500">Loading...</p>
        ) : tenants.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-ds-neutral-500 mb-4">No clients yet.</p>
            <Button onClick={() => router.push('/superadmin/tenants/new')}>
              <Plus className="size-4 mr-1" /> Create first client
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tenants.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-ds-neutral-200 bg-white p-4 shadow-sm hover:border-ds-brand-navy/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-ds-brand-navy">{t.name}</h3>
                    <p className="text-xs font-mono text-ds-neutral-400">{t.slug}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-xs text-ds-neutral-500 mb-3">{hierarchyPathLabel(t.hierarchyLevels)}</p>
                <div className="flex flex-wrap gap-3 text-xs text-ds-neutral-600 mb-4">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {t.stats.userCount} users
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-3.5" /> {t.stats.orgUnitCount} org units
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${PACKAGE_COLORS[t.packageKey as TenantPackageKey]}`}
                  >
                    {PACKAGE_LABELS[t.packageKey as TenantPackageKey] || t.packageLabel}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/superadmin/tenants/${t.id}`)}>
                    <Eye className="size-3.5 mr-1" /> View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/superadmin/tenants/${t.id}?edit=1`)}
                  >
                    <Pencil className="size-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="destructive-outline" size="sm" onClick={() => handleDelete(t)}>
                    <Trash2 className="size-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
