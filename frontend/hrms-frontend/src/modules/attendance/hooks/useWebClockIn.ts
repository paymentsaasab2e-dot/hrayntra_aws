"use client"

import * as React from 'react'
import { api } from '@/shared/api'
import { getCurrentPosition, GeoCoords } from '@/shared/geolocation'
import { useStore } from '@/store/StoreProvider'
import { notifyDataChanged, useDataSync } from '@/shared/events'

export interface BreakRecord {
  id: string
  employeeId: string
  dateStr: string
  type: string
  startTime: string
  endTime: string | null
  durationMinutes: number
}

export interface TodayAttendanceStatus {
  date: string
  employeeId: string
  isActive: boolean
  activeAttendanceId?: string
  checkInTime?: string
  checkOutTime?: string
  status: string
  punchMode?: string
  totalWorkedSeconds: number
  onBreak: boolean
  currentBreak: {
    id: string
    type: string
    startTime: string
    elapsedSeconds: number
  } | null
  todayBreaks: BreakRecord[]
  totalBreakMinutes: number
  onLeave?: boolean
  leaveType?: string | null
  isWeeklyOff?: boolean
  weeklyOffReason?: string | null
  isHoliday?: boolean
  holidayName?: string | null
  shiftInfo?: {
    id?: string
    code?: string
    name?: string
    timings?: string
    startTime?: string
    endTime?: string
    graceMinutes?: number
    isWeeklyOff?: boolean
  }
  quotaInfo?: {
    enabled: boolean
    monthlyQuota: number
    monthlyUsed: number
    remainingQuota: number
    isExceeded: boolean
    penaltyPolicy: string
  }
  reminders?: {
    inPunch?: string | null
    outPunch?: string | null
  }
  assignedLocation?: {
    id: string
    name: string
    lat: number
    lng: number
    radiusMeters: number
  } | null
  webPunchPolicy?: {
    allowWebPunch: boolean
    webPunchValidation: 'ANYWHERE' | 'GPS_ONLY' | 'IP_ONLY' | 'BOTH'
    officeIpAllowlist: string[]
    maxLocationAccuracyMeters: number
    allowedDepartments: string[]
  }
}

