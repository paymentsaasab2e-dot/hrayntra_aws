"use client"

import * as React from 'react'
import {
  Button,
  Spinner,
} from '@hryantra/ui'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import { notifyDataChanged, useDataSync } from '@/shared/events'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Info,
} from 'lucide-react'

export type WorkWeekPattern =
  | 'FIVE_DAY'
  | 'SIX_DAY'
  | 'ALTERNATE_SAT_2ND_4TH'
  | 'ALTERNATE_SAT_1ST_3RD'
  | 'CUSTOM'

const PATTERN_OPTIONS = [
  {
    key: 'ALTERNATE_SAT_2ND_4TH',
    label: 'Alternate Saturdays Off (2nd & 4th Sat Off)',
    badge: 'Indian Standard',
    description:
      '2nd and 4th Saturdays and all Sundays are scheduled weekly offs. 1st, 3rd, and 5th Saturdays are active working days. Standard Indian Corporate & Banking (RBI) model.',
  },
  {
    key: 'FIVE_DAY',
    label: 'Complete Weekend Off (5-Day Work Week: Sat & Sun Off)',
    badge: 'Sat & Sun Off',
    description:
      'Both Saturday and Sunday are complete weekly offs. Standard for software engineering, MNCs, and corporate tech headquarters.',
  },
  {
    key: 'ALTERNATE_SAT_1ST_3RD',
    label: 'Alternate Saturdays Off (1st & 3rd Sat Off)',
    badge: '1st & 3rd Sat Off',
    description:
      '1st & 3rd Saturdays and all Sundays are weekly offs. 2nd, 4th, and 5th Saturdays are full working days.',
  },
  {
    key: 'SIX_DAY',
    label: '6-Day Work Week (Only Sunday Off)',
    badge: 'Sunday Only Off',
    description:
      'All Saturdays are full working days. Only Sundays are scheduled off. Standard for site operations, field workforce, and retail branches.',
  },
  {
    key: 'CUSTOM',
    label: 'Custom Weekly Off Days',
    badge: 'Custom Offs',
    description:
      'Customize specific days of the week as scheduled off days for shift operations, customer support, or non-standard work weeks.',
  },
]

const DAYS_OF_WEEK = [
  { day: 0, label: 'Sunday' },
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
]

