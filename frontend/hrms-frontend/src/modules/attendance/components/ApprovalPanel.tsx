"use client"
import * as React from 'react'
import { SectionCard, Button, StatusBadge } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { AlertTriangle, Clock3, MapPinned, MessageSquare, Home, Briefcase, Clock, CheckCircle2 } from 'lucide-react'

export function ApprovalPanel() {
  const { remoteRequests, updateRequestStatus, employees, attendanceRecords, updateAttendanceApproval } = useStore()
  const [remarks, setRemarks] = React.useState<Record<string, string>>({})
  const [activeReqFilter, setActiveReqFilter] = React.useState<'ALL' | 'WFH' | 'ON_DUTY' | 'REGULARIZATION'>('ALL')
  
  const pendingRequests = remoteRequests.filter(r => r.status === 'Pending')
  const filteredRequests = pendingRequests.filter(r => {
    if (activeReqFilter === 'ALL') return true
    const type = r.type || 'WFH'
    return type === activeReqFilter
  })

  const todayDate = new Date().toLocaleDateString('en-CA')
  const pendingLateMarks = attendanceRecords.filter(record =>
    record.date === todayDate &&
    record.status === 'Late' &&
    (record.approvalStatus === undefined || record.approvalStatus === 'Pending')
  )

  const handleAttendanceAction = (recordId: string, status: 'Approved' | 'Rejected') => {
    updateAttendanceApproval(recordId, status, remarks[recordId])
    setRemarks(prev => {
      const next = { ...prev }
      delete next[recordId]
      return next
    })
  }

  const handleRequestAction = (reqId: string, status: 'Approved' | 'Rejected') => {
    updateRequestStatus(reqId, status, remarks[reqId])
    setRemarks(prev => {
      const next = { ...prev }
      delete next[reqId]
      return next
    })
  }

  return (
    <SectionCard title="Pending Attendance Approvals">
      <div className="flex flex-col gap-6">
        {/* LATE MARKS SECTION */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              <h4 className="text-ds-body font-semibold text-ds-brand-navy">Late Marks Requiring Review</h4>
            </div>
            <StatusBadge status={pendingLateMarks.length > 0 ? 'Pending' : 'Verified'} />
          </div>

          {pendingLateMarks.length === 0 ? (
            <span className="text-ds-body-sm text-ds-neutral-500 py-1">No late attendance approvals pending for today.</span>
          ) : (
            pendingLateMarks.map(record => {
              const employee = employees.find(item => item.id === record.employeeId)
              return (
                <div key={record.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ds-body font-semibold text-ds-brand-navy">{employee?.name || record.employeeId}</span>
                        <StatusBadge status={record.status} />
                        <span className="text-ds-caption text-ds-neutral-500">{record.employeeId}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-ds-body-sm text-ds-neutral-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="size-4 text-amber-600" />
                          Check-in {record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </span>
                        <span className="capitalize">Mode: {record.mode}</span>
                      </div>
                      <label className="flex flex-col gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ds-neutral-600 uppercase tracking-wide">
                          <MessageSquare className="size-3.5" />
                          Admin Remark
                        </span>
                        <textarea
                          rows={2}
                          value={remarks[record.id] || ''}
                          onChange={(event) => setRemarks(prev => ({ ...prev, [record.id]: event.target.value }))}
                          placeholder="Add approval / rejection note..."
                          className="w-full rounded-lg border border-ds-neutral-200 bg-white px-3 py-1.5 text-xs text-ds-brand-navy outline-none focus:ring-2 focus:ring-ds-brand-green/20"
                        />
                      </label>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="destructive-outline" size="sm" onClick={() => handleAttendanceAction(record.id, 'Rejected')}>
                        Reject
                      </Button>
                      <Button variant="default" size="sm" onClick={() => handleAttendanceAction(record.id, 'Approved')}>
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ATTENDANCE REQUESTS SECTION (WFH, OD, REGULARIZATION) */}
        <div className="flex flex-col gap-3 border-t border-ds-neutral-100 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPinned className="size-4 text-ds-info-dark" />
              <h4 className="text-ds-body font-semibold text-ds-brand-navy">Attendance & Remote Requests</h4>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {pendingRequests.length} pending
              </span>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveReqFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  activeReqFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveReqFilter('WFH')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  activeReqFilter === 'WFH' ? 'bg-cyan-600 text-white shadow-sm' : 'text-cyan-800 hover:text-cyan-950'
                }`}
              >
                WFH
              </button>
              <button
                onClick={() => setActiveReqFilter('ON_DUTY')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  activeReqFilter === 'ON_DUTY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-800 hover:text-indigo-950'
                }`}
              >
                On-Duty
              </button>
              <button
                onClick={() => setActiveReqFilter('REGULARIZATION')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  activeReqFilter === 'REGULARIZATION' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-800 hover:text-emerald-950'
                }`}
              >
                Regularization
              </button>
            </div>
          </div>

          {filteredRequests.length === 0 && (
            <span className="text-ds-body-sm text-ds-neutral-500 py-2">
              No pending requests matching the selected filter.
            </span>
          )}
          
          {filteredRequests.map(req => {
            const emp = employees.find(e => e.id === req.employeeId)
            const type = req.type || 'WFH'
            const sDate = req.startDate || req.date
            const eDate = req.endDate || sDate
            const dateStr = sDate === eDate ? sDate : `${sDate} to ${eDate}`

            return (
              <div
                key={req.id}
                className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-4 border border-ds-neutral-200 rounded-xl shadow-sm gap-4 hover:border-slate-300 transition-all"
              >
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {type === 'WFH' && (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
                        <Home className="size-3" />
                        WFH Request
                      </span>
                    )}
                    {type === 'ON_DUTY' && (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                        <Briefcase className="size-3" />
                        On-Duty (OD)
                      </span>
                    )}
                    {type === 'REGULARIZATION' && (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Clock className="size-3" />
                        Regularization
                      </span>
                    )}
                    <span className="text-ds-body font-semibold text-ds-brand-navy">
                      {emp?.name || req.employeeId}
                    </span>
                    <span className="text-xs text-ds-neutral-500 font-mono">({req.employeeId})</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ds-neutral-600">
                    <span>
                      <strong className="text-slate-700">Dates:</strong> {dateStr}
                    </span>
                    {req.location && (
                      <span>
                        <strong className="text-slate-700">Location:</strong> {req.location}
                      </span>
                    )}
                    {req.inTime && req.outTime && (
                      <span>
                        <strong className="text-slate-700">Requested Timings:</strong> {req.inTime} - {req.outTime}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 p-2 rounded-lg italic">
                    "{req.purpose}"
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="Remarks / approval note (optional)..."
                      value={remarks[req.id] || ''}
                      onChange={(e) => setRemarks(prev => ({ ...prev, [req.id]: e.target.value }))}
                      className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                  <Button
                    variant="destructive-outline"
                    size="sm"
                    onClick={() => handleRequestAction(req.id, 'Rejected')}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleRequestAction(req.id, 'Approved')}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </SectionCard>
  )
}
