import { AttendanceRecord, RemoteRequest } from '@/modules/attendance/types'
import { LeaveRequest } from '@/modules/leave/types'

export type DayStatusCode = 'P' | 'WFH' | 'OD' | 'A' | 'L' | 'WO' | 'H' | 'Lt' | 'HD' | '-'

export type MonthlyDayCell = {
  day: number
  dateStr: string
  weekday: string
  shift: string
  inTime: string
  outTime: string
  lateBy: string
  earlyBy: string
  totalOt: string
  duration: string
  statusCode: DayStatusCode
  statusLabel: string
  isWeekend: boolean
}

export type MonthlyAttendanceSummary = {
  totalPresent: number
  totalWfh: number
  totalOd: number
  totalAbsent: number
  totalLeave: number
  totalWeeklyOff: number
  totalWeeklyOffPresent: number
  totalDurationMinutes: number
  totalOtMinutes: number
  totalLateMinutes: number
  totalEarlyMinutes: number
  payableDays: number
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${pad2(m)}`
}

function formatTimeShort(iso: string | null | undefined) {
  if (!iso) return '00:00'
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function isWeekend(date: Date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function isDateOnLeave(dateStr: string, leaves: LeaveRequest[]) {
  return leaves.some(
    (l) =>
      l.status === 'Approved' &&
      dateStr >= l.startDate.slice(0, 10) &&
      dateStr <= l.endDate.slice(0, 10)
  )
}

function isDateApprovedWfh(dateStr: string, requests?: RemoteRequest[]) {
  if (!requests) return false
  return requests.some((r) => {
    const isWfh = r.type === 'WFH' || (!r.type && r.location?.toLowerCase().includes('home'))
    if (!isWfh || r.status !== 'Approved') return false
    const sDate = r.startDate || r.date
    const eDate = r.endDate || sDate
    return dateStr >= sDate && dateStr <= eDate
  })
}

function isDateApprovedOd(dateStr: string, requests?: RemoteRequest[]) {
  if (!requests) return false
  return requests.some((r) => {
    if (r.type !== 'ON_DUTY' || r.status !== 'Approved') return false
    const sDate = r.startDate || r.date
    const eDate = r.endDate || sDate
    return dateStr >= sDate && dateStr <= eDate
  })
}

function durationMinutes(checkIn: string | null, checkOut: string | null, isActive?: boolean) {
  if (!checkIn) return 0
  const start = new Date(checkIn).getTime()
  const end = checkOut ? new Date(checkOut).getTime() : isActive ? Date.now() : start
  return Math.max(0, Math.floor((end - start) / 60000))
}

function statusFromRecord(
  record: AttendanceRecord | undefined,
  onLeave: boolean,
  onApprovedWfh: boolean,
  onApprovedOd: boolean,
  weekend: boolean
): {
  code: DayStatusCode
  label: string
} {
  // 1. Approved Leave
  if (onLeave) return { code: 'L', label: 'Leave' }

  // 2. Approved Work From Home (CORE RULE: Shows WFH, NOT Absent!)
  if (onApprovedWfh) {
    return { code: 'WFH', label: 'Work From Home (Approved)' }
  }

  // 3. Approved On-Duty
  if (onApprovedOd) {
    return { code: 'OD', label: 'On-Duty (Approved)' }
  }

  // 4. Punch record exists
  if (record) {
    const isRecordWfh =
      record.flags?.includes('wfh') ||
      record.mode === 'remote' ||
      record.location?.toLowerCase().includes('home') ||
      record.approvalRemark?.toLowerCase().includes('work from home')

    const isRecordOd =
      record.flags?.includes('on_duty') ||
      record.location?.toLowerCase().includes('on-duty')

    if (isRecordWfh && record.status !== 'Absent') {
      return { code: 'WFH', label: 'Work From Home' }
    }
    if (isRecordOd && record.status !== 'Absent') {
      return { code: 'OD', label: 'On-Duty' }
    }

    if (record.status === 'On Leave') return { code: 'L', label: 'Leave' }
    if (record.status === 'Absent') {
      return weekend ? { code: 'WO', label: 'Weekly Off' } : { code: 'A', label: 'Absent' }
    }
    if (record.status === 'Late') return { code: 'Lt', label: 'Late' }
    if (record.status === 'Half-day') return { code: 'HD', label: 'Half Day' }
    if (['Present', 'Late', 'Half-day'].includes(record.status)) {
      if (weekend) return { code: 'P', label: 'Present (WO)' }
      return { code: 'P', label: 'Present' }
    }
  }

  // 5. No punch
  if (weekend) return { code: 'WO', label: 'Weekly Off' }
  return { code: 'A', label: 'Absent' }
}

export function buildMonthlyAttendanceReport({
  year,
  month,
  records,
  leaves,
  remoteRequests = [],
  shiftLabel = 'general',
}: {
  year: number
  month: number
  records: AttendanceRecord[]
  leaves: LeaveRequest[]
  remoteRequests?: RemoteRequest[]
  shiftLabel?: string
}): { days: MonthlyDayCell[]; summary: MonthlyAttendanceSummary } {
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date().toLocaleDateString('en-CA')
  const recordByDate = new Map(records.map((r) => [r.date, r]))

  const summary: MonthlyAttendanceSummary = {
    totalPresent: 0,
    totalWfh: 0,
    totalOd: 0,
    totalAbsent: 0,
    totalLeave: 0,
    totalWeeklyOff: 0,
    totalWeeklyOffPresent: 0,
    totalDurationMinutes: 0,
    totalOtMinutes: 0,
    totalLateMinutes: 0,
    totalEarlyMinutes: 0,
    payableDays: 0,
  }

  const days: MonthlyDayCell[] = []

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${year}-${pad2(month)}-${pad2(day)}`
    const dateObj = new Date(`${dateStr}T12:00:00`)
    const weekend = isWeekend(dateObj)
    const record = recordByDate.get(dateStr)
    const onLeave = isDateOnLeave(dateStr, leaves)
    const onApprovedWfh = isDateApprovedWfh(dateStr, remoteRequests)
    const onApprovedOd = isDateApprovedOd(dateStr, remoteRequests)
    const isFuture = dateStr > today

    const { code, label } = isFuture
      ? { code: '-' as DayStatusCode, label: '—' }
      : statusFromRecord(record, onLeave, onApprovedWfh, onApprovedOd, weekend)

    const mins = record
      ? durationMinutes(record.checkIn, record.checkOut, record.isActive)
      : onApprovedWfh || onApprovedOd
      ? 540 // Standard 9 hrs for approved remote
      : 0
    const lateMins = record?.status === 'Late' ? 15 : 0

    if (!isFuture) {
      if (code === 'P' || code === 'Lt') {
        summary.totalPresent += 1
        if (weekend) summary.totalWeeklyOffPresent += 1
      } else if (code === 'HD') {
        summary.totalPresent += 0.5
      } else if (code === 'WFH') {
        // CORE RULE: Approved WFH adds to totalWfh & totalPresent, NEVER totalAbsent!
        summary.totalWfh += 1
        summary.totalPresent += 1
      } else if (code === 'OD') {
        summary.totalOd += 1
        summary.totalPresent += 1
      } else if (code === 'A') {
        summary.totalAbsent += 1
      } else if (code === 'L') {
        summary.totalLeave += 1
      } else if (code === 'WO') {
        summary.totalWeeklyOff += 1
      }

      summary.totalDurationMinutes += mins
      summary.totalLateMinutes += lateMins
    }

    days.push({
      day,
      dateStr,
      weekday: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
      shift: shiftLabel,
      inTime: record?.checkIn
        ? formatTimeShort(record.checkIn)
        : onApprovedWfh || onApprovedOd
        ? '09:30'
        : '00:00',
      outTime: record?.checkOut
        ? formatTimeShort(record.checkOut)
        : onApprovedWfh || onApprovedOd
        ? '18:30'
        : '00:00',
      lateBy: lateMins ? formatMinutes(lateMins) : '0:00',
      earlyBy: '0:00',
      totalOt: '0:00',
      duration: mins ? formatMinutes(mins) : '0:00',
      statusCode: code,
      statusLabel: label,
      isWeekend: weekend,
    })
  }

  summary.payableDays = summary.totalPresent + summary.totalLeave + summary.totalWeeklyOff

  return { days, summary }
}

export function monthYearFromInput(value: string) {
  const [y, m] = value.split('-').map(Number)
  return { year: y, month: m }
}

export function defaultMonthYear() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}
