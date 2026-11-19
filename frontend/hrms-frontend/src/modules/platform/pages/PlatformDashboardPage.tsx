'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { PageHeroBanner, SectionCard, Button, MetricStatCard } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { Building2, CreditCard, Megaphone, Users } from 'lucide-react'
import { TenantRow } from '../types'
import { PACKAGE_LABELS, TenantPackageKey } from '@/shared/tenant-packages'

export function PlatformDashboardPage() {
  const router = useRouter()
  const { hasAction, currentUserRole } = useStore()
  const canManage = hasAction('platform_manage_tenants')

  const [tenants, setTenants] = React.useState<TenantRow[]>([])
  const [totals, setTotals] = React.useState({ tenants: 0, users: 0, employees: 0, pendingApprovals: 0 })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!canManage) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const [listRes, statsRes] = await Promise.all([
          api.platform.listTenants(),
          api.platform.getStats(),
        ])
        if (!mounted) return
        setTenants(Array.isArray(listRes?.data) ? listRes.data : [])
        setTotals(statsRes?.data?.totals || { tenants: 0, users: 0, employees: 0, pendingApprovals: 0 })
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [canManage])

  if (currentUserRole !== 'PlatformOwner' && !canManage) {
    return <div className="p-6 text-sm text-ds-neutral-500">Platform owner access required.</div>
  }

  const byPackage = React.useMemo(() => {
    const counts: Record<string, number> = { STARTER: 0, PROFESSIONAL: 0, ENTERPRISE: 0 }
    for (const t of tenants) counts[t.packageKey] = (counts[t.packageKey] || 0) + 1
    return counts
  }, [tenants])

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6 pb-12">
      <PageHeroBanner
        compact
        eyebrow="PLATFORM OWNER"
        title="Dashboard"
        description="High-level view of clients, seats, and packages. Exact charts can be added later — this is the home tab."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricStatCard label="Clients" value={loading ? '—' : totals.tenants} subtitle="Companies on Framework" tone="blue" icon={Building2} />
        <MetricStatCard label="Users" value={loading ? '—' : totals.users} subtitle="Logins across tenants" tone="indigo" icon={Users} />
        <MetricStatCard label="Employees" value={loading ? '—' : totals.employees} subtitle="People records" tone="mint" icon={Users} />
        <MetricStatCard label="Pending approvals" value={loading ? '—' : totals.pendingApprovals} subtitle="Across all clients" tone="amber" icon={CreditCard} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <SectionCard title="Subscriptions by package">
          <ul className="space-y-2 text-sm">
            {(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as TenantPackageKey[]).map((key) => (
              <li key={key} className="flex justify-between border-b border-ds-neutral-100 py-2">
                <span>{PACKAGE_LABELS[key]}</span>
                <span className="font-semibold">{byPackage[key] || 0}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/superadmin/subscriptions')}>
            Open subscriptions
          </Button>
        </SectionCard>

        <SectionCard title="Shortcuts">
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => router.push('/superadmin/tenants')}>
              <Building2 className="size-4 mr-1" /> Clients
            </Button>
            <Button variant="outline" onClick={() => router.push('/superadmin/leads')}>
              <Megaphone className="size-4 mr-1" /> Leads
            </Button>
            <Button variant="outline" onClick={() => router.push('/superadmin/tenants/new')}>
              Create client
            </Button>
          </div>
          <p className="text-xs text-ds-neutral-400 mt-4">
            Tell us the exact KPIs you want on this dashboard next — layout is ready.
          </p>
        </SectionCard>
      </div>
    </div>
  )
}
