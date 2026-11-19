"use client"

import * as React from 'react'
import { DrawerWrapper, Button } from '@hryantra/ui'
import {
  CalendarDays,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  AlertCircle,
  MapPin,
  Building2,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { LeaveRequest, LeaveStatus } from '../types'
import { useStore } from '@/store/StoreProvider'

interface LeaveDetailDrawerProps {
  open: boolean
  request: LeaveRequest | null
  onClose: () => void
  onApprove?: (id: string, remark?: string) => Promise<void>
  onReject?: (id: string, remark?: string) => Promise<void>
  canApprove?: boolean
}

export function LeaveDetailDrawer({
  open,
  request,
  onClose,
  onApprove,
  onReject,
  canApprove = false,
}: LeaveDetailDrawerProps) {
  const { employees } = useStore()
  const [activeTab, setActiveTab] = React.useState<'details' | 'employee' | 'approval'>('details')
  const [adminRemark, setAdminRemark] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setActiveTab('details')
      setAdminRemark('')
    }
  }, [open, request?.id])

  if (!request) return null

  const emp = employees.find((e) => e.id === request.employeeId)
  const employeeName = emp?.name || request.employeeId
  const isPending = request.status === 'Pending'

  const startDateStr = new Date(request.startDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const endDateStr = new Date(request.endDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const diffDays = Math.max(
    1,
    Math.round(
      (new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  )

  const handleAction = async (action: 'approve' | 'reject') => {
    try {
      setSubmitting(true)
      if (action === 'approve' && onApprove) {
        await onApprove(request.id, adminRemark.trim() || 'Approved by administrator')
      } else if (action === 'reject' && onReject) {
        await onReject(request.id, adminRemark.trim() || 'Rejected by administrator')
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const statusStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    Pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
    Approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    Rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  }
  const statusCfg = statusStyles[request.status] || statusStyles.Pending

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 font-bold text-xs shadow-2xs">
            {employeeName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight">{employeeName}</div>
            <div className="text-[11px] text-slate-500 font-medium">Leave Application Details</div>
          </div>
        </div>
      }
      size="md"
      footer={
        isPending && canApprove ? (
          <div className="flex flex-col gap-2 w-full">
            <input
              type="text"
              placeholder="Optional approver remark (e.g. Approved / Handover confirmed)..."
              value={adminRemark}
              onChange={(e) => setAdminRemark(e.target.value)}
              className="w-full h-8 px-3 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={submitting} className="h-8 text-xs">
                Cancel
              </Button>
              <Button
                variant="destructive-outline"
                size="sm"
                onClick={() => handleAction('reject')}
                disabled={submitting}
                className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <XCircle className="size-3.5 mr-1" />
                Reject
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleAction('approve')}
                disabled={submitting}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <CheckCircle2 className="size-3.5 mr-1" />
                Approve Request
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500">
              Status: <strong className="text-slate-800">{request.status}</strong>
            </span>
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {/* Modern Tab Bar */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-center transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'bg-white text-indigo-950 font-bold shadow-xs border border-slate-200/70'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Application
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('employee')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-center transition-all cursor-pointer ${
              activeTab === 'employee'
                ? 'bg-white text-indigo-950 font-bold shadow-xs border border-slate-200/70'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Employee Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approval')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-center transition-all cursor-pointer ${
              activeTab === 'approval'
                ? 'bg-white text-indigo-950 font-bold shadow-xs border border-slate-200/70'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Workflow & Audit
          </button>
        </div>

        {/* Status Pill Strip */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
              <span className={`size-1.5 rounded-full ${statusCfg.dot}`} />
              {request.status}
            </span>
            <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
              {request.type} Leave
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-900">{diffDays} Day(s)</span>
            <span className="text-[11px] text-slate-400 block font-medium">Working days</span>
          </div>
        </div>

        {/* Tab 1: Application */}
        {activeTab === 'details' && (
          <div className="flex flex-col gap-3.5 text-xs">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Duration & Dates</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Start Date</span>
                  <span className="text-xs font-bold text-slate-900 mt-0.5 block">{startDateStr}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">End Date</span>
                  <span className="text-xs font-bold text-slate-900 mt-0.5 block">{endDateStr}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Applicant Justification</h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                {request.reason || 'No written reason specified.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Statutory Policy Context</h4>
              <div className="flex items-start gap-2 text-slate-600 bg-amber-50/60 border border-amber-200/60 p-2.5 rounded-lg">
                <Sparkles className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-snug">
                  Sandwich rule evaluation is applied automatically per company policies. Non-working weekends and public holidays within this span are checked by the accrual engine.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Employee Info */}
        {activeTab === 'employee' && (
          <div className="flex flex-col gap-3 text-xs">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col gap-3">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="size-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                  {employeeName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{employeeName}</h4>
                  <p className="text-xs text-slate-500">{emp?.designation || 'Staff Member'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Employee ID</span>
                  <span className="font-semibold text-slate-800">{emp?.id || request.employeeId}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Department</span>
                  <span className="font-semibold text-slate-800">{emp?.department || 'General'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Work Email</span>
                  <span className="font-semibold text-slate-800 truncate block">{emp?.email || '—'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Location</span>
                  <span className="font-semibold text-slate-800">{emp?.locationName || 'HQ — Pune'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Workflow & Audit */}
        {activeTab === 'approval' && (
          <div className="flex flex-col gap-3 text-xs">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Timeline & Approvals</h4>
              
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 size-4 rounded-full bg-emerald-500 ring-4 ring-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="size-3 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">Leave Application Submitted</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(request.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <div className={`absolute -left-6 top-0.5 size-4 rounded-full ${isPending ? 'bg-amber-500 ring-4 ring-amber-50' : 'bg-emerald-500 ring-4 ring-emerald-50'} flex items-center justify-center`}>
                    <Clock className="size-3 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {isPending ? 'Pending Line Manager / HR Review' : `Request ${request.status}`}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {request.remarks || (isPending ? 'Awaiting action from authorized approver.' : 'Completed.')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DrawerWrapper>
  )
}
