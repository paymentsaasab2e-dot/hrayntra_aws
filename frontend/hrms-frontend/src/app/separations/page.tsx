"use client"

import * as React from 'react'
import {
  PageHeroBanner,
  SectionCard,
  Button,
  MetricStatCard,
  StatusBadge,
  DrawerWrapper,
} from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import {
  Users,
  CheckCircle2,
  Clock,
  ClipboardList,
  LogOut,
  UserMinus,
} from 'lucide-react'

function separationStatusBadge(status: string): 'Pending' | 'Approved' | 'Rejected' | 'Draft' {
  if (status === 'COMPLETED') return 'Approved'
  if (status === 'REJECTED' || status === 'CANCELLED') return 'Rejected'
  if (status === 'DRAFT' || status === 'REQUESTED') return 'Draft'
  return 'Pending'
}

export default function SeparationsPage() {
  const { currentUserRole } = useStore()
  const [rows, setRows] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<any>(null)

  const canView = ['HR', 'Superadmin', 'Manager'].includes(currentUserRole)

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const load = React.useCallback(async () => {
    if (!canView) return
    setLoading(true)
    try {
      const res = await api.separation.list()
      setRows(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [canView])

  React.useEffect(() => {
    load()
  }, [load])

  const stats = React.useMemo(
    () => ({
      total: rows.length,
      inNotice: rows.filter((r) => r.status === 'IN_NOTICE').length,
      clearance: rows.filter((r) => r.status === 'CLEARANCE_PENDING').length,
      completed: rows.filter((r) => r.status === 'COMPLETED').length,
    }),
    [rows]
  )

  const toggleChecklist = async (label: string, done: boolean) => {
    if (!selected) return
    const items = (selected.checklist as { label: string; done: boolean }[]).map((i) =>
      i.label === label ? { label, done } : i
    )
    try {
      const res = await api.separation.updateChecklist(selected.id, items)
      setSelected(res?.data)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const complete = async (id: string) => {
    try {
      await api.separation.complete(id)
      setSelected(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Complete failed')
    }
  }

  if (!canView) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <UserMinus className="mb-4 size-12 text-[#cbd5e1]" />
        <p className="text-sm font-medium text-[#64748b]">HR or Manager access required.</p>
      </div>
    )
  }

  const checklist = (selected?.checklist as { label: string; done: boolean }[]) || []
  const doneCount = checklist.filter((i) => i.done).length

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6 pb-12">
      <section className="flex flex-col gap-4">
        <PageHeroBanner
          compact
          eyebrow={dateEyebrow}
          title="Exit & Separations"
          description="Track resignations, notice periods, clearance tasks, and employee offboarding."
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard label="Total Cases" value={stats.total} subtitle="All separation records" tone="blue" icon={Users} />
          <MetricStatCard label="In Notice" value={stats.inNotice} subtitle="Serving notice period" tone="amber" icon={Clock} />
          <MetricStatCard label="Clearance Pending" value={stats.clearance} subtitle="Awaiting handover" tone="lavender" icon={ClipboardList} />
          <MetricStatCard label="Completed" value={stats.completed} subtitle="Exits finalized" tone="mint" icon={CheckCircle2} />
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm font-medium text-[#b91c1c]">
          {error}
        </div>
      )}

      <SectionCard title={`Separation pipeline (${rows.length})`} bodyClassName="p-0" noPadding>
        <div className="overflow-x-auto p-5">
          {loading ? (
            <p className="text-sm text-[#64748b]">Loading separation records…</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] py-14 text-center">
              <LogOut className="mb-3 size-10 text-[#cbd5e1]" />
              <p className="text-sm font-medium text-[#64748b]">No separation requests yet.</p>
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0]">
                  {['Employee', 'Status', 'Requested LWD', 'Approved LWD', 'Notice', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748b]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                    <td className="px-3 py-3 font-semibold text-[#111827]">
                      {r.employee?.firstName} {r.employee?.lastName}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={separationStatusBadge(r.status)} />
                    </td>
                    <td className="px-3 py-3 text-[#475569]">
                      {new Date(r.requestedLWD).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-3 text-[#475569]">
                      {r.approvedLWD
                        ? new Date(r.approvedLWD).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-xs font-bold text-[#4f46e5]">
                        {r.noticePeriodDays}d
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Button variant="outline" size="sm" onClick={() => setSelected(r)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

      <DrawerWrapper
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `Exit checklist — ${selected.employee?.firstName} ${selected.employee?.lastName}`
            : 'Exit checklist'
        }
        subtitle={
          selected
            ? `${doneCount} of ${checklist.length} tasks complete • Status: ${selected.status.replace(/_/g, ' ')}`
            : undefined
        }
        size="sm"
        footer={
          selected ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)} className="mr-auto">
                Close
              </Button>
              {['IN_NOTICE', 'CLEARANCE_PENDING', 'ACCEPTED'].includes(selected.status) && (
                <Button variant="default" onClick={() => complete(selected.id)}>
                  <CheckCircle2 className="size-4" />
                  Complete exit
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] via-white to-white p-4 text-sm text-[#475569]">
              <p>
                <span className="font-semibold text-[#111827]">Requested LWD:</span>{' '}
                {new Date(selected.requestedLWD).toLocaleDateString()}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-[#111827]">Notice period:</span> {selected.noticePeriodDays} days
              </p>
            </div>

            {checklist.map((item) => (
              <label
                key={item.label}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  item.done
                    ? 'border-[#a7f3d0] bg-[#ecfdf5]'
                    : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => toggleChecklist(item.label, e.target.checked)}
                  className="mt-0.5 size-4 rounded border-[#cbd5e1] text-[#111827] focus:ring-[#6366f1]"
                />
                <span className={`text-sm font-medium ${item.done ? 'text-[#047857]' : 'text-[#111827]'}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        )}
      </DrawerWrapper>
    </div>
  )
}
