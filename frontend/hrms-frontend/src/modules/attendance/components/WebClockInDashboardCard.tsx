"use client"

import * as React from 'react'
import {
  useWebClockIn,
  formatSecondsToHms,
} from '../hooks/useWebClockIn'
import { WebClockInModal } from './WebClockInModal'
import {
  Clock,
  Play,
  Square,
  Coffee,
  MapPin,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Maximize2,
  Calendar,
  Utensils,
} from 'lucide-react'

export function WebClockInDashboardCard() {
  const {
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
    clearAlerts,
  } = useWebClockIn()

  const [currentTime, setCurrentTime] = React.useState<string>('')
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const isActive = status?.isActive ?? false
  const isOnBreak = status?.onBreak ?? false
  const policy = status?.webPunchPolicy

  // Shift target: assume 8 hours (28800 seconds) standard or from shift
  const targetSeconds = 8 * 3600
  const progressPercent = Math.min(100, Math.round((workedSeconds / targetSeconds) * 100))

  return (
    <>
      <div className="w-full shrink-0 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-indigo-50/25 to-purple-50/30 p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 size-36 rounded-full bg-purple-200/25 blur-2xl pointer-events-none" />

        {/* Alerts Banner if present */}
        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={clearAlerts}
              className="text-red-700 hover:underline font-semibold cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={clearAlerts}
              className="text-emerald-700 hover:underline font-semibold cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Missing Punch & Auto-Checkout Warning Banner */}
        {(status?.reminders?.outPunch || status?.reminders?.inPunch) && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-6 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="size-4 text-amber-700 shrink-0 animate-pulse" />
              </div>
              <span className="font-medium text-slate-800 truncate sm:whitespace-normal">
                {status.reminders.outPunch || status.reminders.inPunch}
              </span>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              {status.reminders.outPunch ? 'Clock Out' : 'Clock In'}
            </button>
          </div>
        )}

        {/* Main Executive Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Zone 1: Identity, Status & Shift */}
          <div className="flex items-center gap-3.5 min-w-[260px]">
            <div className="size-11 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center text-white shadow-sm shadow-indigo-600/20 shrink-0">
              <Laptop className="size-5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Web Clock-In
                </h3>

                {isOnBreak ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 px-2.5 py-0.5 text-[11px] font-bold border border-amber-200 shadow-2xs">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    On Break
                  </span>
                ) : isActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200 shadow-2xs">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Punch
                  </span>
                ) : status?.onLeave ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 text-sky-800 px-2.5 py-0.5 text-[11px] font-bold border border-sky-300 shadow-2xs">
                    <span className="size-1.5 rounded-full bg-sky-500" />
                    🌴 On Leave {status.leaveType ? `(${status.leaveType})` : ''}
                  </span>
                ) : status?.isHoliday ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-[11px] font-bold border border-purple-300 shadow-2xs">
                    <span className="size-1.5 rounded-full bg-purple-500" />
                    🎉 Holiday {status.holidayName ? `(${status.holidayName})` : ''}
                  </span>
                ) : status?.isWeeklyOff ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-300 shadow-2xs">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    🗓️ {status.weeklyOffReason || 'Weekly Off'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-[11px] font-semibold border border-slate-200">
                    <span className="size-1.5 rounded-full bg-slate-400" />
                    Pending Punch
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  {status?.shiftInfo?.name || 'General Shift'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-600 font-medium">
                  {status?.shiftInfo?.timings ||
                    (status?.shiftInfo?.startTime && status?.shiftInfo?.endTime
                      ? `${status.shiftInfo.startTime} – ${status.shiftInfo.endTime}`
                      : '09:30 – 18:30')}
                </span>
                {status?.shiftInfo?.isWeeklyOff && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                    Off Today
                  </span>
                )}
                {status?.quotaInfo?.enabled && (
                  <span
                    title={`Auto-checkouts used this month: ${status.quotaInfo.monthlyUsed} of ${status.quotaInfo.monthlyQuota} allowed before regularization.`}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                      status.quotaInfo.isExceeded
                        ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
                        : status.quotaInfo.monthlyUsed > 0
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    Auto-out: {status.quotaInfo.monthlyUsed}/{status.quotaInfo.monthlyQuota}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Zone 2: Worked Counter & Progress Bar */}
          <div className="flex-1 max-w-md rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-2xs flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Hours Worked
                </span>
                {isOnBreak && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                    Break: {formatSecondsToHms(breakSeconds)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-800">
                  {formatSecondsToHms(workedSeconds)}
                </span>
                <span className="text-[10px] text-slate-400">
                  / 8h 00m ({progressPercent}%)
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
              <div
                className={`h-full transition-all duration-500 ${
                  progressPercent >= 100
                    ? 'bg-emerald-500'
                    : isOnBreak
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, progressPercent))}%` }}
              />
            </div>
          </div>

          {/* Zone 3: Live Clock & Action Triggers */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            {/* Live Wall Clock */}
            <div className="text-right hidden sm:block pr-1">
              <div className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                <Clock className="size-3.5 text-indigo-600" />
                {currentTime || '--:--:--'}
              </div>
              <div className="text-[10px] text-slate-400">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>

            {/* Action Buttons */}
            {!isActive ? (
              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm shadow-emerald-700/20 hover:shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                <Play className="size-3.5 fill-current" />
                <span>{actionLoading ? 'Clocking In...' : 'Clock In Now'}</span>
              </button>
            ) : isOnBreak ? (
              <button
                onClick={handleEndBreak}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-sm shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-60"
              >
                <Coffee className="size-3.5" />
                <span>{actionLoading ? 'Resuming...' : 'End Break'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 shadow-2xs transition-colors cursor-pointer"
                  title="Take a Break"
                >
                  <Coffee className="size-3.5 text-amber-600" />
                  <span>Break...</span>
                </button>

                <button
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/20 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Square className="size-3.5 fill-current" />
                  <span>{actionLoading ? 'Clocking Out...' : 'Clock Out'}</span>
                </button>
              </div>
            )}

            {/* Expand Modal Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer"
              title="Open Full Attendance & GPS Policy Details"
            >
              <Maximize2 className="size-4" />
            </button>
          </div>

        </div>

        {/* Minimal Security Telemetry Line */}
        <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-slate-600">
              <MapPin className="size-3 text-indigo-500 shrink-0" />
              <span>GPS: </span>
              {geoCoords ? (
                <span className="text-emerald-700 font-semibold">
                  Accurate (±{Math.round(geoCoords.accuracy || 15)}m)
                </span>
              ) : (
                <span className="text-slate-400">Verifying...</span>
              )}
            </div>

            <div className="flex items-center gap-1 text-slate-600">
              <Wifi className="size-3 text-purple-500 shrink-0" />
              <span>Network: </span>
              <span className="text-slate-700 font-semibold">
                {policy?.webPunchValidation === 'ANYWHERE' ? 'Remote / WFH' : 'Office IP'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600">
            <ShieldCheck className="size-3 text-emerald-600 shrink-0" />
            <span>Mode: </span>
            <span className="font-mono font-bold text-indigo-700">WEB</span>
            <span className="text-slate-400">&rarr; Muster Verified</span>
          </div>
        </div>
      </div>

      <WebClockInModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
