import { Task, TaskPriority, TaskScheduleType, Weekday } from './types'

export function normalizeTaskStatus(status: string | undefined): Task['status'] {
  const normalized = String(status || 'TODO').toUpperCase()
  if (normalized === 'IN_PROGRESS') return 'in_progress'
  if (normalized === 'DONE' || normalized === 'COMPLETED') return 'completed'
  if (normalized === 'BLOCKED') return 'blocked'
  return 'todo'
}

export function normalizeTaskPriority(priority: string | undefined): TaskPriority {
  const normalized = String(priority || 'medium').toLowerCase().replace(/_/g, '_')
  if (normalized === 'less_urgent') return 'less_urgent'
  if (normalized === 'low') return 'low'
  if (normalized === 'high') return 'high'
  if (normalized === 'urgent') return 'urgent'
  return 'medium'
}

export function normalizeScheduleType(value: string | undefined): TaskScheduleType {
  const normalized = String(value || 'NONE').toLowerCase()
  if (normalized === 'specific_date') return 'specific_date'
  if (normalized === 'day_of_week') return 'day_of_week'
  return 'none'
}

export function resolveEmployeeSelectId(
  employeeIdOrMongoId: string | undefined,
  employees: { id: string; recordId?: string }[]
): string {
  if (!employeeIdOrMongoId) return ''
  if (employees.some(item => item.id === employeeIdOrMongoId)) return employeeIdOrMongoId
  const match = employees.find(item => item.recordId === employeeIdOrMongoId)
  return match?.id || employeeIdOrMongoId
}

export function mapTaskFromApi(t: any, employees: { id: string; name: string; recordId?: string }[]): Task {
  const employeeName = t.employee
    ? `${t.employee.firstName} ${t.employee.lastName}`
    : 'Unassigned'
  const employeeCode = t.employee?.employeeId || t.assignedTo

  const assigneeIds: string[] = Array.isArray(t.assigneeIds) ? t.assigneeIds : []
  const assignees = assigneeIds.map((mongoId: string) => {
    const emp = employees.find(item => item.recordId === mongoId || item.id === mongoId)
    return {
      id: emp?.id || mongoId,
      name: emp?.name || employeeName,
    }
  })

  if (assignees.length === 0) {
    assignees.push({ id: employeeCode, name: employeeName })
  }

  const projectHead = t.projectHeadId
    ? employees.find(item => item.recordId === t.projectHeadId || item.id === t.projectHeadId)
    : undefined

  return {
    id: t.id,
    title: t.title,
    description: t.description || t.remarks || '',
    remarks: t.remarks || t.description || '',
    status: normalizeTaskStatus(t.status),
    priority: normalizeTaskPriority(t.priority),
    assignee: assignees[0],
    assignees,
    assignedBy: t.assignedBy || '',
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : '',
    projectId: t.projectId || t.project?.id,
    projectName: t.project?.name,
    projectHeadId: projectHead?.id || resolveEmployeeSelectId(t.projectHeadId, employees) || undefined,
    projectHeadName: projectHead?.name,
    isSelfTask: Boolean(t.isSelfTask),
    workDonePercent: typeof t.workDonePercent === 'number' ? t.workDonePercent : 0,
    extraDescriptions: Array.isArray(t.extraDescriptions) ? t.extraDescriptions : [],
    reminderDates: Array.isArray(t.reminderDates) ? t.reminderDates : [],
    reminderWeekdays: Array.isArray(t.reminderWeekdays) ? t.reminderWeekdays as Weekday[] : [],
    scheduleType: normalizeScheduleType(t.scheduleType),
    scheduledDate: t.scheduledDate ? new Date(t.scheduledDate).toISOString() : undefined,
    scheduledWeekday: t.scheduledWeekday as Weekday | undefined,
    tags: Array.isArray(t.tags) ? t.tags : [],
    approvalStatus: t.status === 'DONE' || t.status === 'COMPLETED' ? 'Pending Approval' : 'Not Submitted',
    createdAt: t.createdAt,
  }
}

export function mapProjectFromApi(p: any, employees: { id: string; recordId?: string }[] = []) {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    projectHeadId: resolveEmployeeSelectId(p.projectHeadId, employees) || '',
    status: p.status || 'ACTIVE',
    taskCount: p._count?.tasks ?? 0,
    createdAt: p.createdAt,
  }
}

export function priorityToApi(priority: TaskPriority) {
  return priority.toUpperCase().replace(/-/g, '_')
}

export function scheduleTypeToApi(scheduleType: TaskScheduleType) {
  return scheduleType.toUpperCase()
}
