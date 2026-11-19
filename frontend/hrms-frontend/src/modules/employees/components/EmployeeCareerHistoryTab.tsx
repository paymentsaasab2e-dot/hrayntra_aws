"use client"

import * as React from 'react'
import { SectionCard, Button } from '@hryantra/ui'
import {
  TrendingUp,
  Building2,
  Users,
  CheckCircle2,
  Award,
  FileEdit,
  Calendar,
  MapPin,
  Network,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  History,
  XCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { Employee, EmploymentHistoryItem, EmploymentChangeType } from '../types'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import { notifyDataChanged, useDataSync } from '@/shared/events'

interface EmployeeCareerHistoryTabProps {
  employee: Employee
}

const MILESTONE_CONFIG: Record<
  EmploymentChangeType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badgeBg: string }
> = {
  INITIAL_HIRE: {
    label: 'Initial Hire / Joining',
    icon: Award,
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeBg: 'bg-emerald-500',
  },
  PROMOTION: {
    label: 'Promotion',
    icon: TrendingUp,
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-600',
  },
  TRANSFER: {
    label: 'Department / Location Transfer',
    icon: Building2,
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    badgeBg: 'bg-amber-500',
  },
  REPORTING_CHANGE: {
    label: 'Reporting Line Change',
    icon: Users,
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-500',
  },
  CONFIRMATION: {
    label: 'Probation Confirmation',
    icon: CheckCircle2,
    color: 'text-teal-700 bg-teal-50 border-teal-200',
    badgeBg: 'bg-teal-500',
  },
  REVISION: {
    label: 'Role / Profile Revision',
    icon: FileEdit,
    color: 'text-slate-700 bg-slate-50 border-slate-200',
    badgeBg: 'bg-slate-500',
  },
}

