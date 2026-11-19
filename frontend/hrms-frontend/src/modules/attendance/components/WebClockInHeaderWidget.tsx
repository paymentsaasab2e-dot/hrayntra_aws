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
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export function WebClockInHeaderWidget() {
  const {
    status,
    loading,
    actionLoading,
    workedSeconds,
    breakSeconds,
    handleClockIn,
    handleClockOut,
    handleEndBreak,
    handleStartBreak,
    onLeave,
    leaveType,
    isWeeklyOff,
    weeklyOffReason,
    isHoliday,
    holidayName,
    reminders,
  } = useWebClockIn()

  const [isModalOpen, setIsModalOpen] = React.useState(false)

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5 text-xs text-slate-400">
        <Clock className="size-3.5 animate-spin text-purple-500" />
        <span>Loading punch...</span>
      </div>
    )
  }

  const isActive = status?.isActive ?? false
  const isOnBreak = status?.onBreak ?? false

  return (
    <>
      <div className="flex items-center gap-2">
        {reminders?.outPunch && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-300 text-amber-900 text-[11px] font-bold animate-pulse cursor-pointer shadow-2xs"
            title={reminders.outPunch}
          >
            <AlertCircle className="size-3.5 text-amber-600" />
            <span>Clock Out Due</span>
          </button>
        )}
        {!isActive ? (
          onLeave ? (
            /* On Approved Leave Today */
            <div className="flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50/90 pl-3 pr-1.5 py-1 text-xs shadow-xs">
              <span className="size-2 rounded-full bg-sky-500" />
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 font-bold text-sky-900 hover:underline cursor-pointer"
                title="You are on approved leave today. Click for punch options."
              >
                <span>🌴 On Leave</span>
                {leaveType && <span className="text-[11px] font-medium opacity-80">({leaveType})</span>}
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="ml-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer"
                title="Punch anyway"
              >
                Punch
              </button>
            </div>
          ) : isHoliday ? (
            /* Public Holiday Today */
            <div className="flex items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50/90 pl-3 pr-1.5 py-1 text-xs shadow-xs">
              <span className="size-2 rounded-full bg-purple-500" />
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 font-bold text-purple-900 hover:underline cursor-pointer"
                title="Today is a public holiday. Click for punch options."
              >
                <span>🎉 Holiday</span>
                {holidayName && <span className="text-[11px] font-medium opacity-80">({holidayName})</span>}
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="ml-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer"
                title="Punch anyway"
              >
                Punch
              </button>
            </div>
          ) : isWeeklyOff ? (
            /* Weekly Off / Alternate Saturday */
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/90 pl-3 pr-1.5 py-1 text-xs shadow-xs">
              <span className="size-2 rounded-full bg-emerald-500" />
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 font-bold text-emerald-900 hover:underline cursor-pointer"
                title="Today is your scheduled weekly off. Click for punch options."
              >
                <span>🗓️ {weeklyOffReason || 'Weekly Off'}</span>
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="ml-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer"
                title="Punch anyway"
              >
                Punch
              </button>
            </div>
          ) : (
            /* Standard Clocked Out State: Clean Action Button */
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm shadow-emerald-700/20 hover:shadow-emerald-700/30 transition-all cursor-pointer"
              title="Open Web Clock-in"
            >
              <Play className="size-3.5 fill-current" />
              <span>Clock In</span>
            </button>
          )
        ) : isOnBreak ? (
          /* On Break State: Amber pill with live timer and quick resume */
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50/90 pl-3 pr-1.5 py-1 text-xs shadow-xs">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 font-bold text-amber-900 hover:underline cursor-pointer"
              title="Click for break and punch details"
            >
              <span>☕ Break:</span>
              <span className="font-mono">{formatSecondsToHms(breakSeconds)}</span>
            </button>
            <button
              onClick={() => handleEndBreak()}
              disabled={actionLoading}
              className="ml-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              title="End Break"
            >
              Resume
            </button>
          </div>
        ) : (
          /* Active Working State: Green pill with live running ticker and quick controls */
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/90 pl-3 pr-1.5 py-1 text-xs shadow-xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 font-bold text-emerald-900 hover:underline cursor-pointer"
              title="Click for full punch details"
            >
              <span className="hidden sm:inline">Working:</span>
              <span className="font-mono tracking-tight">{formatSecondsToHms(workedSeconds)}</span>
            </button>

            <div className="flex items-center gap-1 border-l border-emerald-200/80 pl-1.5">
              <button
                onClick={() => handleStartBreak('TEA')}
                disabled={actionLoading}
                className="rounded-lg p-1 text-slate-600 hover:text-amber-700 hover:bg-amber-100/80 transition-colors cursor-pointer"
                title="Quick Tea Break (15m)"
                aria-label="Tea Break"
              >
                <Coffee className="size-3.5" />
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                disabled={actionLoading}
                className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                title="Clock Out"
              >
                Clock Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal instance */}
      <WebClockInModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
