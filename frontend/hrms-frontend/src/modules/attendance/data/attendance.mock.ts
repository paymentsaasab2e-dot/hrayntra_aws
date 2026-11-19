import { AttendanceRecord, RemoteRequest } from '../types'

export const mockAttendanceRecords: AttendanceRecord[] = [
  {
    id: "ATT-MOCK-1",
    employeeId: "EMP-001",
    date: "2026-05-20",
    checkIn: "2026-05-20T08:45:00.000Z",
    checkOut: "2026-05-20T17:15:00.000Z",
    mode: "office",
    status: "Present",
    flags: []
  },
  {
    id: "ATT-MOCK-2",
    employeeId: "EMP-001",
    date: "2026-05-19",
    checkIn: "2026-05-19T08:45:00.000Z",
    checkOut: "2026-05-19T17:15:00.000Z",
    mode: "office",
    status: "Present",
    flags: []
  },
  {
    id: "ATT-MOCK-3",
    employeeId: "EMP-001",
    date: "2026-05-18",
    checkIn: "2026-05-18T08:45:00.000Z",
    checkOut: "2026-05-18T17:15:00.000Z",
    mode: "office",
    status: "Present",
    flags: []
  },
  {
    id: "ATT-MOCK-4",
    employeeId: "EMP-001",
    date: "2026-05-15",
    checkIn: "2026-05-15T09:30:00.000Z",
    checkOut: "2026-05-15T17:15:00.000Z",
    mode: "office",
    status: "Late",
    flags: ["late"]
  },
  {
    id: "ATT-MOCK-5",
    employeeId: "EMP-001",
    date: "2026-05-14",
    checkIn: "2026-05-14T08:45:00.000Z",
    checkOut: "2026-05-14T17:15:00.000Z",
    mode: "remote",
    status: "Present",
    flags: []
  }
]

export const mockRemoteRequests: RemoteRequest[] = [
  {
    id: 'REQ-001',
    employeeId: 'EMP-002',
    date: '2026-05-22',
    purpose: 'Client Site Visit',
    location: 'Acme Corp HQ',
    status: 'Pending',
    createdAt: '2026-05-21T09:00:00.000Z'
  },
  {
    id: 'REQ-002',
    employeeId: 'EMP-001',
    date: '2026-05-19',
    purpose: 'Working from home due to repairs',
    location: 'Home',
    status: 'Approved',
    createdAt: '2026-05-18T09:00:00.000Z'
  }
]