export function formatSecondsToHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function useWebClockIn() {
  const { activeEmployeeId } = useStore()
  const [status, setStatus] = React.useState<TodayAttendanceStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  // Running tickers
  const [workedSeconds, setWorkedSeconds] = React.useState(0)
  const [breakSeconds, setBreakSeconds] = React.useState(0)

  // Geolocation state
  const [geoCoords, setGeoCoords] = React.useState<GeoCoords | null>(null)
  const [geoError, setGeoError] = React.useState<string | null>(null)
  const [detectingLocation, setDetectingLocation] = React.useState(false)

  // Fetch status from backend
  const fetchStatus = React.useCallback(async (empId?: string) => {
    try {
      const targetId = empId || activeEmployeeId
      const res = await api.attendance.getTodayStatus(targetId)
      if (res && res.success) {
        setStatus(res)
        setWorkedSeconds(res.totalWorkedSeconds || 0)
        if (res.currentBreak) {
          setBreakSeconds(res.currentBreak.elapsedSeconds || 0)
        } else {
          setBreakSeconds(0)
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch today attendance status:', err?.message)
    } finally {
      setLoading(false)
    }
  }, [activeEmployeeId])

  // Initial fetch and auto-refresh every 60s
  React.useEffect(() => {
    fetchStatus()
    const interval = setInterval(() => fetchStatus(), 60_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Instant reactive sync across all portals on leave, attendance, or roster updates
  useDataSync(['attendance', 'leave', 'roster'], () => {
    fetchStatus()
  })

  // Live timer tick every 1000ms
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!status) return

      if (status.isActive && !status.onBreak) {
        setWorkedSeconds(prev => prev + 1)
      } else if (status.onBreak) {
        setBreakSeconds(prev => prev + 1)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [status])

  // Capture Geolocation
  const refreshLocation = React.useCallback(async () => {
    setDetectingLocation(true)
    setGeoError(null)
    try {
      const coords = await getCurrentPosition()
      setGeoCoords(coords)
      return coords
    } catch (err: any) {
      const msg = err.message || 'Unable to retrieve location'
      setGeoError(msg)
      return null
    } finally {
      setDetectingLocation(false)
    }
  }, [])

  // Auto-detect location once on mount
  React.useEffect(() => {
    refreshLocation()
  }, [refreshLocation])

  // Clock In
  const handleClockIn = async () => {
    setActionLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      let coords = geoCoords
      if (!coords) {
        coords = await refreshLocation()
      }

      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser'

      const res = await api.attendance.checkIn({
        employeeId: activeEmployeeId,
        lat: coords?.lat,
        lng: coords?.lng,
        accuracy: coords?.accuracy,
        punchMode: 'WEB',
        deviceInfo: userAgent,
        browser: userAgent,
      })

      if (res && res.success) {
        setSuccessMessage('Clocked in successfully!')
        await fetchStatus()
        notifyDataChanged('attendance', { employeeId: activeEmployeeId, action: 'CLOCK_IN' })
      } else {
        throw new Error(res?.message || 'Clock-in failed')
      }
    } catch (err: any) {
      const msg = err?.message || 'Clock-in failed. Please verify office network or GPS.'
      setError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // Clock Out
  const handleClockOut = async () => {
    if (!status?.activeAttendanceId) {
      setError('No active attendance session found to clock out from.')
      return
    }

    setActionLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      let coords = geoCoords
      if (!coords) {
        coords = await refreshLocation()
      }

      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser'

      const res = await api.attendance.checkOut(status.activeAttendanceId, {
        lat: coords?.lat,
        lng: coords?.lng,
        accuracy: coords?.accuracy,
        punchMode: 'WEB',
        deviceInfo: userAgent,
        browser: userAgent,
      })

      if (res && res.success) {
        setSuccessMessage('Clocked out successfully!')
        await fetchStatus()
        notifyDataChanged('attendance', { employeeId: activeEmployeeId, action: 'CLOCK_OUT' })
      } else {
        throw new Error(res?.message || 'Clock-out failed')
      }
    } catch (err: any) {
      const msg = err?.message || 'Clock-out failed.'
      setError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // Start Break
  const handleStartBreak = async (breakType: string = 'TEA') => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await api.attendance.startBreak({
        breakType,
        employeeId: activeEmployeeId,
      })
      if (res && res.success) {
        setSuccessMessage(`Started ${breakType} break`)
        await fetchStatus()
        notifyDataChanged('attendance', { employeeId: activeEmployeeId, action: 'START_BREAK' })
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to start break')
    } finally {
      setActionLoading(false)
    }
  }

  // End Break
  const handleEndBreak = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await api.attendance.endBreak({
        employeeId: activeEmployeeId,
      })
      if (res && res.success) {
        setSuccessMessage('Break ended. Welcome back to work!')
        await fetchStatus()
        notifyDataChanged('attendance', { employeeId: activeEmployeeId, action: 'END_BREAK' })
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to end break')
    } finally {
      setActionLoading(false)
    }
  }

  return {
    status,
    loading,
    actionLoading,
    error,
    successMessage,
    workedSeconds,
    breakSeconds,
    geoCoords,
    geoError,
    detectingLocation,
    refreshLocation,
    handleClockIn,
    handleClockOut,
    handleStartBreak,
    handleEndBreak,
    fetchStatus,
    onLeave: Boolean(status?.onLeave),
    leaveType: status?.leaveType || null,
    isWeeklyOff: Boolean(status?.isWeeklyOff),
    weeklyOffReason: status?.weeklyOffReason || null,
    isHoliday: Boolean(status?.isHoliday),
    holidayName: status?.holidayName || null,
    shiftInfo: status?.shiftInfo,
    quotaInfo: status?.quotaInfo,
    reminders: status?.reminders,
    activeReminder: status?.reminders?.outPunch || status?.reminders?.inPunch || null,
    clearAlerts: () => {
      setError(null)
      setSuccessMessage(null)
    },
  }
}
