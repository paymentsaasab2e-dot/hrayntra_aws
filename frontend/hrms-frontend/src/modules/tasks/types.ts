export type TaskStatus = "todo" | "in_progress" | "blocked" | "completed"

export type TaskPriority = "low" | "less_urgent" | "medium" | "high" | "urgent"

export type TaskScheduleType = "none" | "specific_date" | "day_of_week"

export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN"

export type Project = {
  id: string
  name: string
  description?: string
  projectHeadId?: string
  status: "ACTIVE" | "ARCHIVED"
  taskCount?: number
  createdAt?: string
}

export type TaskAssignee = {
  id: string
  name: string
  avatarUrl?: string
}

export type Task = {
  id: string
  title: string
  description?: string
  remarks?: string
  status: TaskStatus
  priority: TaskPriority
  assignee: TaskAssignee
  assignees?: TaskAssignee[]
  assignedBy: string
  dueDate: string
  projectId?: string
  projectName?: string
  projectHeadId?: string
  projectHeadName?: string
  isSelfTask?: boolean
  workDonePercent?: number
  extraDescriptions?: { text: string; createdAt?: string }[]
  reminderDates?: string[]
  reminderWeekdays?: Weekday[]
  scheduleType?: TaskScheduleType
  scheduledDate?: string
  scheduledWeekday?: Weekday
  estimatedHours?: number
  timeLogged?: number
  tags?: string[]
  approvalStatus?: 'Not Submitted' | 'Pending Approval' | 'Approved' | 'Changes Requested'
  createdAt: string
  completedAt?: string
}

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'less_urgent', label: 'Less Urgent' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' },
]

export const WORK_DONE_OPTIONS = Array.from({ length: 11 }, (_, index) => index * 10)
