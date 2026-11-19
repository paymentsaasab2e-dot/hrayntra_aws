import { PerformanceReview } from '../types'

export const mockPerformanceReviews: PerformanceReview[] = [
  {
    id: 'PR-101',
    employeeId: 'EMP-001',
    cycle: '2026-Q1',
    cycleType: 'quarterly',
    metrics: {
      taskScore: 85,
      attendanceScore: 92,
      leaveScore: 88,
      managerScore: 90,
      finalScore: 88,
      category: 'Exceeds Expectations'
    },
    insights: {
      strengths: ['High task completion rate', 'Excellent attendance'],
      weaknesses: ['Minor delays in complex tasks'],
      recommendations: ['Take on more leadership roles', 'Focus on cross-team collaboration']
    },
    selfAssessment: {
      submittedAt: '2026-03-25T10:00:00Z',
      rating: 4,
      comments: 'I feel I have done well this quarter, specially in delivering the new features on time.'
    },
    managerAssessment: {
      submittedAt: '2026-03-28T14:30:00Z',
      managerId: 'EMP-000',
      rating: 4,
      feedback: 'Great job this quarter. Keep up the good work and focus on mentoring juniors.'
    },
    status: 'Completed'
  },
  {
    id: 'PR-102',
    employeeId: 'EMP-002',
    cycle: '2026-Q1',
    cycleType: 'quarterly',
    metrics: {
      taskScore: 60,
      attendanceScore: 75,
      leaveScore: 65,
      managerScore: 70,
      finalScore: 65,
      category: 'Needs Improvement'
    },
    insights: {
      strengths: ['Good communication skills'],
      weaknesses: ['Frequent late logins', 'Several overdue tasks'],
      recommendations: ['Improve attendance punctuality', 'Better time management for tasks']
    },
    status: 'Pending Self Review'
  }
]
