export type ApprovalType = 'Leave' | 'Remote Attendance' | 'WFH' | 'On-Duty' | 'Short Leave' | 'Regularization' | 'Task' | 'Expense' | 'Performance' | 'Org Site' | 'Exit' | 'Employee Change'

export interface ApprovalItem {
  id: string
  originalId: string
  type: ApprovalType
  employeeId: string
  createdAt: string
  status: string
  priority: 'High' | 'Medium' | 'Low'
  /** L1/L2/L3 hierarchy approval — act via API */
  approvalRequestId?: string
  approvalLevel?: { current: number; max: number }
  employeeName?: string
  details: {
    title: string
    description: string
    meta?: Record<string, any>
  }
}
