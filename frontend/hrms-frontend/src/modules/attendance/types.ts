export type AttendanceMode = 'office' | 'remote'
export type AttendanceStatus = 'Present' | 'Late' | 'Half-day' | 'Absent' | 'On Leave'
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected'
export type AttendanceApprovalStatus = 'Pending' | 'Approved' | 'Rejected'

export type AttendancePunchStatus = 'Accepted' | 'Rejected'

export type AttendanceRecord = {
  id: string
  employeeId: string
  date: string // YYYY-MM-DD local time string
  checkIn: string | null // ISO string
  checkOut: string | null // ISO string
  mode: AttendanceMode
  punchMode?: string
  status: AttendanceStatus
  location?: string
  hospitalName?: string
  lat?: number | null
  lng?: number | null
  distanceMeters?: number | null
  punchStatus?: AttendancePunchStatus
  isActive?: boolean
  punchInPhotoUrl?: string | null
  punchOutPhotoUrl?: string | null
  flags?: string[] // e.g. 'late', 'early_exit', 'override'
  approvalStatus?: AttendanceApprovalStatus
  approvalRemark?: string
  approvalUpdatedAt?: string
}

export type AttendanceRequestType = 'WFH' | 'ON_DUTY' | 'REGULARIZATION' | 'SHORT_LEAVE'

export interface AttendanceRequestItem {
  id: string
  tenantId?: string
  employeeId: string
  type: AttendanceRequestType
  startDate: string
  endDate: string
  reason: string
  location?: string
  inTime?: string
  outTime?: string
  shortLeaveType?: 'EARLY_EXIT' | 'LATE_ENTRY'
  shortLeaveHours?: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  appliedAt: string
  adminRemark?: string | null
  processedAt?: string | null
  processedBy?: string | null
  employee?: {
    id: string
    employeeId: string
    name: string
    department?: string
    designation?: string
  }
}

export type RemoteRequest = {
  id: string
  employeeId: string
  date: string
  purpose: string
  location: string
  status: RequestStatus
  createdAt: string
  type?: AttendanceRequestType
  startDate?: string
  endDate?: string
  reason?: string
  inTime?: string
  outTime?: string
  shortLeaveType?: 'EARLY_EXIT' | 'LATE_ENTRY'
  shortLeaveHours?: number
  adminRemark?: string | null
}

