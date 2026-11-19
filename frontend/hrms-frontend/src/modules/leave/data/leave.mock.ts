import { LeaveRequest } from '../types'

export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: 'LV-001',
    employeeId: 'EMP-001',
    type: 'Sick',
    startDate: '2026-05-11',
    endDate: '2026-05-12',
    totalDays: 2,
    reason: 'Viral fever and prescribed rest',
    status: 'Approved',
    approverId: 'EMP-000',
    remarks: 'Get well soon',
    createdAt: '2026-05-09T09:00:00.000Z',
    updatedAt: '2026-05-10T10:00:00.000Z'
  },
  {
    id: 'LV-002',
    employeeId: 'EMP-003',
    type: 'Casual',
    startDate: '2026-05-26',
    endDate: '2026-05-27',
    totalDays: 2,
    reason: 'Family function out of town',
    status: 'Pending',
    createdAt: '2026-05-21T09:00:00.000Z',
    updatedAt: '2026-05-21T09:00:00.000Z'
  },
  {
    id: 'LV-003',
    employeeId: 'EMP-004',
    type: 'Earned',
    startDate: '2026-06-05',
    endDate: '2026-06-09',
    totalDays: 5,
    reason: 'Annual vacation',
    status: 'Pending',
    createdAt: '2026-05-21T08:00:00.000Z',
    updatedAt: '2026-05-21T08:00:00.000Z'
  }
]
