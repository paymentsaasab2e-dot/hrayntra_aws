"use client"

import * as React from 'react'
import { Input, Select, Button, FilterDrawer, FilterTriggerButton, FilterField, FILTER_INPUT_CLASS } from '@hryantra/ui'
import { CheckCircle2, XCircle, Eye, Check, X, Calendar, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/StoreProvider'
import { LeaveRequest, LeaveStatus } from '../types'
import { LeaveDetailDrawer } from './LeaveDetailDrawer'

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const formatAppliedDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()

const STATUS_OPTIONS = ['All Status', 'Pending', 'Approved', 'Rejected'] as const

function avatarGradient(name: string) {
  const palette = [
    'from-violet-500 to-indigo-600',
    'from-cyan-500 to-blue-600',
    'from-blue-500 to-indigo-600',
    'from-slate-600 to-indigo-700',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

function StatusPill({ status }: { status: LeaveStatus }) {
  const styles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    Pending: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200/80', dot: 'bg-amber-500' },
    Approved: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200/80', dot: 'bg-emerald-500' },
    Rejected: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200/80', dot: 'bg-rose-500' },
    'Modification Requested': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200/80', dot: 'bg-blue-500' },
    Cancelled: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200/80', dot: 'bg-slate-400' },
  }
  const s = styles[status] || styles.Pending

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border} shadow-2xs`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      <span>{status}</span>
    </span>
  )
}

interface LeaveRequestsTableProps {
  requests: LeaveRequest[]
  showActions?: boolean
}

export function LeaveRequestsTable({ requests, showActions = false }: LeaveRequestsTableProps) {
  const { employees, updateLeaveStatus, hasAction } = useStore()
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<(typeof STATUS_OPTIONS)[number]>('All Status')
  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const [draftSearch, setDraftSearch] = React.useState('')
  const [draftStatus, setDraftStatus] = React.useState<(typeof STATUS_OPTIONS)[number]>('All Status')
  const [selectedRequest, setSelectedRequest] = React.useState<LeaveRequest | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const activeFilterCount =
    (search.trim() ? 1 : 0) + (statusFilter !== 'All Status' ? 1 : 0)

  const openFilters = () => {
    setDraftSearch(search)
    setDraftStatus(statusFilter)
    setIsFilterOpen(true)
  }

  const applyFilters = () => {
    setSearch(draftSearch)
    setStatusFilter(draftStatus)
    setIsFilterOpen(false)
  }

  const clearFilters = () => {
    setDraftSearch('')
    setDraftStatus('All Status')
    setSearch('')
    setStatusFilter('All Status')
    setIsFilterOpen(false)
  }

  const canApprove = showActions && hasAction('leaves_approve')

  const filtered = React.useMemo(() => {
    return requests
      .filter((req) => {
        const emp = employees.find((e) => e.id === req.employeeId || e.recordId === req.employeeId)
        const haystack = `${emp?.name || ''} ${emp?.email || ''} ${req.reason}`.toLowerCase()
        const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase())
        const matchesStatus = statusFilter === 'All Status' || req.status === statusFilter
        return matchesSearch && matchesStatus
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [employees, requests, search, statusFilter])

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)))
    }
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleAction = async (id: string, action: 'Approved' | 'Rejected', remark?: string) => {
    try {
      setLoadingId(id)
      await updateLeaveStatus(id, action, remark || (action === 'Approved' ? 'Approved by approver' : 'Rejected by approver'))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        {/* Table Header Bar with Search & Filter Trigger */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Leave Applications & Requests</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {filtered.length} request(s) shown • Click any row to review full timeline and breakdown
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FilterTriggerButton activeCount={activeFilterCount} onClick={openFilters} />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                    className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Leave Type</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Reason / Justification</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-xs text-slate-500">
                    No leave requests match your criteria.
                  </td>
                </tr>
              )}
              {filtered.map((req) => {
                const emp = employees.find((e) => e.id === req.employeeId || e.recordId === req.employeeId)
                const name = emp?.name || req.employeeId
                const email = emp?.email || ''
                const designation = emp?.designation || 'Staff Member'
                const isLoading = loadingId === req.id
                const isPending = req.status === 'Pending'
                const isSelected = selectedIds.has(req.id)

                return (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5 text-center" onClick={(e) => toggleSelect(req.id, e)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        aria-label={`Select ${name}`}
                        className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Employee */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-2xs ${avatarGradient(
                            name
                          )}`}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {name}
                          </div>
                          <div className="truncate text-[11px] font-medium text-slate-500">{designation}</div>
                        </div>
                      </div>
                    </td>

                    {/* Leave Type */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-lg border border-indigo-200/70 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                        {req.type}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-800">
                        {formatDate(req.startDate)} – {formatDate(req.endDate)}
                      </div>
                      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Applied {formatAppliedDate(req.createdAt)}
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="px-5 py-3.5 max-w-xs">
                      <span className="line-clamp-1 text-xs text-slate-600" title={req.reason}>
                        {req.reason}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <StatusPill status={req.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {canApprove && isPending && (
                          <>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleAction(req.id, 'Approved')}
                              title="1-Click Approve"
                              className="size-7 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleAction(req.id, 'Rejected')}
                              title="Reject Request"
                              className="size-7 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                            >
                              <X className="size-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(req)}
                          title="View Details & Audit Trail"
                          className="size-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                        >
                          <Eye className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Drawer */}
      <FilterDrawer
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
      >
        <FilterField label="Search" htmlFor="leave-filter-search">
          <Input
            id="leave-filter-search"
            placeholder="Name or reason..."
            value={draftSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftSearch(e.target.value)}
            className={FILTER_INPUT_CLASS}
          />
        </FilterField>
        <FilterField label="Status" htmlFor="leave-filter-status">
          <Select
            id="leave-filter-status"
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value as typeof draftStatus)}
            className={FILTER_INPUT_CLASS}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterDrawer>

      {/* Slide-over Detail Drawer */}
      <LeaveDetailDrawer
        open={Boolean(selectedRequest)}
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onApprove={(id, remark) => handleAction(id, 'Approved', remark)}
        onReject={(id, remark) => handleAction(id, 'Rejected', remark)}
        canApprove={canApprove}
      />
    </>
  )
}
