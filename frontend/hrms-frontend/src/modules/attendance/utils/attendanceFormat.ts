import { AttendanceRecord } from '../types'

export function formatPunchTime(iso: string | null | undefined) {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function formatDisplayDate(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatShift(checkIn: string | null | undefined) {
  if (!checkIn) return '--'
  const hour = new Date(checkIn).getHours()
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

export function formatDuration(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  isActive?: boolean
) {
  if (!checkIn) return '--'
  const start = new Date(checkIn).getTime()
  const end = checkOut ? new Date(checkOut).getTime() : isActive ? Date.now() : null
  if (end == null) return '--'
  const totalMinutes = Math.max(0, Math.floor((end - start) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export function punchSummary(record: AttendanceRecord) {
  if (record.punchStatus === 'Rejected') return 'Rejected'
  if (record.isActive) return 'Punched In'
  if (record.checkIn && record.checkOut) return 'IN / OUT'
  if (record.checkIn) return 'IN'
  return '--'
}

export function rowStatusLabel(record: AttendanceRecord) {
  if (record.punchStatus === 'Rejected') return 'Rejected'
  if (record.isActive) return 'Active'
  if (record.approvalStatus === 'Pending') return 'Pending'
  if (record.punchStatus === 'Accepted') return 'Accepted'
  return record.status
}

export function isInDateRange(
  dateStr: string,
  range: 'all' | 'today' | 'week' | 'month',
  customDate?: string
) {
  if (customDate) return dateStr === customDate

  const recordDate = new Date(`${dateStr}T12:00:00`)
  const now = new Date()
  const today = now.toLocaleDateString('en-CA')

  if (range === 'today') return dateStr === today
  if (range === 'all') return true

  const start = new Date(now)
  if (range === 'week') {
    start.setDate(now.getDate() - 7)
  } else {
    start.setMonth(now.getMonth() - 1)
  }
  start.setHours(0, 0, 0, 0)

  return recordDate >= start
}
