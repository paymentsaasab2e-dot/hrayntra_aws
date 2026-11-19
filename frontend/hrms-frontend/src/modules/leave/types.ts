export type LeaveType = 'Casual' | 'Sick' | 'Earned' | 'Maternity' | 'Paternity' | 'Unpaid'
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Modification Requested' | 'Cancelled'

export type LeaveRequest = {
  id: string
  employeeId: string
  type: LeaveType
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  totalDays: number
  reason: string
  status: LeaveStatus
  approverId?: string
  remarks?: string
  createdAt: string
  updatedAt: string
}
