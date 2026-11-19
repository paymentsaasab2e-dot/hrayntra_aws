"use client"

import * as React from 'react'
import {
  PageHeroBanner,
  SectionCard,
  Button,
  Input,
  Select,
  FormField,
  FormFieldInput,
  MetricStatCard,
  StatusBadge,
} from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import {
  Building2,
  Check,
  Plus,
  X,
  Layers,
  MapPin,
  Users,
  Clock,
  Briefcase,
  Award,
} from 'lucide-react'
import { MasterDataManagement } from '../components/MasterDataManagement'

type OrgUnit = {
  id: string
  parentId: string | null
  levelOrder: number
  name: string
  isLeaf: boolean
  status: string
  _count?: { employees: number; children: number }
}

function levelLabel(unit: OrgUnit) {
  if (unit.levelOrder === 1) return 'HQ'
  if (unit.isLeaf) return 'Site'
  return 'Division'
}

function LevelIcon({ unit }: { unit: OrgUnit }) {
  if (unit.levelOrder === 1) return <Building2 className="size-4" />
  if (unit.isLeaf) return <MapPin className="size-4" />
  return <Layers className="size-4" />
}

function buildTree(units: OrgUnit[]): (OrgUnit & { depth: number })[] {
  const byParent = new Map<string | null, OrgUnit[]>()
  for (const unit of units) {
    const key = unit.parentId
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(unit)
  }
  const result: (OrgUnit & { depth: number })[] = []
  const walk = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) || []
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      result.push({ ...child, depth })
      walk(child.id, depth + 1)
    }
  }
  walk(null, 0)
  return result
}

const LEVEL_ICON_WRAP: Record<string, string> = {
  HQ: 'bg-[#ede9fe] text-[#7c3aed]',
  Division: 'bg-[#f5f3ff] text-[#6d28d9]',
  Site: 'bg-[#dbeafe] text-[#2563eb]',
}