export function WorkWeekRosterPanel() {
  const { currentUserRole, hasTab } = useStore()
  const canManage =
    currentUserRole === 'HR' ||
    currentUserRole === 'Superadmin' ||
    currentUserRole === 'PlatformOwner' ||
    hasTab('settings')

  const now = new Date()
  const [selectedYear, setSelectedYear] = React.useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = React.useState(now.getMonth() + 1) // 1-12

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const [selectedPattern, setSelectedPattern] = React.useState<WorkWeekPattern>('ALTERNATE_SAT_2ND_4TH')
  const [customDays, setCustomDays] = React.useState<number[]>([0, 6])
  const [rosterData, setRosterData] = React.useState<any>(null)

  const loadRoster = React.useCallback(async (year: number, month: number) => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.leaves.getWorkWeekRoster({ year, month })
      if (res?.success && res.data) {
        setRosterData(res.data)
        if (res.data.workWeek?.pattern) {
          setSelectedPattern(res.data.workWeek.pattern)
        }
        if (Array.isArray(res.data.workWeek?.customWeekOffDays)) {
          setCustomDays(res.data.workWeek.customWeekOffDays)
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load roster data')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadRoster(selectedYear, selectedMonth)
  }, [loadRoster, selectedYear, selectedMonth])

  // Real-time synchronization when roster or leave policies update
  useDataSync(['roster', 'leave'], () => {
    loadRoster(selectedYear, selectedMonth)
  })

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((prev) => prev - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((prev) => prev + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth((prev) => prev + 1)
    }
  }

  const handleCustomDayToggle = (day: number) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const handleSaveRoster = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      const res = await api.leaves.updateWorkWeekRoster({
        pattern: selectedPattern,
        customWeekOffDays: selectedPattern === 'CUSTOM' ? customDays : undefined,
      })
      if (res?.success) {
        setSuccess('Work week & weekend policy saved successfully!')
        notifyDataChanged('roster', { pattern: selectedPattern })
        notifyDataChanged('attendance', { pattern: selectedPattern })
        await loadRoster(selectedYear, selectedMonth)
      } else {
        throw new Error(res?.message || 'Failed to save policy')
      }
    } catch (err: any) {
      setError(err?.message || 'Could not update policy.')
    } finally {
      setSaving(false)
    }
  }

  const monthName = React.useMemo(() => {
    return new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }, [selectedYear, selectedMonth])

  const ordinals = ['1st', '2nd', '3rd', '4th', '5th']

  const previewSaturdays = React.useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const sats: Array<{ date: number; occurrence: number; isOff: boolean; label: string }> = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(selectedYear, selectedMonth - 1, d)
      if (dt.getDay() === 6) {
        const occurrence = Math.ceil(d / 7)
        let isOff = false
        if (selectedPattern === 'FIVE_DAY') isOff = true
        else if (selectedPattern === 'SIX_DAY') isOff = false
        else if (selectedPattern === 'ALTERNATE_SAT_2ND_4TH') isOff = occurrence === 2 || occurrence === 4
        else if (selectedPattern === 'ALTERNATE_SAT_1ST_3RD') isOff = occurrence === 1 || occurrence === 3
        else if (selectedPattern === 'CUSTOM') isOff = customDays.includes(6)

        sats.push({
          date: d,
          occurrence,
          isOff,
          label: `${ordinals[occurrence - 1] || `${occurrence}th`} Saturday`,
        })
      }
    }
    return sats
  }, [selectedYear, selectedMonth, selectedPattern, customDays])

  const stats = React.useMemo(() => {
    if (!rosterData?.summary) {
      const offSats = previewSaturdays.filter((s) => s.isOff).length
      return {
        totalDays: new Date(selectedYear, selectedMonth, 0).getDate(),
        workingDays: 22,
        weeklyOffs: 4 + offSats,
        saturdaysOff: offSats,
        saturdaysWorking: previewSaturdays.length - offSats,
      }
    }
    return {
      totalDays: rosterData.summary.totalDays,
      workingDays: rosterData.summary.workingDays,
      weeklyOffs: rosterData.summary.weeklyOffDays,
      saturdaysOff: rosterData.summary.saturdaysOff,
      saturdaysWorking: rosterData.summary.saturdaysWorking,
    }
  }, [rosterData, previewSaturdays, selectedYear, selectedMonth])

  const activeOption = PATTERN_OPTIONS.find((p) => p.key === selectedPattern) || PATTERN_OPTIONS[0]

  return (
    <div className="flex flex-col gap-5">
      {/* ── Feedback Messages ── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <span><strong>Error:</strong> {error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span><strong>Success:</strong> {success}</span>
        </div>
      )}

      {/* ── Section 1: Simple Header & Policy Selection Buttons ── */}
      <div className="rounded-2xl border border-ds-neutral-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-neutral-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-ds-brand-navy flex items-center gap-2">
              <CalendarDays className="size-5 text-emerald-600" />
              <span>Work Week & Weekend Policy</span>
            </h2>
            <p className="text-xs text-ds-neutral-500 mt-0.5">
              Select your organization's work schedule. The system automatically excludes scheduled week-offs from leave deductions.
            </p>
          </div>

          {canManage && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveRoster}
              disabled={saving}
              className="flex items-center gap-1.5 shadow-xs"
            >
              {saving ? (
                <>
                  <Spinner size="sm" />
                  <span>Saving Policy...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Save & Apply Policy</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* ── Policy Selection Buttons ── */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-ds-brand-navy">Choose Organization Work Schedule:</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {PATTERN_OPTIONS.map((opt) => {
              const isSelected = selectedPattern === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setSelectedPattern(opt.key as WorkWeekPattern)}
                  className={`flex items-center justify-between p-3 rounded-xl text-left border transition-all ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold ring-1 ring-emerald-600 shadow-2xs'
                      : 'bg-white border-ds-neutral-200 text-ds-neutral-700 hover:bg-ds-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex size-5 items-center justify-center rounded-full text-xs font-black ${
                        isSelected
                          ? 'bg-emerald-700 text-white'
                          : 'border border-ds-neutral-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-xs">{opt.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-ds-neutral-100 text-ds-neutral-600'
                    }`}
                  >
                    {opt.badge}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Custom Days Selector if CUSTOM is selected */}
        {selectedPattern === 'CUSTOM' && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 space-y-2">
            <span className="text-xs font-bold text-indigo-950">Select Scheduled Off Days:</span>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map(({ day, label }) => {
                const isOff = customDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!canManage}
                    onClick={() => handleCustomDayToggle(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isOff
                        ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white text-ds-neutral-700 border-ds-neutral-300 hover:bg-ds-neutral-100'
                    }`}
                  >
                    {label} {isOff ? '(Off)' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Active Selection Purpose & Month Summary ── */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2 text-xs text-emerald-950">
          <div className="flex items-center gap-2 font-bold text-emerald-900">
            <ShieldCheck className="size-4 text-emerald-700" />
            <span>Active Policy: {activeOption.label}</span>
          </div>
          <p className="text-[11px] text-emerald-900 leading-relaxed">
            <strong>Policy Purpose:</strong> {activeOption.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-emerald-200 text-[11px] text-emerald-800">
            <span><strong>{monthName}:</strong></span>
            <span>Scheduled Working Days: <strong>{stats.workingDays}</strong></span>
            <span>•</span>
            <span>Weekly Offs: <strong>{stats.weeklyOffs}</strong> ({stats.saturdaysOff} Saturdays Off + Sundays)</span>
          </div>
        </div>
      </div>

      {/* ── Section 2: Saturday Schedule for Current Month ── */}
      <div className="rounded-2xl border border-ds-neutral-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-neutral-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-ds-brand-navy flex items-center gap-2">
              <CalendarDays className="size-4 text-emerald-600" />
              <span>Saturday Schedule for {monthName}</span>
            </h3>
            <p className="text-[11px] text-ds-neutral-500 mt-0.5">
              Live status of each Saturday in {monthName}. Scheduled offs are excluded from employee leave deductions.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-ds-neutral-200 bg-white text-ds-neutral-600 hover:bg-ds-neutral-50"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-bold text-ds-brand-navy px-2">{monthName}</span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-ds-neutral-200 bg-white text-ds-neutral-600 hover:bg-ds-neutral-50"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-ds-neutral-100 bg-ds-neutral-50 text-[11px] font-bold text-ds-neutral-600 uppercase">
                <th className="py-2.5 px-3">Saturday Occurrence</th>
                <th className="py-2.5 px-3">Calendar Date</th>
                <th className="py-2.5 px-3">Roster Status</th>
                <th className="py-2.5 px-3">Leave Balance Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-neutral-100">
              {previewSaturdays.map((sat) => (
                <tr key={sat.date} className="hover:bg-ds-neutral-50/50">
                  <td className="py-2.5 px-3 font-semibold text-ds-brand-navy">
                    {sat.label}
                  </td>
                  <td className="py-2.5 px-3 text-ds-neutral-600">
                    {new Date(selectedYear, selectedMonth - 1, sat.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="py-2.5 px-3">
                    {sat.isOff ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                        🏖️ Scheduled Weekly Off (WO)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-300">
                        💼 Full Working Day
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-ds-neutral-500 text-[11px]">
                    {sat.isOff
                      ? 'Excluded from leave deductions (0 days deducted)'
                      : 'Counted as active work day if leave taken'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 3: Indian Statutory Weekend Exclusion Rule ── */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="size-4 shrink-0 mt-0.5 text-blue-600" />
        <div className="space-y-1 text-[11px] leading-relaxed">
          <p>
            <strong>How this works in Production:</strong> When an employee applies for leave overlapping a
            weekly off Saturday or Sunday, the system automatically excludes the week-off from their balance
            deduction (e.g. taking Thursday to Monday leave only deducts 3 working days when Saturday and Sunday
            are scheduled offs). In Attendance registers, employees are marked <strong>Weekly Off (WO)</strong> instead of absent.
          </p>
        </div>
      </div>
    </div>
  )
}
