"use client"

import * as React from 'react'
import {
  useWebClockIn,
  formatSecondsToHms,
} from '../hooks/useWebClockIn'
import {
  Clock,
  Play,
  Square,
  Coffee,
  MapPin,
  Wifi,
  ShieldCheck,
  AlertCircle,
  X,
  RefreshCw,
  CheckCircle2,
  Laptop,
  Timer,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  Utensils,
  HeartPulse,
  UserCheck,
} from 'lucide-react'

interface WebClockInModalProps {
  isOpen: boolean
  onClose: () => void
}

interface BreakDefinition {
  type: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  durationMinutes: number
  description: string
}

const BREAK_DEFINITIONS: BreakDefinition[] = [
  {
    type: 'TEA',
    label: 'Tea & Coffee Break',
    icon: Coffee,
    iconBg: 'bg-amber-100 border-amber-200',
    iconColor: 'text-amber-700',
    durationMinutes: 15,
    description: 'Quick refreshment & caffeine recharge',
  },
  {
    type: 'LUNCH',
    label: 'Lunch & Meal Break',
    icon: Utensils,
    iconBg: 'bg-orange-100 border-orange-200',
    iconColor: 'text-orange-700',
    durationMinutes: 45,
    description: 'Midday meal & rest time',
  },
  {
    type: 'WELLNESS',
    label: 'Wellness & Stretch Break',
    icon: HeartPulse,
    iconBg: 'bg-emerald-100 border-emerald-200',
    iconColor: 'text-emerald-700',
    durationMinutes: 10,
    description: 'Desk stretch, eye rest & wellness',
  },
  {
    type: 'PERSONAL',
    label: 'Personal & Bio Break',
    icon: UserCheck,
    iconBg: 'bg-indigo-100 border-indigo-200',
    iconColor: 'text-indigo-700',
    durationMinutes: 20,
    description: 'Personal errand or phone call',
  },
]

const getBreakDefinition = (type?: string | null): BreakDefinition => {
  if (!type) return BREAK_DEFINITIONS[0]
  const upper = type.toUpperCase()
  if (upper === 'TEA' || upper === 'COFFEE') return BREAK_DEFINITIONS[0]
  if (upper === 'LUNCH' || upper === 'MEAL') return BREAK_DEFINITIONS[1]
  if (upper === 'WELLNESS' || upper === 'STRETCH' || upper === 'SMOKE') return BREAK_DEFINITIONS[2]
  if (upper === 'PERSONAL' || upper === 'BIO') return BREAK_DEFINITIONS[3]
  return BREAK_DEFINITIONS[0]
}

