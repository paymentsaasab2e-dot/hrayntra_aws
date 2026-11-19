'use client'

import * as React from 'react'
import { PageHeroBanner, SectionCard } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { PACKAGE_COLORS, PACKAGE_LABELS, TenantPackageKey } from '@/shared/tenant-packages'
import { TenantRow, statusBadgeClass } from '../types'

export function PlatformSubscriptionsPage() {
  const { hasAction, currentUserRole } = useStore()
  const canManage = hasAction('platform_manage_tenants')
  const [tenants, setTenants] = React.useState<TenantRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!canManage) return
    ;(async () => {
      try {
        const res = await api.platform.listTenants()
        setTenants(Array.isArray(res?.data) ? res.data : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscriptions')
      } finally {
        setLoading(false)
      }
    })()
  }, [canManage])

  if (currentUserRole !== 'PlatformOwner' && !canManage) {
    return <div className="p-6 text-sm text-ds-neutral-500">Platform owner access required.</div>
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6 pb-12">
      <PageHeroBanner
        compact
        eyebrow="PLATFORM OWNER"
        title="Subscriptions"
        description="Which package each client is on (Starter / Professional / Enterprise). Billing details can be added later."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <SectionCard title="Client packages">
        {loading ? (
          <p className="text-sm text-ds-neutral-500">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ds-neutral-500 border-b">
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Slug</th>
                <th className="py-2 pr-3">Package</th>
                <th className="py-2 pr-3">Seats used</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-ds-neutral-100">
                  <td className="py-2 pr-3 font-medium">{t.name}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{t.slug}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${PACKAGE_COLORS[t.packageKey as TenantPackageKey]}`}>
                      {PACKAGE_LABELS[t.packageKey as TenantPackageKey] || t.packageLabel}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{t.stats.userCount} / {t.maxUsers}</td>
                  <td className="py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusBadgeClass(t.status)}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  )
}