export function OrgStructurePage() {
  const { hasAction, currentUserRole } = useStore()
  const canManage = hasAction('org_manage')
  const isHq = currentUserRole === 'Superadmin' || currentUserRole === 'HR'
  const isPlatformOwner = currentUserRole === 'PlatformOwner'

  const [viewMode, setViewMode] = React.useState<'hierarchy' | 'master-data'>('hierarchy')
  const [units, setUnits] = React.useState<OrgUnit[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [parentId, setParentId] = React.useState('')
  const [name, setName] = React.useState('')
  const [isLeaf, setIsLeaf] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const view = new URLSearchParams(window.location.search).get('view')
    if (view === 'master-data' || view === 'master') setViewMode('master-data')
    else if (view === 'hierarchy' || view === 'tree') setViewMode('hierarchy')
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.orgUnits.getTree()
      const data = Array.isArray(res?.data) ? res.data : []
      setUnits(data)
      if (!parentId && data.length > 0) {
        const hq = data.find((u: OrgUnit) => u.levelOrder === 1)
        if (hq) setParentId(hq.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load org structure')
    } finally {
      setLoading(false)
    }
  }, [parentId])

  React.useEffect(() => {
    load()
  }, [load])

  const parentOptions = units.filter((u) => !u.isLeaf && u.status === 'ACTIVE')
  const tree = buildTree(units)

  const stats = React.useMemo(() => {
    const divisions = units.filter((u) => u.levelOrder > 1 && !u.isLeaf).length
    const sites = units.filter((u) => u.isLeaf).length
    const employees = units.reduce((sum, u) => sum + (u._count?.employees ?? 0), 0)
    const pending = units.filter((u) => u.status === 'PENDING_HQ_APPROVAL').length
    return { total: units.length, divisions, sites, employees, pending }
  }, [units])

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  if (isPlatformOwner) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center space-y-3">
        <Building2 className="mx-auto size-12 text-ds-neutral-300" />
        <h2 className="text-lg font-semibold text-ds-brand-navy">No tenant HQ attached</h2>
        <p className="text-sm text-ds-neutral-500">
          Platform owner is not part of a client company. There is no Main Branch node to build under.
          Create and manage clients from Platform Console → Clients.
        </p>
        <Button onClick={() => (window.location.href = '/superadmin/tenants')}>Go to Clients</Button>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!name.trim() || !parentId) {
      setError('Parent and name are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.orgUnits.create({ parentId, name: name.trim(), isLeaf })
      setName('')
      setIsLeaf(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create org unit')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await api.orgUnits.approve(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await api.orgUnits.reject(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-6 py-6 pb-12">
      {/* ── Executive View Switcher Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 pb-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit shadow-2xs">
          <button
            onClick={() => setViewMode('hierarchy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'hierarchy'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Building2 className="size-4 text-indigo-600" />
            <span>Org Hierarchy & Tree</span>
          </button>
          <button
            onClick={() => setViewMode('master-data')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'master-data'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Layers className="size-4 text-indigo-600" />
            <span>Master Data Repository</span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
              4 Pillars
            </span>
          </button>
        </div>
      </div>

      {viewMode === 'hierarchy' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricStatCard label="Org Units" value={stats.total} subtitle="Total in hierarchy" tone="indigo" icon={Building2} />
            <MetricStatCard label="Divisions" value={stats.divisions} subtitle="Business divisions" tone="lavender" icon={Layers} />
            <MetricStatCard label="Sites" value={stats.sites} subtitle="Operational locations" tone="blue" icon={MapPin} />
            <MetricStatCard
              label="Headcount"
              value={stats.employees}
              subtitle={stats.pending > 0 ? `${stats.pending} pending approval` : 'Assigned employees'}
              tone="mint"
              icon={Users}
            />
          </div>
        )}

      {viewMode === 'master-data' ? (
        <MasterDataManagement />
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm font-medium text-[#b91c1c]">
              {error}
            </div>
          )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard title="Organization tree" className="xl:col-span-2">
          {loading ? (
            <p className="text-sm text-[#64748b]">Loading organization tree…</p>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] py-14 text-center">
              <Building2 className="mb-3 size-10 text-[#cbd5e1]" />
              <p className="text-sm font-medium text-[#64748b]">No org units configured yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tree.map((unit) => {
                const label = levelLabel(unit)
                return (
                  <div
                    key={unit.id}
                    className="relative"
                    style={{ paddingLeft: `${unit.depth * 28}px` }}
                  >
                    {unit.depth > 0 && (
                      <span
                        className="absolute top-0 bottom-0 w-px bg-[#e2e8f0]"
                        style={{ left: `${unit.depth * 28 - 14}px` }}
                      />
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 transition-colors hover:border-[#cbd5e1] hover:bg-[#fafbfc]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${LEVEL_ICON_WRAP[label]}`}
                        >
                          <LevelIcon unit={unit} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#111827]">{unit.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#475569]">
                              {label}
                            </span>
                            {unit.status === 'PENDING_HQ_APPROVAL' && (
                              <StatusBadge status="Pending" />
                            )}
                            <span className="text-xs text-[#64748b]">
                              {unit._count?.employees ?? 0} employee{(unit._count?.employees ?? 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isHq && unit.status === 'PENDING_HQ_APPROVAL' && (
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant="default" onClick={() => handleApprove(unit.id)}>
                            <Check className="size-3.5" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive-outline" onClick={() => handleReject(unit.id)}>
                            <X className="size-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {canManage ? (
          <SectionCard title="Add org unit">
            <div className="space-y-4">
              <FormField label="Parent unit">
                <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">Select parent</option>
                  {parentOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({levelLabel(u)})
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Unit name">
                <FormFieldInput>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. West Division"
                    className="rounded-xl"
                  />
                </FormFieldInput>
              </FormField>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
                <input
                  type="checkbox"
                  checked={isLeaf}
                  onChange={(e) => setIsLeaf(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-[#cbd5e1]"
                />
                <span className="text-sm text-[#475569]">
                  <span className="font-semibold text-[#111827]">Leaf site</span>
                  <span className="mt-0.5 block text-xs">Operational location where employees are assigned</span>
                </span>
              </label>

              <div className="rounded-xl border border-[#ddd6fe] bg-gradient-to-br from-[#f5f3ff] via-white to-white p-3 text-xs leading-relaxed text-[#64748b]">
                HQ creates divisions and sites as active immediately. Division managers can propose new sites — those require HQ approval.
              </div>

              <Button onClick={handleCreate} disabled={saving} className="w-full">
                <Plus className="size-4" />
                {saving ? 'Creating…' : 'Create org unit'}
              </Button>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Your access">
            <div className="flex items-start gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] p-4">
              <Clock className="mt-0.5 size-5 shrink-0 text-[#2563eb]" />
              <p className="text-sm text-[#475569]">
                You can view units in your subtree. Contact HQ to add or approve new divisions and sites.
              </p>
            </div>
          </SectionCard>
        )}
      </div>
        </>
      )}
    </div>
  )
}