export function EmployeeCareerHistoryTab({ employee }: EmployeeCareerHistoryTabProps) {
  const { currentUserRole, hasAction } = useStore()
  const canManage = currentUserRole === 'HR' || currentUserRole === 'Superadmin' || hasAction('employees_edit')

  const [subTab, setSubTab] = React.useState<'timeline' | 'requests'>('timeline')
  const [history, setHistory] = React.useState<EmploymentHistoryItem[]>([])
  const [changeRequests, setChangeRequests] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Direct Milestone Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [newMilestone, setNewMilestone] = React.useState({
    changeType: 'PROMOTION' as EmploymentChangeType,
    effectiveDate: new Date().toISOString().slice(0, 10),
    designation: employee.designation,
    department: employee.department,
    remarks: '',
    updateActiveProfile: true,
  })

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const empDbId = employee.recordId || employee.id
      const [histRes, reqRes] = await Promise.all([
        api.employees.getHistory(empDbId).catch(() => ({ data: [] })),
        api.employees.getChangeRequests({ employeeId: empDbId }).catch(() => ({ data: [] })),
      ])
      const hList = histRes?.data || histRes || []
      const rList = reqRes?.data || reqRes || []
      setHistory(Array.isArray(hList) ? hList : [])
      setChangeRequests(Array.isArray(rList) ? rList : [])
    } catch (err: any) {
      console.error('Failed to load career history and change requests:', err)
      setError(err?.message || 'Could not load career records')
    } finally {
      setLoading(false)
    }
  }, [employee.id, employee.recordId])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Real-time synchronization
  useDataSync(['employees', 'approvals'], () => {
    loadData()
  })

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const empDbId = employee.recordId || employee.id
      await api.employees.addHistoryMilestone(empDbId, newMilestone)
      notifyDataChanged('employees', { employeeId: empDbId, action: 'HISTORY_ADDED' })
      setIsModalOpen(false)
      setNewMilestone({
        changeType: 'PROMOTION',
        effectiveDate: new Date().toISOString().slice(0, 10),
        designation: employee.designation,
        department: employee.department,
        remarks: '',
        updateActiveProfile: true,
      })
      await loadData()
    } catch (err: any) {
      alert(err?.message || 'Failed to add career milestone')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMilestone = async (historyId: string) => {
    if (!confirm('Are you sure you want to remove this milestone record?')) return
    try {
      const empDbId = employee.recordId || employee.id
      await api.employees.deleteHistoryMilestone(empDbId, historyId)
      notifyDataChanged('employees', { employeeId: empDbId, action: 'HISTORY_DELETED' })
      await loadData()
    } catch (err: any) {
      alert(err?.message || 'Failed to delete milestone')
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="size-4.5 text-purple-600" />
            Employment History & Career Timeline
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chronological log of verified appointments, promotions, department transfers, and profile change requests.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs"
          >
            <Plus className="size-4" />
            Record Milestone
          </Button>
        )}
      </div>

      {/* Sub-tab Navigation: Career Timeline vs Change Requests Log */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('timeline')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            subTab === 'timeline'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <History className="size-3.5" />
          Career Timeline ({history.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('requests')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            subTab === 'requests'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileEdit className="size-3.5" />
          Change Requests Log ({changeRequests.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-3 border-purple-600 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-500">Loading career records...</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm">
          {error}
        </div>
      ) : subTab === 'requests' ? (
        /* Change Requests Log View */
        changeRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
            <FileEdit className="size-10 text-slate-400 mb-3" />
            <p className="text-sm font-bold text-slate-800">No change requests recorded yet</p>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Profile, role, and custom attribute update requests submitted for HR approval will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {changeRequests.map((req: any) => {
              const isApproved = req.status === 'APPROVED'
              const isRejected = req.status === 'REJECTED'
              const isPending = req.status === 'PENDING'

              return (
                <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
                        <FileEdit className="size-3.5" />
                        {req.category || 'JOB_ROLE'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : isRejected
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Submitted: <strong>{formatDate(req.createdAt)}</strong></span>
                      {req.effectiveDate && (
                        <span>Effective: <strong>{formatDate(req.effectiveDate)}</strong></span>
                      )}
                    </div>
                  </div>

                  {req.reason && (
                    <p className="text-xs text-slate-600 italic">
                      Reason: <strong className="font-semibold text-slate-800">"{req.reason}"</strong>
                    </p>
                  )}

                  {req.changes && Object.keys(req.changes).length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-1">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Field</th>
                            <th className="py-2 px-3">Previous Value</th>
                            <th className="py-2 px-3">Requested New Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {Object.entries(req.changes).map(([field, val]: any) => (
                            <tr key={field}>
                              <td className="py-2 px-3 font-semibold text-slate-700 capitalize">
                                {field.replace(/_/g, ' ')}
                              </td>
                              <td className="py-2 px-3 text-slate-400 line-through">
                                {String(val.oldValue ?? '—')}
                              </td>
                              <td className="py-2 px-3 font-bold text-purple-700">
                                {String(val.newValue ?? '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {req.reviewedAt && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
                      <span className="flex items-center gap-1.5">
                        {isApproved ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : (
                          <XCircle className="size-4 text-rose-600" />
                        )}
                        Reviewed on {formatDate(req.reviewedAt)}: <em>"{req.reviewRemark || 'No remark provided'}"</em>
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
          <Clock className="size-10 text-slate-400 mb-3" />
          <p className="text-sm font-bold text-slate-800">No career milestones recorded yet</p>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            New promotions, department transfers, or confirmed change requests will automatically populate here.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
          <div className="flex flex-col gap-6">
            {history.map((item, idx) => {
              const config = MILESTONE_CONFIG[item.changeType] || MILESTONE_CONFIG.REVISION
              const Icon = config.icon
              const isFuture = new Date(item.effectiveDate).getTime() > Date.now()
              const isCurrent = idx === 0 && !item.endDate && !isFuture

              return (
                <div key={item.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-3.5 size-7 rounded-full flex items-center justify-center text-white ring-4 ring-white shadow-xs ${config.badgeBg}`}
                  >
                    <Icon className="size-3.5" />
                  </div>

                  {/* Milestone Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 p-5 shadow-xs transition-all duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.color}`}
                        >
                          <Icon className="size-3.5" />
                          {config.label}
                        </span>

                        {isCurrent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Current Active Position
                          </span>
                        )}

                        {isFuture && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="size-3" />
                            Upcoming Effective Milestone
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-slate-400" />
                          <span>Effective: </span>
                          <strong className="text-slate-800">{formatDate(item.effectiveDate)}</strong>
                          {item.endDate && (
                            <span className="text-slate-400">
                              (until {formatDate(item.endDate)})
                            </span>
                          )}
                        </div>

                        {canManage && item.changeType !== 'INITIAL_HIRE' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMilestone(item.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete this milestone"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Role & Position Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-2">
                      <div className="flex items-start gap-2.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <Award className="size-4 text-purple-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Designation / Role</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">{item.designation}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <Building2 className="size-4 text-purple-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">{item.department}</p>
                        </div>
                      </div>

                      {(item.locationName || item.orgUnitName) && (
                        <div className="flex items-start gap-2.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                          <MapPin className="size-4 text-purple-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Site / Unit</p>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">
                              {item.locationName || item.orgUnitName || '—'}
                            </p>
                          </div>
                        </div>
                      )}

                      {item.reportsToName && (
                        <div className="flex items-start gap-2.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                          <Network className="size-4 text-purple-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reporting Line</p>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">{item.reportsToName}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {item.remarks && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-start gap-2 bg-purple-50/40 p-2.5 rounded-xl border border-purple-100/60">
                        <span className="font-bold text-purple-900 shrink-0">Official Remark:</span>
                        <span>{item.remarks}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Manual Milestone Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="size-5 text-purple-600" />
                Record Career Milestone
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Milestone Type</label>
                <select
                  value={newMilestone.changeType}
                  onChange={(e) =>
                    setNewMilestone({ ...newMilestone, changeType: e.target.value as EmploymentChangeType })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                >
                  <option value="PROMOTION">🚀 Promotion</option>
                  <option value="TRANSFER">🏢 Department / Location Transfer</option>
                  <option value="CONFIRMATION">🎯 Probation Confirmation</option>
                  <option value="REPORTING_CHANGE">👥 Manager / Reporting Change</option>
                  <option value="REVISION">📝 Title / Role Revision</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Effective Date</label>
                <input
                  type="date"
                  required
                  value={newMilestone.effectiveDate}
                  onChange={(e) => setNewMilestone({ ...newMilestone, effectiveDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Can be today, future-dated, or retroactive.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Designation</label>
                  <input
                    type="text"
                    required
                    value={newMilestone.designation}
                    onChange={(e) => setNewMilestone({ ...newMilestone, designation: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Department</label>
                  <input
                    type="text"
                    required
                    value={newMilestone.department}
                    onChange={(e) => setNewMilestone({ ...newMilestone, department: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Official Remarks / Justification</label>
                <textarea
                  rows={3}
                  value={newMilestone.remarks}
                  onChange={(e) => setNewMilestone({ ...newMilestone, remarks: e.target.value })}
                  placeholder="e.g. Promoted during Annual Appraisal Cycle 2026-27"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newMilestone.updateActiveProfile}
                  onChange={(e) => setNewMilestone({ ...newMilestone, updateActiveProfile: e.target.checked })}
                  className="size-4 rounded-sm text-purple-600 focus:ring-purple-500 border-slate-300"
                />
                Update current active employee profile immediately
              </label>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {submitting ? 'Recording...' : 'Save Milestone'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
