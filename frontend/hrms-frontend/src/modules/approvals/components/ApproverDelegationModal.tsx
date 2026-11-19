"use client"

import * as React from 'react'
import { Button, DrawerWrapper } from '@hryantra/ui'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import {
  UserCheck,
  Calendar,
  Shield,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  User,
} from 'lucide-react'

interface ApproverDelegationModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ApproverDelegationModal({ open, onClose, onSuccess }: ApproverDelegationModalProps) {
  const { employees, activeEmployeeId } = useStore()
  const [delegations, setDelegations] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  // Form state
  const [delegateeUserId, setDelegateeUserId] = React.useState<string>('')
  const [startDate, setStartDate] = React.useState<string>(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = React.useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [scope, setScope] = React.useState<'ALL' | 'LEAVE' | 'ATTENDANCE' | 'EXIT'>('ALL')
  const [reason, setReason] = React.useState<string>('Annual leave coverage')

  const fetchDelegations = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await api.approvals.delegations.list()
      if (res?.success) {
        setDelegations(res.data || [])
      }
    } catch (err: any) {
      console.error('Error fetching delegations:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      fetchDelegations()
    }
  }, [open, fetchDelegations])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setErrorMsg(null)
      setSuccessMsg(null)
      setIsSubmitting(true)

      if (!delegateeUserId) {
        throw new Error('Please select a colleague to delegate approval authority to')
      }
      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required')
      }

      const res = await api.approvals.delegations.create({
        delegateeUserId,
        startDate,
        endDate,
        scope,
        reason,
      })

      if (res?.success) {
        setSuccessMsg(res.message || 'Delegation successfully created')
        setReason('')
        fetchDelegations()
        if (onSuccess) onSuccess()
      } else {
        throw new Error(res?.message || 'Failed to create delegation')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating delegation')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this delegation? The delegatee will immediately lose approval access.')) {
      return
    }

    try {
      setErrorMsg(null)
      const res = await api.approvals.delegations.revoke(id)
      if (res?.success) {
        setSuccessMsg('Delegation successfully revoked')
        fetchDelegations()
        if (onSuccess) onSuccess()
      } else {
        throw new Error(res?.message || 'Failed to revoke delegation')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error revoking delegation')
    }
  }

  // Eligible delegatees (exclude self)
  const eligibleColleagues = employees.filter((e) => e.id !== activeEmployeeId)

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title="Delegate Approval Authority"
      size="lg"
    >
      <div className="flex flex-col gap-6 text-sm text-ds-neutral-800">
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2.5 text-xs">
            <AlertCircle className="size-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Create Delegation Form */}
        <form onSubmit={handleCreate} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-ds-brand-navy text-sm border-b border-slate-200 pb-2">
            <UserCheck className="size-4 text-indigo-600" />
            <span>New Approval Delegation</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Delegatee (Acting Approver) *</label>
              <select
                value={delegateeUserId}
                onChange={(e) => setDelegateeUserId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Select a team member...</option>
                {eligibleColleagues.map((colleague) => (
                  <option key={colleague.id} value={(colleague as any).userId || colleague.id}>
                    {colleague.name} ({colleague.department || 'Staff'} · {colleague.designation || 'Colleague'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Approval Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Approvals (Leaves, Attendance, Exits)</option>
                <option value="LEAVE">Leaves Only</option>
                <option value="ATTENDANCE">Attendance Regularizations Only</option>
                <option value="EXIT">Separation & Resignations Only</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Reason / Handover Note</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual leave coverage during travels"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isSubmitting}
              className="gap-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold"
            >
              {isSubmitting ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Grant Approval Authority
            </Button>
          </div>
        </form>

        {/* Existing Delegations List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-ds-brand-navy uppercase tracking-wider">Active & Recent Delegations</h4>
            <Button variant="ghost" size="sm" onClick={fetchDelegations} className="text-xs text-slate-500 gap-1 h-8">
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {delegations.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
              <Clock className="size-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No active or historical delegations found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Use the form above to delegate your approval queue.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {delegations.map((d: any) => (
                <div
                  key={d.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    d.isCurrentlyActive
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : d.isActive
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-slate-50/40 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        {d.delegatorName} → {d.delegateeName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.isCurrentlyActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : d.isActive
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {d.isCurrentlyActive ? 'Active Now' : d.isActive ? 'Scheduled' : 'Revoked / Expired'}
                      </span>
                      <span className="bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {d.scope}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                      <Calendar className="size-3 text-slate-400" />
                      {new Date(d.startDate).toLocaleDateString()} to {new Date(d.endDate).toLocaleDateString()}
                      {d.reason && <span>• &ldquo;{d.reason}&rdquo;</span>}
                    </p>
                  </div>

                  {d.isActive && (
                    <Button
                      variant="destructive-outline"
                      size="sm"
                      onClick={() => handleRevoke(d.id)}
                      className="gap-1.5 text-xs text-rose-700 hover:bg-rose-50 border-rose-200 self-start sm:self-center"
                    >
                      <Trash2 className="size-3.5" />
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DrawerWrapper>
  )
}
