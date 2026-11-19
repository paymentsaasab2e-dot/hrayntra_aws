export type PerformanceCycle = 'monthly' | 'quarterly' | 'annual'

export interface TaskBreakdown {
  assigned: number
  completed: number
  onTime: number
  early: number
  lateCompleted: number
  overdueOpen: number
  completionRate: number
  onTimeRate: number
  earlyRate: number
  overduePenaltyRate: number
  avgCycleTimeDays: number
  avgDelayDays: number
  approvalPassRate: number
  projectCompletedRate: number
  urgentOverdueRate: number
}

export interface AttendanceBreakdown {
  workingDays: number
  presentDays: number
  lateDays: number
  absentDays: number
  rejectedPunches: number
  avgDurationMinutes: number
  attendanceRate: number
  punctualityRate: number
}

export interface LeaveBreakdown {
  totalRequests: number
  approvedDays: number
  rejectedCount: number
  pendingCount: number
  unplannedSickDays: number
  planningScore: number
  stabilityScore: number
}

export interface PerformanceBreakdown {
  task: TaskBreakdown
  attendance: AttendanceBreakdown
  leave: LeaveBreakdown
  weights: { task: number; attendance: number; leave: number; manager: number }
  cycleWindow: { start: string; end: string }
  provisionalScore: number
}

export interface PerformanceMetrics {
  taskScore: number
  attendanceScore: number
  leaveScore: number
  managerScore: number
  finalScore: number
  category: 'Needs Improvement' | 'Meets Expectations' | 'Exceeds Expectations' | 'Outstanding'
  breakdown?: PerformanceBreakdown
}

export interface EmployeeInsights {
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
}

export interface PerformanceReview {
  id: string
  employeeId: string
  cycle: string
  cycleType: PerformanceCycle
  metrics: PerformanceMetrics
  insights: EmployeeInsights
  selfAssessment?: {
    submittedAt: string
    rating: number
    comments: string
  }
  managerAssessment?: {
    submittedAt: string
    managerId: string
    rating: number
    feedback: string
  }
  status: 'Pending Self Review' | 'Pending Manager Review' | 'Completed'
}

export interface PerformanceAnalyticsSummary {
  employeeCount: number
  avgFinalScore: number
  avgOnTimeRate: number
  totalOverdueOpen: number
  atRiskCount: number
}
