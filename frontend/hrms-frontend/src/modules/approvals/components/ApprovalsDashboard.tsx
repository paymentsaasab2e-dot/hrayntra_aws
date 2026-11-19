"use client"
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
import * as React from 'react'
import { PageHeroBanner, SectionCard, StatusBadge, Button } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { ApprovalItem, ApprovalType } from '@/modules/approvals/types'
import { api } from '@/shared/api'
import { notifyDataChanged, useDataSync } from '@/shared/events'
import { Clock, CheckCircle, AlertTriangle, Filter } from 'lucide-react'
import { ApprovalDrawer } from './ApprovalDrawer'

type HierarchyApproval = {
  id: string
  type: string
  status: string
  currentLevel: number
  maxLevel: number
  referenceId?: string | null
  createdAt: string
  employee?: { employeeId: string; name: string; department?: string } | null
  leave?: { id: string; type: string; startDate: string; endDate: string; reason: string } | null
  separation?: {
    id: string
    reason: string
    requestedLWD: string
    approvedLWD?: string | null
    noticePeriodDays: number
    status: string
  } | null
  orgSite?: { orgUnitId?: string; name?: string; parentName?: string } | null
}

function mapHierarchyToItems(rows: HierarchyApproval[]): ApprovalItem[] {
  return rows.map((row) => {
    if (row.type === 'LEAVE' && row.leave) {
      const start = new Date(row.leave.startDate)
      const end = new Date(row.leave.endDate)
      const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1
      const daysToStart = Math.ceil((start.getTime() - Date.now()) / (1000 * 3600 * 24))
      return {
        id: `hier-l-${row.id}`,
        originalId: row.leave.id,
        approvalRequestId: row.id,
        approvalLevel: { current: row.currentLevel, max: row.maxLevel },
        type: 'Leave',
        employeeId: row.employee?.employeeId || '',
        employeeName: row.employee?.name,
        createdAt: row.createdAt,
        status: 'Pending',
        priority: daysToStart <= 3 ? 'High' : 'Medium',
        details: {
          title: `${row.leave.type} Leave (L${row.currentLevel}/${row.maxLevel})`,
          description: `${formatDate(row.leave.startDate)} to ${formatDate(row.leave.endDate)}`,
          meta: { reason: row.leave.reason, days, level: row.currentLevel },
        },
      }
    }

    if (row.type === 'EXIT' && row.separation) {
      return {
        id: `hier-x-${row.id}`,
        originalId: row.separation.id,
        approvalRequestId: row.id,
        approvalLevel: { current: row.currentLevel, max: row.maxLevel },
        type: 'Exit',
        employeeId: row.employee?.employeeId || '',
        employeeName: row.employee?.name,
        createdAt: row.createdAt,
        status: 'Pending',
        priority: row.currentLevel === 2 ? 'High' : 'Medium',
        details: {
          title: `Resignation (L${row.currentLevel}/${row.maxLevel})`,
          description: `Requested LWD: ${formatDate(row.separation.requestedLWD)} • Notice: ${row.separation.noticePeriodDays} days`,
          meta: {
            reason: row.separation.reason,
            requestedLWD: row.separation.requestedLWD,
            noticePeriodDays: row.separation.noticePeriodDays,
          },
        },
      }
    }

    if (row.type === 'ORG_SETTINGS' && row.orgSite) {
      return {
        id: `hier-o-${row.id}`,
        originalId: row.orgSite.orgUnitId || row.referenceId || row.id,
        approvalRequestId: row.id,
        approvalLevel: { current: row.currentLevel, max: row.maxLevel },
        type: 'Org Site',
        employeeId: '',
        createdAt: row.createdAt,
        status: 'Pending',
        priority: 'Medium',
        details: {
          title: `New site: ${row.orgSite.name}`,
          description: `Under ${row.orgSite.parentName || 'division'} — HQ approval required`,
          meta: { orgUnitId: row.orgSite.orgUnitId },
        },
      }
    }

    if (row.type === 'WFH') {
      const payload: any = (row as any).payload || {}
      return {
        id: `hier-wfh-${row.id}`,
        originalId: row.referenceId || row.id,
        approvalRequestId: row.id,
        approvalLevel: { current: 1, max: 1 },
        type: 'WFH',
        employeeId: row.employee?.employeeId || '',
        employeeName: row.employee?.name,
        createdAt: row.createdAt,
        status: 'Pending',
        priority: 'Medium',
        details: {
          title: 'Work From Home (WFH)',
          description: `${payload.startDate || ''} to ${payload.endDate || payload.startDate || ''} • ${payload.location || 'Home'}`,
          meta: { reason: payload.reason, location: payload.location, dates: `${payload.startDate} - ${payload.endDate}` },
        },
      }
    }

    if (row.type === 'ON_DUTY') {
      const payload: any = (row as any).payload || {}
      return {
        id: `hier-od-${row.id}`,
        originalId: row.referenceId || row.id,
        approvalRequestId: row.id,
        approvalLevel: { current: 1, max: 1 },
        type: 'On-Duty',
        employeeId: row.employee?.employeeId || '',
        employeeName: row.employee?.name,
        createdAt: row.createdAt,
        status: 'Pending',
        priority: 'Medium',
        details: {
          title: 'On-Duty / Outdoor Duty (OD)',
          description: `${payload.startDate || ''} to ${payload.endDate || payload.startDate || ''} • Site: ${payload.location || ''}`,
          meta: { purpose: payload.reason, site: payload.location },
        },
      }
    }

    if (row.type === 'REGULARIZATION') {
      const payload: any = (row as any).payload || {}
      return {
        id: `hier-reg-${row.id}`,
        originalId: row.referenceId || row.id,
        approvalRequestId: row.id,
        approvalLevel: { current: 1, max: 1 },
        type: 'Regularization',
        employeeId: row.employee?.employeeId || '',
        employeeName: row.employee?.name,
        createdAt: row.createdAt,
        status: 'Pending',
        priority: 'Medium',
        details: {
          title: 'Attendance Regularization',
          description: `Date: ${payload.startDate} • Requested: ${payload.inTime || '09:30'} - ${payload.outTime || '18:30'}`,
          meta: { reason: payload.reason, inTime: payload.inTime, outTime: payload.outTime },
        },
      }
    }

    if (row.type === 'SHORT_LEAVE') {
      const payload: any = (row as any).payload || {}
      return {
        id: `hier-sl-${row.id}`,
        originalId: row.referenceId || row.id,
        approvalRequestId: row.id,
        approvalLevel: { current: 1, max: 1 },
        type: 'Short Leave',
        employeeId: row.employee?.employeeId || '',
        employeeName: row.employee?.name,
        createdAt: row.createdAt,
        status: 'Pending',
        priority: 'Medium',
        details: {
          title: `Short-Leave / Permission (${payload.shortLeaveHours || 2}h ${payload.shortLeaveType === 'LATE_ENTRY' ? 'Late Arrival' : 'Early Exit'})`,
          description: `Date: ${payload.startDate || ''} • Reason: ${payload.reason || ''}`,
          meta: { hours: payload.shortLeaveHours, type: payload.shortLeaveType, reason: payload.reason },
        },
      }
    }

    if (row.type === 'EMPLOYEE_CHANGE') {
      const p = (row as any).employeeChange || (row as any).payload || {}
      const changes = p.changes || {}
      const changeSummary = Object.keys(changes)
        .map((k) => `${k}: "${changes[k]?.oldValue || '—'}" ➔ "${changes[k]?.newValue || '—'}"`)
        .join(' • ')
      const effDate = p.effectiveDate
        ? new Date(p.effectiveDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Immediate'

      return {
        id: `hier-ecr-${row.id}`,
        originalId: row.referenceId || row.id,
        approvalRequestId: row.id,
        approvalLevel: { current: 1, max: 1 },
        type: 'Employee Change',
        employeeId: row.employee?.employeeId || '',
        employeeName: row.employee?.name,
        createdAt: row.createdAt,
        status: 'Pending',
        priority: 'High',
        details: {
          title: `Profile / Role Change (${p.category || 'JOB_ROLE'})`,
          description: `Effective: ${effDate} • ${changeSummary || p.reason || 'Requested change'}`,
          meta: { ...p, changes, effectiveDate: p.effectiveDate },
        },
      }
    }

    return {
      id: `hier-${row.id}`,
      originalId: row.referenceId || row.id,
      approvalRequestId: row.id,
      type: 'Leave',
      employeeId: '',
      createdAt: row.createdAt,
      status: 'Pending',
      priority: 'Low',
      details: { title: row.type, description: 'Approval request' },
    }
  })
}

export function ApprovalsDashboard() {
  const {
    employees, tasks, leaveRequests, remoteRequests, performanceReviews,
    updateTask, updateLeaveStatus, updateRequestStatus, submitManagerReview,
    currentUserRole, hasTab,
  } = useStore()

  const [hierarchyItems, setHierarchyItems] = React.useState<ApprovalItem[]>([])
  const [hierarchyLeaveIds, setHierarchyLeaveIds] = React.useState<Set<string>>(new Set())
  const [inboxLoading, setInboxLoading] = React.useState(true)
  const [inboxError, setInboxError] = React.useState<string | null>(null)

  const loadHierarchyInbox = React.useCallback(async () => {
    setInboxLoading(true)
    setInboxError(null)
    try {
      const res = await api.approvals.getInbox()
      const rows: HierarchyApproval[] = Array.isArray(res?.data) ? res.data : []
      const mapped = mapHierarchyToItems(rows)
      setHierarchyItems(mapped)
      setHierarchyLeaveIds(new Set(rows.filter((r) => r.leave?.id).map((r) => r.leave!.id)))
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : 'Failed to load approval inbox')
      setHierarchyItems([])
      setHierarchyLeaveIds(new Set())
    } finally {
      setInboxLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (currentUserRole !== 'Employee' && hasTab('approvals')) {
      loadHierarchyInbox()
    }
  }, [currentUserRole, hasTab, loadHierarchyInbox])

  // Instant reactive sync when approvals, leaves, or employees change
  useDataSync(['leave', 'attendance', 'employees', 'approvals'], () => {
    if (currentUserRole !== 'Employee' && hasTab('approvals')) {
      loadHierarchyInbox()
    }
  })

  if (currentUserRole === 'Employee') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <AlertTriangle className="size-16 text-ds-warning mb-4" />
        <h3 className="text-ds-heading text-ds-brand-navy">Access Restricted</h3>
        <p className="text-ds-body text-ds-neutral-500 max-w-md">You do not have the required permissions to view the unified approvals dashboard. Please contact your manager or HR administrator.</p>
      </div>
    )
  }

  const [filterType, setFilterType] = React.useState<ApprovalType | 'All'>('All')
  const [filterStatus, setFilterStatus] = React.useState<string>('Pending')
  const [selectedItem, setSelectedItem] = React.useState<ApprovalItem | null>(null)
  const [acting, setActing] = React.useState(false)

  const approvalItems: ApprovalItem[] = React.useMemo(() => {
    const items: ApprovalItem[] = [...hierarchyItems]

    leaveRequests.forEach((l) => {
      if (hierarchyLeaveIds.has(l.id)) return
      const daysToStart = Math.ceil((new Date(l.startDate).getTime() - Date.now()) / (1000 * 3600 * 24))
      items.push({
        id: `agg-l-${l.id}`,
        originalId: l.id,
        type: 'Leave',
        employeeId: l.employeeId,
        createdAt: l.createdAt,
        status: l.status,
        priority: l.status === 'Pending' ? (daysToStart <= 3 ? 'High' : 'Medium') : 'Low',
        details: {
          title: `${l.type} Leave Request`,
          description: `${l.startDate} to ${l.endDate}`,
          meta: { reason: l.reason, days: l.totalDays },
        },
      })
    })

    remoteRequests.forEach((r) => {
      const isWfh = r.type === 'WFH' || (!r.type && r.location?.toLowerCase().includes('home'))
      const isOd = r.type === 'ON_DUTY'
      const isReg = r.type === 'REGULARIZATION'
      const isSl = r.type === 'SHORT_LEAVE'

      const appType: ApprovalType = isWfh ? 'WFH' : isOd ? 'On-Duty' : isReg ? 'Regularization' : isSl ? 'Short Leave' : 'Remote Attendance'
      items.push({
        id: `agg-r-${r.id}`,
        originalId: r.id,
        type: appType,
        employeeId: r.employeeId,
        createdAt: r.createdAt,
        status: r.status,
        priority: r.status === 'Pending' ? 'Medium' : 'Low',
        details: {
          title: isWfh ? 'Work From Home (WFH)' : isOd ? 'On-Duty (OD)' : isReg ? 'Regularization' : isSl ? `Short-Leave (${r.shortLeaveHours || 2}h ${r.shortLeaveType || ''})` : 'Remote Work Request',
          description: r.startDate && r.endDate && r.startDate !== r.endDate ? `${r.startDate} to ${r.endDate}` : `For date: ${r.date}`,
          meta: { purpose: r.purpose, location: r.location, inTime: r.inTime, outTime: r.outTime },
        },
      })
    })

    performanceReviews.forEach((p) => {
      if (p.status === 'Pending Manager Review') {
        items.push({
          id: `agg-p-${p.id}`,
          originalId: p.id,
          type: 'Performance',
          employeeId: p.employeeId,
          createdAt: p.selfAssessment?.submittedAt || new Date().toISOString(),
          status: 'Pending',
          priority: 'Medium',
          details: {
            title: `Performance Review - ${p.cycle}`,
            description: `Self-assessment submitted: Rating ${p.selfAssessment?.rating}/5`,
            meta: { comments: p.selfAssessment?.comments },
          },
        })
      }
    })

    tasks.forEach((task) => {
      if (task.approvalStatus === 'Pending Approval') {
        items.push({
          id: `agg-t-${task.id}`,
          originalId: task.id,
          type: 'Task',
          employeeId: task.assignee.id,
          createdAt: task.completedAt || task.createdAt,
          status: 'Pending',
          priority: task.priority === 'urgent' || task.priority === 'high' ? 'High' : 'Medium',
          details: {
            title: `Task Completion: ${task.title}`,
            description: task.description || 'Task submitted for approval.',
            meta: { dueDate: task.dueDate, priority: task.priority },
          },
        })
      }
    })

    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [hierarchyItems, hierarchyLeaveIds, leaveRequests, performanceReviews, remoteRequests, tasks])

  const filteredItems = approvalItems.filter((item) => {
    if (filterType !== 'All' && item.type !== filterType) return false
    if (filterStatus !== 'All' && filterStatus === 'Pending' && !['Pending', 'Modification Requested'].includes(item.status)) return false
    if (filterStatus !== 'All' && filterStatus === 'Completed' && ['Pending', 'Modification Requested'].includes(item.status)) return false
    return true
  })

  const actOnHierarchy = async (
    item: ApprovalItem,
    action: 'approve' | 'reject',
    remark?: string,
    approvedLWD?: string
  ) => {
    if (!item.approvalRequestId) return false
    setActing(true)
    try {
      await api.approvals.act(item.approvalRequestId, action, remark, approvedLWD)
      await loadHierarchyInbox()
      if (item.type === 'Leave' && action === 'approve') {
        if (!item.originalId.startsWith('req_')) {
          updateLeaveStatus(item.originalId, 'Approved')
        } else {
          updateRequestStatus(item.originalId, 'Approved', remark)
        }
      }
      if (item.type === 'Leave' && action === 'reject') {
        if (!item.originalId.startsWith('req_')) {
          updateLeaveStatus(item.originalId, 'Rejected')
        } else {
          updateRequestStatus(item.originalId, 'Rejected', remark)
        }
      }
      if (['Remote Attendance', 'WFH', 'On-Duty', 'Regularization', 'Short Leave'].includes(item.type)) {
        updateRequestStatus(item.originalId, action === 'approve' ? 'Approved' : 'Rejected', remark)
      }
      if (item.type === 'Employee Change') {
        notifyDataChanged('employees', { approvalRequestId: item.approvalRequestId, action })
      }
      notifyDataChanged('leave', { approvalRequestId: item.approvalRequestId, action })
      notifyDataChanged('attendance', { approvalRequestId: item.approvalRequestId, action })
      notifyDataChanged('approvals', { approvalRequestId: item.approvalRequestId, action })
      return true
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : 'Approval action failed')
      return false
    } finally {
      setActing(false)
    }
  }

  const handleApprove = async (item: ApprovalItem, extra?: { remark?: string; approvedLWD?: string }) => {
    if (item.approvalRequestId) {
      const ok = await actOnHierarchy(item, 'approve', extra?.remark, extra?.approvedLWD)
      if (ok) setSelectedItem(null)
      return
    }
    if (item.type === 'Leave') {
      if (!item.originalId.startsWith('req_')) {
        updateLeaveStatus(item.originalId, 'Approved')
      } else {
        updateRequestStatus(item.originalId, 'Approved', extra?.remark)
      }
    }
    if (['Remote Attendance', 'WFH', 'On-Duty', 'Regularization', 'Short Leave'].includes(item.type)) {
      updateRequestStatus(item.originalId, 'Approved', extra?.remark)
    }
    if (item.type === 'Employee Change') {
      await api.employees.updateChangeRequestStatus(item.originalId, { status: 'APPROVED', reviewRemark: extra?.remark })
      notifyDataChanged('employees', { action: 'APPROVED' })
    }
    if (item.type === 'Performance') submitManagerReview(item.originalId, 4, 'Auto-approved.')
    if (item.type === 'Task') updateTask(item.originalId, { approvalStatus: 'Approved' })
    setSelectedItem(null)
  }

  const handleReject = async (item: ApprovalItem, extra?: { remark?: string }) => {
    if (item.approvalRequestId) {
      const ok = await actOnHierarchy(item, 'reject', extra?.remark)
      if (ok) setSelectedItem(null)
      return
    }
    if (item.type === 'Leave') {
      if (!item.originalId.startsWith('req_')) {
        updateLeaveStatus(item.originalId, 'Rejected')
      } else {
        updateRequestStatus(item.originalId, 'Rejected', extra?.remark)
      }
    }
    if (['Remote Attendance', 'WFH', 'On-Duty', 'Regularization', 'Short Leave'].includes(item.type)) {
      updateRequestStatus(item.originalId, 'Rejected', extra?.remark)
    }
    if (item.type === 'Employee Change') {
      await api.employees.updateChangeRequestStatus(item.originalId, { status: 'REJECTED', reviewRemark: extra?.remark })
      notifyDataChanged('employees', { action: 'REJECTED' })
    }
    if (item.type === 'Task') updateTask(item.originalId, { status: 'in_progress', approvalStatus: 'Changes Requested' })
    setSelectedItem(null)
  }

  const handleRequestChanges = (item: ApprovalItem) => {
    if (item.type === 'Leave' && !item.approvalRequestId) {
      updateLeaveStatus(item.originalId, 'Modification Requested', 'Please update dates or reason and resubmit.')
    }
    setSelectedItem(null)
  }

  const getPriorityColor = (p: string) => {
    if (p === 'High') return 'text-ds-danger-dark bg-ds-danger-light/30 border-ds-danger-border'
    if (p === 'Medium') return 'text-amber-700 bg-amber-50 border-amber-200'
    return 'text-ds-neutral-600 bg-ds-neutral-100 border-ds-neutral-200'
  }

  const resolveEmployeeName = (item: ApprovalItem) => {
    if (item.employeeName) return item.employeeName
    return employees.find((e) => e.id === item.employeeId)?.name || (item.type === 'Org Site' ? 'Org proposal' : 'Unknown')
  }

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  return (
    <div className="flex flex-col h-full space-y-5 max-w-7xl mx-auto w-full p-6 overflow-y-auto">
      {inboxError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{inboxError}</div>
      )}

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 border border-ds-neutral-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter className="size-5 text-ds-neutral-400" />
          <div className="flex gap-2 flex-wrap">
            {['All', 'Employee Change', 'Leave', 'WFH', 'On-Duty', 'Short Leave', 'Regularization', 'Exit', 'Org Site', 'Task', 'Performance'].map((t) => (
              <Button
                key={t}
                variant={filterType === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(t as ApprovalType | 'All')}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ds-body-sm text-ds-neutral-500 font-medium mr-2">Status:</span>
          <select
            className="text-ds-body-sm border border-ds-neutral-300 rounded-md px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-ds-brand-green/20"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="Pending">Pending Action</option>
            <option value="Completed">Completed History</option>
            <option value="All">Show All</option>
          </select>
        </div>
      </div>

      <SectionCard title="Approval Queue" className="flex-1 min-h-[500px]">
        {inboxLoading && hierarchyItems.length === 0 ? (
          <p className="text-sm text-ds-neutral-500 py-8 text-center">Loading hierarchy approvals...</p>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="size-16 text-ds-success-light mb-4" />
            <h3 className="text-ds-heading text-ds-brand-navy">You&apos;re all caught up!</h3>
            <p className="text-ds-body text-ds-neutral-500">There are no pending requests matching your filters.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map((item) => {
              const name = resolveEmployeeName(item)
              const initials = name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2) || '?'
              return (
                <div
                  key={item.id}
                  className={`flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl hover:shadow-md transition-shadow cursor-pointer ${
                    item.priority === 'High' && item.status === 'Pending' ? 'border-l-4 border-l-ds-danger bg-red-50/10' : 'border-ds-neutral-200 bg-white'
                  }`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="flex items-start gap-4">
                    <div className="size-10 rounded-full bg-ds-brand-navy-light text-white flex items-center justify-center font-bold shrink-0 mt-1">
                      {initials}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-ds-body font-semibold text-ds-brand-navy">{name}</span>
                        <span className="text-ds-caption text-ds-neutral-400">•</span>
                        <span className="text-ds-caption text-ds-neutral-500">{item.type}</span>
                        {item.approvalLevel && (
                          <span className="text-[10px] px-2 py-0.5 rounded border font-semibold text-indigo-700 bg-indigo-50 border-indigo-200">
                            L{item.approvalLevel.current}/{item.approvalLevel.max}
                          </span>
                        )}
                        {item.status === 'Pending' && (
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getPriorityColor(item.priority)}`}>
                            {item.priority} Priority
                          </span>
                        )}
                      </div>
                      <span className="text-ds-body-sm text-ds-neutral-700">{item.details.title}</span>
                      <span className="text-ds-caption text-ds-neutral-500 mt-1 flex items-center gap-1">
                        <Clock className="size-3" /> Submitted {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-4 md:mt-0 justify-end">
                    <StatusBadge status={item.status === 'Completed' || item.status === 'Approved' ? 'Approved' : item.status === 'Rejected' ? 'Rejected' : 'Pending'} />

                    {item.status === 'Pending' && (
                      <div className="flex items-center gap-2 ml-4 border-l border-ds-neutral-200 pl-4" onClick={(e) => e.stopPropagation()}>
                        {item.type === 'Leave' && !item.approvalRequestId && (
                          <Button variant="outline" size="sm" onClick={() => handleRequestChanges(item)}>
                            Request Changes
                          </Button>
                        )}
                        <Button variant="destructive-outline" size="sm" disabled={acting} onClick={() => handleReject(item)}>
                          Reject
                        </Button>
                        <Button variant="default" size="sm" disabled={acting} onClick={() => handleApprove(item)}>
                          Approve
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

      {selectedItem && (
        <ApprovalDrawer
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}
