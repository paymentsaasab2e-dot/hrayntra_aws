"use client"
import * as React from 'react'
import { SectionCard } from '@hryantra/ui'
import { AttendanceRecord } from '../types'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { useDataSync } from '@/shared/events'
import { ChevronLeft, ChevronRight, Home, Briefcase, Calendar, Palmtree } from 'lucide-react'

// Simple helper functions
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

interface AttendanceCalendarProps {
  records: AttendanceRecord[]
  employeeId?: string
}

export function AttendanceCalendar({ records, employeeId }: AttendanceCalendarProps) {
  const { remoteRequests, leaveRequests, activeEmployeeId } = useStore()
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [workWeekPattern, setWorkWeekPattern] = React.useState<string>('ALTERNATE_SAT_2ND_4TH')
  const [customDays, setCustomDays] = React.useState<number[]>([0, 6])
  const [holidays, setHolidays] = React.useState<Record<string, string>>({})
  
  const targetEmpId = employeeId || activeEmployeeId

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month) // 0-indexed, 0 = Sunday

  const loadRosterPolicy = React.useCallback(() => {
    api.leaves.getWorkWeekRoster({ year, month: month + 1 })
      .then((res) => {
        if (res?.success && res.data?.workWeek) {
          if (res.data.workWeek.pattern) setWorkWeekPattern(res.data.workWeek.pattern)
          if (Array.isArray(res.data.workWeek.customWeekOffDays)) setCustomDays(res.data.workWeek.customWeekOffDays)
        }
        if (res?.success && Array.isArray(res.data?.calendarDays)) {
          const hMap: Record<string, string> = {}
          res.data.calendarDays.forEach((d: any) => {
            if (d.isHoliday && d.holidayName) {
              hMap[d.dateStr] = d.holidayName
            }
          })
          setHolidays(hMap)
        }
      })
      .catch(() => {})
  }, [year, month])

  React.useEffect(() => {
    loadRosterPolicy()
  }, [loadRosterPolicy])

  // Cross-portal instant sync on leave, attendance, or roster updates
  useDataSync(['attendance', 'leave', 'roster'], () => {
    loadRosterPolicy()
  })

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  
  const getRecordForDate = (day: number) => {
    const safeStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return records.find(r => r.date === safeStr)
  }

  const getApprovedRemoteForDate = (day: number) => {
    const safeStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return remoteRequests.find(r => {
      if (r.status !== 'Approved') return false
      if (targetEmpId && r.employeeId !== targetEmpId) return false
      const sDate = r.startDate || r.date
      const eDate = r.endDate || sDate
      return safeStr >= sDate && safeStr <= eDate
    })
  }

  const getApprovedLeaveForDate = (day: number) => {
    const safeStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return leaveRequests.find(l => {
      const isApproved = l.status === 'Approved' || (l.status as string) === 'APPROVED'
      if (!isApproved) return false
      if (targetEmpId && l.employeeId !== targetEmpId) return false
      const sDate = (l.startDate || '').slice(0, 10)
      const eDate = (l.endDate || sDate).slice(0, 10)
      return safeStr >= sDate && safeStr <= eDate
    })
  }

  const getHolidayForDate = (day: number) => {
    const safeStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return holidays[safeStr] || null
  }

  const isDayWeekOff = (day: number) => {
    const d = new Date(year, month, day)
    const dayOfWeek = d.getDay()

    if (workWeekPattern === 'FIVE_DAY') {
      return dayOfWeek === 0 || dayOfWeek === 6
    }
    if (workWeekPattern === 'SIX_DAY') {
      return dayOfWeek === 0
    }
    if (workWeekPattern === 'ALTERNATE_SAT_2ND_4TH') {
      if (dayOfWeek === 0) return true
      if (dayOfWeek === 6) {
        const occ = Math.ceil(day / 7)
        return occ === 2 || occ === 4
      }
      return false
    }
    if (workWeekPattern === 'ALTERNATE_SAT_1ST_3RD') {
      if (dayOfWeek === 0) return true
      if (dayOfWeek === 6) {
        const occ = Math.ceil(day / 7)
        return occ === 1 || occ === 3
      }
      return false
    }
    if (workWeekPattern === 'CUSTOM') {
      return customDays.includes(dayOfWeek)
    }
    return dayOfWeek === 0
  }

  const getStatusColor = (
    rec?: AttendanceRecord,
    approvedRemote?: ReturnType<typeof getApprovedRemoteForDate>,
    approvedLeave?: ReturnType<typeof getApprovedLeaveForDate>,
    holidayName?: string | null,
    isOff?: boolean,
    isPast?: boolean
  ) => {
    // 1. Approved Leave (Never absent!)
    if (approvedLeave) {
      return 'bg-sky-50/90 border-sky-300 text-sky-900 shadow-xs'
    }

    // 2. Public Holiday (Never absent!)
    if (holidayName) {
      return 'bg-purple-50/90 border-purple-300 text-purple-900 shadow-xs'
    }

    // 3. Approved WFH (never absent!)
    const isWfh =
      approvedRemote?.type === 'WFH' ||
      (!approvedRemote?.type && approvedRemote?.location?.toLowerCase().includes('home')) ||
      rec?.flags?.includes('wfh') ||
      rec?.mode === 'remote' ||
      rec?.location?.toLowerCase().includes('home')
    if (isWfh) {
      return 'bg-cyan-50/90 border-cyan-300 text-cyan-900 shadow-xs'
    }

    // 4. Approved On-Duty (never absent!)
    const isOd =
      approvedRemote?.type === 'ON_DUTY' ||
      rec?.flags?.includes('on_duty') ||
      rec?.location?.toLowerCase().includes('on-duty')
    if (isOd) {
      return 'bg-indigo-50/90 border-indigo-300 text-indigo-900 shadow-xs'
    }

    // 5. Punch record
    if (rec) {
      if (rec.status === 'Present') return 'bg-ds-success-light border-ds-success/30 text-ds-success'
      if (rec.status === 'Late') return 'bg-amber-100 border-amber-300 text-amber-700'
      if (rec.status === 'Absent') return 'bg-ds-danger-light border-ds-danger/30 text-ds-danger'
      if (rec.status === 'Half-day') return 'bg-orange-100 border-orange-300 text-orange-700'
      return 'bg-white'
    }

    // 6. Weekly Off
    if (isOff) {
      return 'bg-emerald-50/60 border-emerald-200/80 text-emerald-800'
    }

    // 7. Past Absent
    if (isPast) {
      return 'bg-rose-50/50 border-rose-200 text-rose-700'
    }

    return 'bg-white border-ds-neutral-200 text-ds-neutral-400'
  }

  return (
    <SectionCard title="Attendance Calendar">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-ds-body font-bold text-ds-brand-navy">{monthName}</h3>
          <p className="text-[11px] text-ds-neutral-500">
            Work Week: {workWeekPattern === 'ALTERNATE_SAT_2ND_4TH'
              ? 'Alternate Sat (2nd & 4th) Off'
              : workWeekPattern === 'FIVE_DAY'
              ? '5-Day (Sat & Sun Off)'
              : workWeekPattern === 'SIX_DAY'
              ? '6-Day (Sun Only Off)'
              : 'Custom Roster'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-1 hover:bg-ds-neutral-100 rounded text-ds-neutral-500"><ChevronLeft className="size-5" /></button>
          <button onClick={nextMonth} className="p-1 hover:bg-ds-neutral-100 rounded text-ds-neutral-500"><ChevronRight className="size-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-ds-caption font-bold text-ds-neutral-500 py-2 uppercase tracking-wide">
            {d}
          </div>
        ))}
        
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2 h-16 rounded-md bg-transparent" />
        ))}
        
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const rec = getRecordForDate(day)
          const approvedRemote = getApprovedRemoteForDate(day)
          const approvedLeave = getApprovedLeaveForDate(day)
          const holidayName = getHolidayForDate(day)
          const safeStr = `${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isOff = isDayWeekOff(day)
          const isPast = new Date(safeStr) < new Date(new Date().toDateString())
          const colorClass = getStatusColor(rec, approvedRemote, approvedLeave, holidayName, isOff, isPast)

          const isWfh =
            approvedRemote?.type === 'WFH' ||
            (!approvedRemote?.type && approvedRemote?.location?.toLowerCase().includes('home')) ||
            rec?.flags?.includes('wfh') ||
            rec?.mode === 'remote' ||
            rec?.location?.toLowerCase().includes('home')

          const isOd =
            approvedRemote?.type === 'ON_DUTY' ||
            rec?.flags?.includes('on_duty') ||
            rec?.location?.toLowerCase().includes('on-duty')
          
          return (
            <div key={day} className={`p-2 h-[80px] rounded-lg border flex flex-col justify-between transition-all ${colorClass}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold opacity-80">{day}</span>
                {approvedLeave ? (
                  <span className="text-[9px] font-bold px-1 rounded bg-sky-200 text-sky-950 border border-sky-300">
                    LEAVE
                  </span>
                ) : holidayName ? (
                  <span className="text-[9px] font-bold px-1 rounded bg-purple-200 text-purple-950 border border-purple-300">
                    HOL
                  </span>
                ) : isOff && !rec && !approvedRemote ? (
                  <span className="text-[9px] font-bold px-1 rounded bg-emerald-100 text-emerald-800">
                    WO
                  </span>
                ) : isWfh ? (
                  <span className="text-[9px] font-bold px-1 rounded bg-cyan-200 text-cyan-900 border border-cyan-300">
                    WFH
                  </span>
                ) : isOd ? (
                  <span className="text-[9px] font-bold px-1 rounded bg-indigo-200 text-indigo-900 border border-indigo-300">
                    OD
                  </span>
                ) : null}
              </div>

              {approvedLeave ? (
                <span className="text-[10px] font-bold text-sky-900 line-clamp-1 flex items-center gap-1">
                  <span>🌴</span>
                  <span>Leave ({approvedLeave.type})</span>
                </span>
              ) : holidayName ? (
                <span className="text-[10px] font-bold text-purple-900 line-clamp-1 flex items-center gap-1">
                  <span>🎉</span>
                  <span>{holidayName}</span>
                </span>
              ) : isWfh ? (
                <span className="text-[10px] font-bold text-cyan-900 line-clamp-1 flex items-center gap-1">
                  <Home className="size-3 shrink-0 text-cyan-700" />
                  Work From Home
                </span>
              ) : isOd ? (
                <span className="text-[10px] font-bold text-indigo-900 line-clamp-1 flex items-center gap-1">
                  <Briefcase className="size-3 shrink-0 text-indigo-700" />
                  On-Duty
                </span>
              ) : rec ? (
                <span className="text-[10px] font-bold uppercase tracking-tight line-clamp-1">
                  {rec.status} {isOff ? '(WO)' : ''}
                </span>
              ) : isOff ? (
                <span className="text-[10px] font-bold text-emerald-800 line-clamp-1">
                  Weekly Off
                </span>
              ) : isPast ? (
                <span className="text-[10px] font-bold uppercase tracking-tight text-ds-danger line-clamp-1 opacity-80">
                  Absent
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
