"use client"
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
import * as React from 'react'
import { SectionCard, Button, Input } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'

export function LeaveApprovalsPanel() {
  const { leaveRequests, updateLeaveStatus, employees, hasAction } = useStore()
  const [remarksById, setRemarksById] = React.useState<Record<string, string>>({})
  const [loadingId, setLoadingId] = React.useState<string | null>(null)

  if (!hasAction('leaves_approve')) {
    return null
  }

  const pendingRequests = leaveRequests.filter(r => r.status === 'Pending')

  const handleAction = async (id: string, action: 'Approved' | 'Rejected' | 'Modification Requested', defaultRemark: string) => {
    const remark = (remarksById[id] || '').trim() || defaultRemark
    try {
      setLoadingId(id)
      await updateLeaveStatus(id, action, remark)
      setRemarksById(prev => ({ ...prev, [id]: '' }))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <SectionCard title="Pending Leave Approvals" className="border-amber-200">
      <div className="flex flex-col gap-4">
        {pendingRequests.length === 0 && (
          <span className="text-ds-body-sm text-ds-neutral-500 py-4">No pending leave requests.</span>
        )}
        
        {pendingRequests.map(req => {
          const emp = employees.find(e => e.id === req.employeeId)
          const isLoading = loadingId === req.id

          return (
            <div
              key={req.id}
              className="rounded-xl border border-ds-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-ds-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-ds-body font-semibold text-ds-brand-navy">{emp?.name || req.employeeId}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    Pending
                  </span>
                </div>
                <span className="text-ds-caption text-ds-neutral-500">Requested on {formatDate(req.createdAt)}</span>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.6fr_1fr]">
                <div className="space-y-2">
                  <div className="text-ds-body-sm text-ds-neutral-700">
                    <span className="font-semibold text-ds-brand-navy">Leave Type:</span> {req.type}
                  </div>
                  <div className="text-ds-body-sm text-ds-neutral-700">
                    <span className="font-semibold text-ds-brand-navy">Duration:</span> {formatDate(req.startDate)} - {formatDate(req.endDate)} ({req.totalDays} day{req.totalDays > 1 ? 's' : ''})
                  </div>
                  <div className="rounded-md border border-ds-neutral-100 bg-ds-neutral-50 p-3 text-ds-body-sm text-ds-neutral-700">
                    <span className="font-semibold text-ds-brand-navy">Reason:</span> {req.reason}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-ds-caption font-semibold uppercase tracking-wide text-ds-neutral-500">
                    HR Remark
                  </label>
                  <Input
                    value={remarksById[req.id] || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemarksById(prev => ({ ...prev, [req.id]: e.target.value }))}
                    placeholder="Add remark for this decision (optional)"
                    disabled={isLoading}
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="destructive-outline"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => handleAction(req.id, 'Rejected', 'Rejected by approver')}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => handleAction(req.id, 'Modification Requested', 'Please adjust dates/details and re-apply')}
                    >
                      Modify
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => handleAction(req.id, 'Approved', 'Approved by approver')}
                    >
                      {isLoading ? 'Updating...' : 'Approve'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