export function WebClockInModal({ isOpen, onClose }: WebClockInModalProps) {
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
  const [isBreakConfirmOpen, setIsBreakConfirmOpen] = React.useState<boolean>(false)
  const [selectedBreak, setSelectedBreak] = React.useState<BreakDefinition>(BREAK_DEFINITIONS[0])
  const [breakNote, setBreakNote] = React.useState<string>('')

  // Real-time wall clock
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

  if (!isOpen) return null

  const isActive = status?.isActive ?? false
  const isOnBreak = status?.onBreak ?? false
  const policy = status?.webPunchPolicy

  // Active break limits
  const currentBreakType = status?.currentBreak?.type || 'TEA'
  const matchedBreakDef = getBreakDefinition(currentBreakType)
  const AllowedBreakIcon = matchedBreakDef.icon
  const allowedBreakSeconds = (matchedBreakDef.durationMinutes || 15) * 60
  const breakOverdue = breakSeconds > allowedBreakSeconds
  const breakProgressPercent = Math.min(100, Math.round((breakSeconds / allowedBreakSeconds) * 100))

  const onConfirmStartBreak = async () => {
    await handleStartBreak(selectedBreak.type)
    setIsBreakConfirmOpen(false)
    setBreakNote('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Header */}
        <div className={`p-6 text-white shrink-0 transition-colors duration-300 ${
          isOnBreak 
            ? 'bg-gradient-to-r from-amber-900 via-orange-950 to-stone-900' 
            : 'bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`size-11 rounded-xl flex items-center justify-center border shadow-inner ${
                isOnBreak
                  ? 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                  : 'bg-white/10 border-white/20 text-purple-300'
              }`}>
                {isOnBreak ? <Coffee className="size-6 animate-pulse" /> : <Laptop className="size-6" />}
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  {isOnBreak ? 'Break In Progress' : 'Web Clock-in & Attendance'}
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isOnBreak
                      ? 'bg-amber-500/30 text-amber-200 border-amber-400/40'
                      : 'bg-purple-500/30 text-purple-200 border-purple-400/30'
                  }`}>
                    {isOnBreak ? 'Paused' : 'Desktop Punch'}
                  </span>
                </h2>
                <p className="text-xs text-white/80">
                  {isOnBreak
                    ? 'Take your time. Your daily work timer is paused.'
                    : 'Punch your daily attendance directly from your browser'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Real-time Digital Clock & Status Banner */}
          <div className="mt-4 rounded-xl bg-white/10 backdrop-blur-md p-3.5 border border-white/10 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Current Wall Clock
              </div>
              <div className="text-2xl font-mono font-bold tracking-tight text-white">
                {currentTime || '--:--:--'}
              </div>
              <div className="text-[11px] text-white/70">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Assigned Shift
              </div>
              <div className="text-sm font-bold text-white">
                {status?.shiftInfo?.name || 'General Shift'}
              </div>
              <div className="text-xs text-white/70 font-mono">
                {status?.shiftInfo?.startTime && status?.shiftInfo?.endTime
                  ? `${status.shiftInfo.startTime} – ${status.shiftInfo.endTime}`
                  : '09:30 – 18:30'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Alerts */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-900">Punch Denied</div>
                  <div className="text-xs mt-0.5 text-red-700">{error}</div>
                </div>
              </div>
              <button
                onClick={clearAlerts}
                className="text-red-600 hover:text-red-900 text-xs font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-start justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-900">Success</div>
                  <div className="text-xs mt-0.5 text-emerald-700">{successMessage}</div>
                </div>
              </div>
              <button
                onClick={clearAlerts}
                className="text-emerald-600 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* =========================================================================
              VIEW 1: ON BREAK DEDICATED POPUP / SCREEN
             ========================================================================= */}
          {isOnBreak ? (
            <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50/60 to-amber-100/40 p-6 shadow-md shadow-amber-900/5 space-y-5 text-center">
              <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-600/30">
                <AllowedBreakIcon className="size-8" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200 text-amber-950 px-3 py-0.5 text-xs font-bold uppercase tracking-wider">
                  <span className="size-2 rounded-full bg-amber-600 animate-ping" />
                  Currently On {matchedBreakDef.label}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-2">
                  Take a breath & recharge
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1">
                  Your work hours are currently paused. Click below when you are ready to resume work.
                </p>
              </div>

              {/* Large Break Timer Display */}
              <div className="rounded-xl border border-amber-200 bg-white/90 p-4 shadow-inner max-w-md mx-auto">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                  Break Time Elapsed
                </div>
                <div className={`text-4xl sm:text-5xl font-mono font-bold tracking-tight ${
                  breakOverdue ? 'text-red-600' : 'text-amber-800'
                }`}>
                  {formatSecondsToHms(breakSeconds)}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                  <span>Allowance: {matchedBreakDef.durationMinutes} mins</span>
                  <span className={breakOverdue ? 'font-bold text-red-600' : 'text-slate-500'}>
                    {breakOverdue ? '⚠️ Overdue' : `${Math.round(breakProgressPercent)}% used`}
                  </span>
                </div>

                {/* Allowance Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-500 ${
                      breakOverdue ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${breakProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* Work Pause Summary */}
              <div className="flex items-center justify-center gap-6 text-xs text-slate-600 pt-1">
                <div>
                  <span className="font-semibold text-slate-800">Worked Today: </span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatSecondsToHms(workedSeconds)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Started At: </span>
                  <span className="font-mono text-slate-700">
                    {status?.currentBreak?.startTime
                      ? new Date(status.currentBreak.startTime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '--:--'}
                  </span>
                </div>
              </div>

              {/* End Break Action */}
              <button
                onClick={handleEndBreak}
                disabled={actionLoading}
                className="w-full max-w-md mx-auto flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-bold text-base text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-lg shadow-amber-600/30 transition-all cursor-pointer disabled:opacity-60"
              >
                <Coffee className="size-5" />
                <span>{actionLoading ? 'Resuming...' : 'End Break & Resume Work'}</span>
              </button>
            </div>
          ) : (
            /* =========================================================================
               VIEW 2: ACTIVE OR CLOCKED OUT WORK VIEW
               ========================================================================= */
            <>
              {/* Running Timers Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-xs">
                <div className="grid grid-cols-2 gap-4 divide-x divide-slate-200">
                  {/* Worked Today Timer */}
                  <div className="pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`size-2.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-500 animate-pulse'
                            : 'bg-slate-300'
                        }`}
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Hours Worked Today
                      </span>
                    </div>
                    <div className="text-3xl font-mono font-bold text-slate-900 tracking-tight">
                      {formatSecondsToHms(workedSeconds)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {isActive
                        ? 'Currently active & counting'
                        : 'Not clocked in yet'}
                    </div>
                  </div>

                  {/* Break Timer */}
                  <div className="pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="size-2.5 rounded-full bg-slate-300" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Total Breaks Today
                      </span>
                    </div>
                    <div className="text-3xl font-mono font-bold text-amber-800 tracking-tight">
                      {status?.totalBreakMinutes || 0}m
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {status?.todayBreaks?.length || 0} break session(s) taken
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Action Buttons */}
              <div className="space-y-3">
                {!isActive ? (
                  <button
                    onClick={handleClockIn}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-bold text-base text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all duration-150 disabled:opacity-60 cursor-pointer"
                  >
                    <Play className="size-5 fill-current" />
                    {actionLoading ? 'Verifying & Clocking In...' : 'Clock In Now'}
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsBreakConfirmOpen(true)}
                      disabled={actionLoading}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-slate-800 bg-white border border-slate-300 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900 shadow-xs transition-colors cursor-pointer"
                    >
                      <Coffee className="size-4 text-amber-600" />
                      Take a Break...
                    </button>

                    <button
                      onClick={handleClockOut}
                      disabled={actionLoading}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/20 transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <Square className="size-4 fill-current" />
                      {actionLoading ? 'Clocking Out...' : 'Clock Out'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Validation & Security Signals Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-purple-600" />
                Punch Policy & Validation Signals
              </span>
              <button
                onClick={refreshLocation}
                disabled={detectingLocation}
                className="text-xs text-purple-700 hover:text-purple-900 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RefreshCw
                  className={`size-3.5 ${detectingLocation ? 'animate-spin' : ''}`}
                />
                Refresh GPS
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* GPS Signal */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-indigo-600" />
                    Browser GPS
                  </span>
                  {geoCoords ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      High Accuracy
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Pending
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 font-mono truncate">
                  {geoCoords
                    ? `${geoCoords.lat.toFixed(5)}, ${geoCoords.lng.toFixed(5)}`
                    : geoError || 'Detecting coordinates...'}
                </div>
                {geoCoords?.accuracy && (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Accuracy: ±{Math.round(geoCoords.accuracy)} meters
                  </div>
                )}
              </div>

              {/* Office IP / Network */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Wifi className="size-3.5 text-indigo-600" />
                    Office IP / Network
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {policy?.webPunchValidation || 'GPS & IP'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  {policy?.webPunchValidation === 'ANYWHERE'
                    ? 'Remote / WFH Allowed'
                    : 'Corporate allowlist active'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Location: {status?.assignedLocation?.name || 'Main Office'}
                </div>
              </div>
            </div>
          </div>

          {/* Today's Break History */}
          {status?.todayBreaks && status.todayBreaks.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center justify-between">
                <span>Today&apos;s Break Log</span>
                <span className="text-slate-500 font-normal">
                  {status.todayBreaks.length} logged ({status.totalBreakMinutes} mins total)
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {status.todayBreaks.map(b => {
                  const bDef = getBreakDefinition(b.type)
                  const BIcon = bDef.icon
                  return (
                    <div key={b.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`size-6 rounded-md flex items-center justify-center border ${bDef.iconBg} ${bDef.iconColor}`}>
                          <BIcon className="size-3.5" />
                        </div>
                        <span className="font-semibold text-slate-800">
                          {bDef.label}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(b.startTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {b.endTime
                            ? ` - ${new Date(b.endTime).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : ' (Ongoing)'}
                        </span>
                      </div>
                      <span className="font-mono text-slate-600 font-medium">
                        {b.durationMinutes > 0
                          ? `${b.durationMinutes} mins`
                          : 'In progress'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Punches flow directly into Form T Muster Roll & Payroll LOP.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* =========================================================================
            PROMPT: BREAK START POPUP DIALOG
           ========================================================================= */}
        {isBreakConfirmOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                    <Coffee className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Start Break
                    </h3>
                    <p className="text-xs text-slate-500">
                      Select your break type to pause work timer
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBreakConfirmOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Break Type Choice Cards */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Break Type
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {BREAK_DEFINITIONS.map((def) => {
                    const isSelected = selectedBreak.type === def.type
                    const IconComp = def.icon
                    return (
                      <button
                        key={def.type}
                        type="button"
                        onClick={() => setSelectedBreak(def)}
                        className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`size-8 rounded-lg flex items-center justify-center border ${def.iconBg} ${def.iconColor}`}>
                            <IconComp className="size-4" />
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isSelected ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {def.durationMinutes}m
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {def.label}
                        </div>
                        <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {def.description}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBreakConfirmOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirmStartBreak}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-60"
                >
                  <selectedBreak.icon className="size-4" />
                  <span>Start {selectedBreak.label}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
