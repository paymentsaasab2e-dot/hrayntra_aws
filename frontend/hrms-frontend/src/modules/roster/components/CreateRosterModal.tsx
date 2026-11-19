"use client"

import * as React from 'react'
import {
  Button,
  Spinner,
} from '@hryantra/ui'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import { notifyDataChanged } from '@/shared/events'
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Users,
  Building2,
  Sparkles,
  AlertCircle,
  Plus,
  Search,
  Check,
  CheckSquare,
  Square,
  X,
  ChevronRight,
  ShieldCheck,
  Info,
} from 'lucide-react'

export interface EmployeeListItem {
  id: string
  employeeId?: string
  name: string
  department: string
  designation?: string
  assignedShift?: string
}

export interface CreateRosterModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  initialSelectedEmployeeIds?: string[]
  departments?: string[]
  employees?: EmployeeListItem[]
  onNavigateToShifts?: () => void
}

interface ShiftItem {
  code: string
  name: string
  shortLabel?: string
  timings: string
  color: string
  badgeClass: string
  startTime?: string
  endTime?: string
  gracePeriodMinutes?: number
  halfDayHours?: number
}

const DEFAULT_SHIFTS: ShiftItem[] = [
  {
    code: 'GS',
    name: 'General Shift',
    timings: '09:30 AM – 06:30 PM',
    color: '#0f172a',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  {
    code: 'MS',
    name: 'Morning Shift',
    timings: '06:00 AM – 02:30 PM',
    color: '#d97706',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    code: 'ES',
    name: 'Evening Shift',
    timings: '02:00 PM – 10:30 PM',
    color: '#0284c7',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  {
    code: 'NS',
    name: 'Night Shift',
    timings: '10:00 PM – 06:30 AM',
    color: '#4338ca',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
]

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon', full: 'Monday' },
  { day: 2, label: 'Tue', full: 'Tuesday' },
  { day: 3, label: 'Wed', full: 'Wednesday' },
  { day: 4, label: 'Thu', full: 'Thursday' },
  { day: 5, label: 'Fri', full: 'Friday' },
  { day: 6, label: 'Sat', full: 'Saturday' },
  { day: 0, label: 'Sun', full: 'Sunday' },
]

const SATURDAY_RULES = [
  {
    key: 'ALL_WORKING',
    label: 'All Saturdays Working (6-Day Work Week)',
    shortLabel: 'All Saturdays Working',
    tag: '6-Day Week',
    requiresSaturday: true,
    description: 'All Saturdays are active working days. Only Sundays are scheduled off. Standard for operations, sites, retail & plants.',
  },
  {
    key: '2ND_4TH_OFF',
    label: '2nd & 4th Saturday Off (Indian Corporate Standard)',
    shortLabel: '2nd & 4th Sat Off',
    tag: '5.5-Day Week',
    requiresSaturday: true,
    description: '1st, 3rd, and 5th Saturdays are active working days. 2nd & 4th Saturdays and all Sundays are scheduled offs.',
  },
  {
    key: '1ST_3RD_OFF',
    label: '1st & 3rd Saturday Off',
    shortLabel: '1st & 3rd Sat Off',
    tag: '5.5-Day Week',
    requiresSaturday: true,
    description: '2nd, 4th, and 5th Saturdays are active working days. 1st & 3rd Saturdays and all Sundays are scheduled offs.',
  },
  {
    key: 'ALL_OFF',
    label: 'Complete Weekend Off (5-Day Work Week)',
    shortLabel: 'All Saturdays Off',
    tag: '5-Day Week',
    requiresSaturday: false,
    description: 'Both Saturday and Sunday are complete weekly offs. Standard for software engineering, tech and corporate offices.',
  },
]

const WORK_WEEK_PRESETS = [
  {
    id: '6_DAY',
    label: '6-Day Work Week',
    sublabel: 'Mon–Sat (All Sats Work)',
    days: [1, 2, 3, 4, 5, 6],
    rule: 'ALL_WORKING' as const,
  },
  {
    id: '5_DAY',
    label: '5-Day Work Week',
    sublabel: 'Mon–Fri (Sat & Sun Off)',
    days: [1, 2, 3, 4, 5],
    rule: 'ALL_OFF' as const,
  },
  {
    id: 'ALT_2ND_4TH',
    label: 'Alternate Sat (2nd & 4th Off)',
    sublabel: 'Mon–Sat (2nd/4th Sat Off)',
    days: [1, 2, 3, 4, 5, 6],
    rule: '2ND_4TH_OFF' as const,
  },
  {
    id: 'ALT_1ST_3RD',
    label: 'Alternate Sat (1st & 3rd Off)',
    sublabel: 'Mon–Sat (1st/3rd Sat Off)',
    days: [1, 2, 3, 4, 5, 6],
    rule: '1ST_3RD_OFF' as const,
  },
]

export function CreateRosterModal({
  open,
  onClose,
  onSuccess,
  initialSelectedEmployeeIds = [],
  departments = [],
  employees: propEmployees,
  onNavigateToShifts,
}: CreateRosterModalProps) {
  const { employees: storeEmployees } = useStore()

  // Resolve employee list: prioritize passed prop employees (from active grid), fallback to store
  const employeeList: EmployeeListItem[] = React.useMemo(() => {
    if (propEmployees && propEmployees.length > 0) {
      return propEmployees
    }
    if (storeEmployees && storeEmployees.length > 0) {
      return storeEmployees.map((e) => ({
        id: e.id,
        employeeId: e.id,
        name: e.name,
        department: e.department,
        designation: e.designation,
      }))
    }
    return []
  }, [propEmployees, storeEmployees])

  // Scope: 'CUSTOM' (select specific), 'DEPARTMENT', or 'ALL'
  const [scope, setScope] = React.useState<'CUSTOM' | 'DEPARTMENT' | 'ALL'>('CUSTOM')
  const [selectedDept, setSelectedDept] = React.useState<string>(departments[0] || 'ALL')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<string[]>([])
  const [searchEmployeeQuery, setSearchEmployeeQuery] = React.useState('')

  // Date Range Defaults (current calendar month)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const firstDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate()
  const lastDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`

  const [startDate, setStartDate] = React.useState(firstDayStr)
  const [endDate, setEndDate] = React.useState(lastDayStr)
  const [workingDays, setWorkingDays] = React.useState<number[]>([1, 2, 3, 4, 5, 6]) // Mon-Sat
  const [saturdayRule, setSaturdayRule] = React.useState<'ALL_WORKING' | '2ND_4TH_OFF' | '1ST_3RD_OFF' | 'ALL_OFF'>('2ND_4TH_OFF')

  // Shift Selection & Dynamic Shifts
  const [shifts, setShifts] = React.useState<ShiftItem[]>(DEFAULT_SHIFTS)
  const [selectedShiftCode, setSelectedShiftCode] = React.useState<string>('GS')

  // Inline Quick Shift Creation
  const [isCreatingShift, setIsCreatingShift] = React.useState(false)
  const [newShiftCode, setNewShiftCode] = React.useState('')
  const [newShiftName, setNewShiftName] = React.useState('')
  const [newShiftStart, setNewShiftStart] = React.useState('08:00')
  const [newShiftEnd, setNewShiftEnd] = React.useState('16:30')
  const [savingShift, setSavingShift] = React.useState(false)

  // Status
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  // Fetch shifts dynamically when modal opens
  React.useEffect(() => {
    if (open) {
      api.leaves.getShifts()
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            const valid = res.data.filter((s: any) => s.code !== 'WO')
            if (valid.length > 0) {
              setShifts(valid)
              if (!valid.some((s: any) => s.code === selectedShiftCode)) {
                setSelectedShiftCode(valid[0].code)
              }
            }
          }
        })
        .catch(() => {})
    }
  }, [open])

  // Sync initial selections on open — default to ALL available employees so it never starts with 0
  React.useEffect(() => {
    if (open && employeeList.length > 0) {
      if (initialSelectedEmployeeIds && initialSelectedEmployeeIds.length > 0) {
        setSelectedEmployeeIds(initialSelectedEmployeeIds)
        setScope('CUSTOM')
      } else {
        setSelectedEmployeeIds(employeeList.map((e) => e.id))
      }
    }
  }, [open, employeeList, initialSelectedEmployeeIds])

  if (!open) return null

  // Filtered employees for checklist
  const filteredEmployees = employeeList.filter((emp) => {
    const matchesDept =
      scope === 'DEPARTMENT'
        ? selectedDept === 'ALL' || emp.department === selectedDept
        : true

    const query = searchEmployeeQuery.toLowerCase().trim()
    const matchesSearch =
      !query ||
      emp.name?.toLowerCase().includes(query) ||
      (emp.id && emp.id.toLowerCase().includes(query)) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(query)) ||
      (emp.department && emp.department.toLowerCase().includes(query))

    return matchesDept && matchesSearch
  })

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredEmployees.map((e) => e.id)
    setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...idsToAdd])))
  }

  const handleDeselectAllFiltered = () => {
    const idsToRemove = new Set(filteredEmployees.map((e) => e.id))
    setSelectedEmployeeIds((prev) => prev.filter((id) => !idsToRemove.has(id)))
  }

  // Handle toggling individual day of the week with bidirectional synchronization
  const handleToggleWorkingDay = (day: number) => {
    setWorkingDays((prev) => {
      const isRemoving = prev.includes(day)
      const nextDays = isRemoving ? prev.filter((d) => d !== day) : [...prev, day].sort()

      // When Saturday (day 6) is clicked:
      if (day === 6) {
        if (isRemoving) {
          // Saturday is unchecked -> automatically set Saturday rule to ALL_OFF (5-day week)
          setSaturdayRule('ALL_OFF')
        } else {
          // Saturday is checked -> if previous rule was ALL_OFF, auto-promote to ALL_WORKING (6-day week)
          if (saturdayRule === 'ALL_OFF') {
            setSaturdayRule('ALL_WORKING')
          }
        }
      } else {
        // Any other day clicked: maintain consistency for Saturday
        const hasSat = nextDays.includes(6)
        if (!hasSat && saturdayRule !== 'ALL_OFF') {
          setSaturdayRule('ALL_OFF')
        } else if (hasSat && saturdayRule === 'ALL_OFF') {
          setSaturdayRule('ALL_WORKING')
        }
      }

      return nextDays
    })
  }

  // Handle selecting a Saturday rule with automatic workingDays alignment
  const handleSelectSaturdayRule = (ruleKey: 'ALL_WORKING' | '2ND_4TH_OFF' | '1ST_3RD_OFF' | 'ALL_OFF') => {
    setSaturdayRule(ruleKey)

    setWorkingDays((prev) => {
      if (ruleKey === 'ALL_OFF') {
        // Complete Weekend Off (5-Day Work Week): uncheck Saturday (6)
        return prev.filter((d) => d !== 6)
      } else {
        // All Saturdays Working (6-Day) or Alternate Saturday rules: ensure Saturday (6) is active!
        if (!prev.includes(6)) {
          return [...prev, 6].sort()
        }
        return prev
      }
    })
  }

  // Handle applying a quick work week preset
  const handleApplyWorkWeekPreset = (preset: (typeof WORK_WEEK_PRESETS)[number]) => {
    setWorkingDays([...preset.days])
    setSaturdayRule(preset.rule)
  }

  // Quick Date Presets
  const handleApplyDatePreset = (preset: 'CURRENT_MONTH' | 'NEXT_MONTH' | 'NEXT_14_DAYS' | 'THIS_WEEK') => {
    const today = new Date()
    if (preset === 'CURRENT_MONTH') {
      const y = today.getFullYear()
      const m = today.getMonth() + 1
      const last = new Date(y, m, 0).getDate()
      setStartDate(`${y}-${String(m).padStart(2, '0')}-01`)
      setEndDate(`${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`)
    } else if (preset === 'NEXT_MONTH') {
      let y = today.getFullYear()
      let m = today.getMonth() + 2
      if (m > 12) {
        y += 1
        m = 1
      }
      const last = new Date(y, m, 0).getDate()
      setStartDate(`${y}-${String(m).padStart(2, '0')}-01`)
      setEndDate(`${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`)
    } else if (preset === 'NEXT_14_DAYS') {
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const d = String(today.getDate()).padStart(2, '0')
      setStartDate(`${y}-${m}-${d}`)

      const future = new Date(today)
      future.setDate(future.getDate() + 13)
      const fy = future.getFullYear()
      const fm = String(future.getMonth() + 1).padStart(2, '0')
      const fd = String(future.getDate()).padStart(2, '0')
      setEndDate(`${fy}-${fm}-${fd}`)
    } else if (preset === 'THIS_WEEK') {
      const currentDay = today.getDay()
      const diffToMon = currentDay === 0 ? -6 : 1 - currentDay
      const mon = new Date(today)
      mon.setDate(today.getDate() + diffToMon)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)

      const formatD = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      setStartDate(formatD(mon))
      setEndDate(formatD(sun))
    }
  }

  // Save Inline Shift
  const handleCreateInlineShift = async () => {
    if (!newShiftCode.trim() || !newShiftName.trim()) {
      setError('Please provide Shift Code and Shift Name.')
      return
    }
    try {
      setSavingShift(true)
      setError(null)
      const codeUpper = newShiftCode.toUpperCase().trim()
      const res = await api.leaves.createOrUpdateShift({
        code: codeUpper,
        name: newShiftName.trim(),
        startTime: newShiftStart,
        endTime: newShiftEnd,
        gracePeriodMinutes: 15,
        halfDayHours: 4,
        color: '#0284c7',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 font-bold',
      })

      if (res?.success && Array.isArray(res.data)) {
        const valid = res.data.filter((s: any) => s.code !== 'WO')
        setShifts(valid)
        setSelectedShiftCode(codeUpper)
        setIsCreatingShift(false)
        setNewShiftCode('')
        setNewShiftName('')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create shift')
    } finally {
      setSavingShift(false)
    }
  }

  // Submit Roster Schedule
  const handleCreateRoster = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      if (!startDate || !endDate) {
        throw new Error('Please select both Start Date and End Date.')
      }

      let targetEmpIds: string[] = []
      if (scope === 'ALL') {
        targetEmpIds = employeeList.map((e) => e.id)
      } else if (scope === 'DEPARTMENT') {
        targetEmpIds = employeeList
          .filter((e) => selectedDept === 'ALL' || e.department === selectedDept)
          .map((e) => e.id)
      } else {
        targetEmpIds = selectedEmployeeIds
      }

      if (targetEmpIds.length === 0) {
        throw new Error('Please select at least one employee.')
      }

      const res = await api.leaves.createRosterSchedule({
        employeeIds: targetEmpIds,
        department: scope === 'DEPARTMENT' ? selectedDept : undefined,
        applyToAll: scope === 'ALL',
        startDate,
        endDate,
        shiftCode: selectedShiftCode,
        workingDays,
        saturdayRule,
      })

      if (res?.success) {
        setSuccess(res.message || 'Roster schedule created and assigned successfully!')
        notifyDataChanged('roster', { scope, shiftCode: selectedShiftCode })
        notifyDataChanged('attendance', { scope, shiftCode: selectedShiftCode })
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 800)
      } else {
        throw new Error(res?.message || 'Failed to create roster schedule')
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred while creating roster schedule.')
    } finally {
      setLoading(false)
    }
  }

  const selectedShiftObj = shifts.find((s) => s.code === selectedShiftCode) || shifts[0]
  const targetEmployeesCount =
    scope === 'ALL'
      ? employeeList.length
      : scope === 'DEPARTMENT'
      ? employeeList.filter((e) => selectedDept === 'ALL' || e.department === selectedDept).length
      : selectedEmployeeIds.length
  const activePresetId = React.useMemo(() => {
    const isMonFri = [1, 2, 3, 4, 5].every((d) => workingDays.includes(d)) && !workingDays.includes(0)
    const hasSat = workingDays.includes(6)

    if (isMonFri && hasSat && workingDays.length === 6) {
      if (saturdayRule === 'ALL_WORKING') return '6_DAY'
      if (saturdayRule === '2ND_4TH_OFF') return 'ALT_2ND_4TH'
      if (saturdayRule === '1ST_3RD_OFF') return 'ALT_1ST_3RD'
    }
    if (isMonFri && !hasSat && workingDays.length === 5 && saturdayRule === 'ALL_OFF') {
      return '5_DAY'
    }
    return 'CUSTOM'
  }, [workingDays, saturdayRule])

  const dynamicPolicy = React.useMemo(() => {
    const shiftCode = selectedShiftCode || 'GS'
    if (activePresetId === '6_DAY') {
      return {
        badge: '6-Day Work Week Active',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        title: '6-Day Work Week (Mon–Sat Active Working)',
        description: `Monday to Saturday are active working days (assigned shift ${shiftCode}). All Saturdays are working days. Only Sundays are scheduled Weekly Offs (WO).`,
      }
    }
    if (activePresetId === '5_DAY') {
      return {
        badge: '5-Day Work Week Active',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
        title: '5-Day Work Week (Mon–Fri Active Working)',
        description: `Monday to Friday are active working days (assigned shift ${shiftCode}). Both Saturdays and Sundays are complete Weekly Offs (WO).`,
      }
    }
    if (activePresetId === 'ALT_2ND_4TH') {
      return {
        badge: 'Alternate 2nd & 4th Sat Off Active',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
        title: 'Alternate Saturdays: 2nd & 4th Saturday Off',
        description: `Monday to Friday and 1st, 3rd & 5th Saturdays are active working shifts (${shiftCode}). 2nd & 4th Saturdays and all Sundays are scheduled Weekly Offs (WO).`,
      }
    }
    if (activePresetId === 'ALT_1ST_3RD') {
      return {
        badge: 'Alternate 1st & 3rd Sat Off Active',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        title: 'Alternate Saturdays: 1st & 3rd Saturday Off',
        description: `Monday to Friday and 2nd, 4th & 5th Saturdays are active working shifts (${shiftCode}). 1st & 3rd Saturdays and all Sundays are scheduled Weekly Offs (WO).`,
      }
    }
    return {
      badge: `${workingDays.length}-Day Custom Schedule`,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      title: `${workingDays.length}-Day Custom Active Schedule`,
      description: `Active days: ${workingDays.map((d) => DAYS_OF_WEEK.find((w) => w.day === d)?.label).join(', ')}. Saturday rule: ${SATURDAY_RULES.find((r) => r.key === saturdayRule)?.label}. All other unselected days will be assigned Weekly Off (WO).`,
    }
  }, [activePresetId, workingDays, saturdayRule, selectedShiftCode])

  const dateBreakdown = React.useMemo(() => {
    if (!startDate || !endDate) return null
    const [sY, sM, sD] = startDate.split('-').map(Number)
    const [eY, eM, eD] = endDate.split('-').map(Number)
    const cur = new Date(Date.UTC(sY, sM - 1, sD))
    const end = new Date(Date.UTC(eY, eM - 1, eD))
    if (cur > end) return null

    let totalCalendarDays = 0
    let workingShifts = 0
    let weeklyOffs = 0
    let saturdaysWorking = 0
    let saturdaysOff = 0

    while (cur <= end) {
      totalCalendarDays++
      const dayOfWeek = cur.getUTCDay()
      const dayOfMonth = cur.getUTCDate()

      let isWork = false
      if (dayOfWeek === 0) {
        isWork = workingDays.includes(0)
      } else if (dayOfWeek === 6) {
        const satWorking = workingDays.includes(6)
        if (!satWorking || saturdayRule === 'ALL_OFF') {
          isWork = false
          saturdaysOff++
        } else if (saturdayRule === 'ALL_WORKING') {
          isWork = true
          saturdaysWorking++
        } else if (saturdayRule === '2ND_4TH_OFF') {
          const occ = Math.ceil(dayOfMonth / 7)
          const isOff = occ === 2 || occ === 4
          isWork = !isOff
          if (isWork) saturdaysWorking++
          else saturdaysOff++
        } else if (saturdayRule === '1ST_3RD_OFF') {
          const occ = Math.ceil(dayOfMonth / 7)
          const isOff = occ === 1 || occ === 3
          isWork = !isOff
          if (isWork) saturdaysWorking++
          else saturdaysOff++
        }
      } else {
        isWork = workingDays.includes(dayOfWeek)
      }

      if (isWork) workingShifts++
      else weeklyOffs++

      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    return { totalCalendarDays, workingShifts, weeklyOffs, saturdaysWorking, saturdaysOff }
  }, [startDate, endDate, workingDays, saturdayRule])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in">
      {/* ── Fixed Max-Height Modal Box (Header + Scrollable Body + Footer) ── */}
      <div className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-2xl sm:rounded-3xl border border-ds-neutral-200 bg-white shadow-2xl overflow-hidden">
        
        {/* ── Fixed Modal Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-ds-neutral-200/90 px-6 py-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-xs">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ds-brand-navy leading-tight">
                Create & Assign Roster Schedule
              </h2>
              <p className="text-xs text-ds-neutral-500 mt-0.5">
                Assign shifts to employees across selected days and date ranges.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-ds-neutral-400 hover:bg-ds-neutral-100 hover:text-ds-neutral-700 transition-colors"
            title="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* ── Scrollable Modal Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-ds-neutral-50/40">
          
          {/* Feedback Alerts */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="size-4 shrink-0 text-rose-600" />
              <span><strong>Error:</strong> {error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span><strong>Success:</strong> {success}</span>
            </div>
          )}

          {/* ── Step 1: Select Employees Card ── */}
          <div className="rounded-2xl border border-ds-neutral-200/90 bg-white p-4.5 shadow-2xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-bold text-white shadow-2xs">
                  1
                </span>
                <h3 className="text-xs font-bold text-ds-brand-navy uppercase tracking-wider">
                  Select Employees
                </h3>
              </div>

              {/* Scope Segmented Buttons */}
              <div className="flex items-center rounded-xl bg-ds-neutral-100 border border-ds-neutral-200 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setScope('CUSTOM')}
                  className={`px-3 py-1 font-semibold rounded-lg transition-all ${
                    scope === 'CUSTOM'
                      ? 'bg-white text-emerald-800 font-bold shadow-2xs'
                      : 'text-ds-neutral-600 hover:text-ds-neutral-900'
                  }`}
                >
                  Specific Staff ({selectedEmployeeIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScope('DEPARTMENT')}
                  className={`px-3 py-1 font-semibold rounded-lg transition-all ${
                    scope === 'DEPARTMENT'
                      ? 'bg-white text-emerald-800 font-bold shadow-2xs'
                      : 'text-ds-neutral-600 hover:text-ds-neutral-900'
                  }`}
                >
                  By Department
                </button>
                <button
                  type="button"
                  onClick={() => setScope('ALL')}
                  className={`px-3 py-1 font-semibold rounded-lg transition-all ${
                    scope === 'ALL'
                      ? 'bg-white text-emerald-800 font-bold shadow-2xs'
                      : 'text-ds-neutral-600 hover:text-ds-neutral-900'
                  }`}
                >
                  All Staff ({employeeList.length})
                </button>
              </div>
            </div>

            {/* Department Filter if scope === DEPARTMENT */}
            {scope === 'DEPARTMENT' && (
              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs font-semibold text-ds-neutral-600">Department:</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="rounded-xl border border-ds-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-ds-brand-navy focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search & Checklist if scope !== ALL */}
            {scope !== 'ALL' && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="size-3.5 absolute left-3 top-2.5 text-ds-neutral-400" />
                    <input
                      type="text"
                      value={searchEmployeeQuery}
                      onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                      placeholder="Search staff by name, code or department..."
                      className="w-full rounded-xl border border-ds-neutral-300 bg-white pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    {searchEmployeeQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchEmployeeQuery('')}
                        className="absolute right-2.5 top-2 text-ds-neutral-400 hover:text-ds-neutral-700"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="font-bold text-emerald-800 hover:underline"
                    >
                      Select All ({filteredEmployees.length})
                    </button>
                    <span className="text-ds-neutral-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllFiltered}
                      className="font-bold text-ds-neutral-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Employee Checklist Cards */}
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-ds-neutral-200 bg-ds-neutral-50/50 p-2">
                  {filteredEmployees.length === 0 ? (
                    <p className="text-center py-4 text-xs text-ds-neutral-400 font-medium">
                      No employees matching search criteria.
                    </p>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isChecked = selectedEmployeeIds.includes(emp.id)
                      const initials = emp.name
                        ? emp.name
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                        : 'EM'

                      return (
                        <div
                          key={emp.id}
                          onClick={() => handleToggleEmployee(emp.id)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors text-xs ${
                            isChecked
                              ? 'bg-emerald-50 border border-emerald-200 shadow-2xs'
                              : 'bg-white hover:bg-ds-neutral-50 border border-ds-neutral-200/70'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="text-ds-neutral-400">
                              {isChecked ? (
                                <CheckSquare className="size-4 text-emerald-700" />
                              ) : (
                                <Square className="size-4" />
                              )}
                            </div>
                            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-[10px] font-bold text-emerald-900 shrink-0">
                              {initials}
                            </div>
                            <div>
                              <span className="font-bold text-ds-brand-navy">{emp.name}</span>
                              <span className="text-[11px] text-ds-neutral-500 ml-1.5">
                                ({emp.employeeId || emp.id}) • {emp.department}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-ds-neutral-600 bg-ds-neutral-100 px-2 py-0.5 rounded-md">
                            {emp.designation || 'Staff'}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* Target Count Indicator */}
            <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 flex items-center gap-2">
              <Users className="size-3.5 text-emerald-700" />
              <span>Targeting {targetEmployeesCount} active employees for this schedule</span>
            </div>
          </div>

          {/* ── Step 2: Date Range & Working Days Card ── */}
          <div className="rounded-2xl border border-ds-neutral-200/90 bg-white p-4.5 shadow-2xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-bold text-white shadow-2xs">
                  2
                </span>
                <h3 className="text-xs font-bold text-ds-brand-navy uppercase tracking-wider">
                  Date Range & Working Days
                </h3>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-ds-neutral-500 font-semibold">Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('CURRENT_MONTH')}
                  className="px-2 py-0.5 rounded-md bg-white border border-ds-neutral-200 text-ds-neutral-700 font-semibold hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('NEXT_MONTH')}
                  className="px-2 py-0.5 rounded-md bg-white border border-ds-neutral-200 text-ds-neutral-700 font-semibold hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                >
                  Next Month
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('NEXT_14_DAYS')}
                  className="px-2 py-0.5 rounded-md bg-white border border-ds-neutral-200 text-ds-neutral-700 font-semibold hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                >
                  Next 14 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('THIS_WEEK')}
                  className="px-2 py-0.5 rounded-md bg-white border border-ds-neutral-200 text-ds-neutral-700 font-semibold hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                >
                  This Week
                </button>
              </div>
            </div>

            {/* Start and End Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ds-neutral-700">Schedule Start Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border border-ds-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-ds-brand-navy focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ds-neutral-700">Schedule End Date:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border border-ds-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-ds-brand-navy focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            {/* Quick Work Week Presets */}
            <div className="space-y-1.5 pt-1 border-t border-ds-neutral-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ds-neutral-700 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-emerald-700" />
                  <span>Work Week Structure Presets:</span>
                </label>
                <span className="text-[11px] font-semibold text-ds-neutral-500">
                  Instant 1-click day & weekend sync
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WORK_WEEK_PRESETS.map((preset) => {
                  const isActive = activePresetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyWorkWeekPreset(preset)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/30 shadow-2xs'
                          : 'border-ds-neutral-200 bg-white hover:bg-ds-neutral-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isActive ? 'text-emerald-900' : 'text-ds-brand-navy'}`}>
                          {preset.label}
                        </span>
                        {isActive && <Check className="size-3.5 text-emerald-700" />}
                      </div>
                      <span className="text-[10px] text-ds-neutral-500 block mt-0.5">
                        {preset.sublabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Active Days of Week Chips */}
            <div className="space-y-1.5 pt-1 border-t border-ds-neutral-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ds-neutral-700">
                  Active Working Days ({workingDays.length} days selected):
                </label>
                <span className="text-[11px]">
                  {workingDays.includes(6) ? (
                    <span className="text-emerald-700 font-bold">✓ Saturday is Active (6-Day / Alternate)</span>
                  ) : (
                    <span className="text-amber-700 font-bold">Saturday is Off (5-Day Week)</span>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DAYS_OF_WEEK.map((d) => {
                  const isActive = workingDays.includes(d.day)
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => handleToggleWorkingDay(d.day)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-emerald-700 text-white shadow-2xs ring-1 ring-emerald-800'
                          : 'bg-white text-ds-neutral-600 border border-ds-neutral-300 hover:bg-ds-neutral-100'
                      }`}
                    >
                      {isActive && <Check className="size-3" />}
                      <span>{d.full} ({d.label})</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Saturday Off Rule Cards */}
            <div className="space-y-1.5 pt-1 border-t border-ds-neutral-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ds-neutral-700">
                  Saturday & Weekend Off Rule:
                </label>
                <span className="text-[11px] text-ds-neutral-500">
                  Syncs automatically with active days
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SATURDAY_RULES.map((rule) => {
                  const isSelected = saturdayRule === rule.key
                  const satInWorking = workingDays.includes(6)
                  return (
                    <div
                      key={rule.key}
                      onClick={() => handleSelectSaturdayRule(rule.key as any)}
                      className={`p-3 rounded-xl border cursor-pointer text-left transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/30 shadow-2xs'
                          : 'border-ds-neutral-200 bg-white hover:bg-ds-neutral-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-xs text-ds-brand-navy">{rule.label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-emerald-200 text-emerald-900' : 'bg-ds-neutral-100 text-ds-neutral-600'
                          }`}>
                            {rule.tag}
                          </span>
                          {isSelected && <Check className="size-4 text-emerald-600 shrink-0" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-ds-neutral-500 mt-1 line-clamp-2">
                        {rule.description}
                      </p>
                      {rule.requiresSaturday && !satInWorking && (
                        <span className="mt-1.5 inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                          ⚡ Click to select 6-day week with Saturday working
                        </span>
                      )}
                      {!rule.requiresSaturday && satInWorking && (
                        <span className="mt-1.5 inline-block text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                          ⚡ Click to switch to 5-day week (Saturday Off)
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Dynamic Live Policy Consistency Banner */}
            <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/60 p-3 flex items-start gap-2.5 transition-all">
              <ShieldCheck className="size-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-bold text-emerald-950">{dynamicPolicy.title}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dynamicPolicy.badgeClass}`}>
                    {dynamicPolicy.badge}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  {dynamicPolicy.description}
                </p>
              </div>
            </div>
          </div>

          {/* ── Step 3: Select Shift to Assign Card ── */}
          <div className="rounded-2xl border border-ds-neutral-200/90 bg-white p-4.5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-bold text-white shadow-2xs">
                  3
                </span>
                <h3 className="text-xs font-bold text-ds-brand-navy uppercase tracking-wider">
                  Select Shift to Assign
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingShift(!isCreatingShift)}
                className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-xl border border-indigo-200 transition-colors"
              >
                <Plus className="size-3.5" />
                <span>{isCreatingShift ? 'Cancel New Shift' : '+ Create New Shift'}</span>
              </button>
            </div>

            {/* Inline Quick Shift Creation Card */}
            {isCreatingShift && (
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Clock className="size-4 text-indigo-600" />
                    <span>Quick Create Shift</span>
                  </span>
                  <span className="text-[11px] text-indigo-700">Will be saved and selected immediately</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-ds-neutral-600 uppercase">Code</label>
                    <input
                      type="text"
                      maxLength={5}
                      value={newShiftCode}
                      onChange={(e) => setNewShiftCode(e.target.value.toUpperCase())}
                      placeholder="e.g. S1, ROT1"
                      className="w-full mt-0.5 rounded-lg border border-ds-neutral-300 bg-white px-2 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ds-neutral-600 uppercase">Name</label>
                    <input
                      type="text"
                      value={newShiftName}
                      onChange={(e) => setNewShiftName(e.target.value)}
                      placeholder="e.g. Early Morning"
                      className="w-full mt-0.5 rounded-lg border border-ds-neutral-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ds-neutral-600 uppercase">Start Time</label>
                    <input
                      type="time"
                      value={newShiftStart}
                      onChange={(e) => setNewShiftStart(e.target.value)}
                      className="w-full mt-0.5 rounded-lg border border-ds-neutral-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ds-neutral-600 uppercase">End Time</label>
                    <input
                      type="time"
                      value={newShiftEnd}
                      onChange={(e) => setNewShiftEnd(e.target.value)}
                      className="w-full mt-0.5 rounded-lg border border-ds-neutral-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingShift(false)}
                    className="px-3 py-1 rounded-lg border border-ds-neutral-300 bg-white text-xs text-ds-neutral-600 hover:bg-ds-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingShift}
                    onClick={handleCreateInlineShift}
                    className="px-3 py-1 rounded-lg bg-indigo-700 text-white font-bold text-xs hover:bg-indigo-800 flex items-center gap-1 shadow-2xs"
                  >
                    {savingShift && <Spinner className="size-3" />}
                    <span>Save & Use Shift</span>
                  </button>
                </div>
              </div>
            )}

            {/* Shift Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {shifts.map((shift) => {
                const isSelected = selectedShiftCode === shift.code
                return (
                  <div
                    key={shift.code}
                    onClick={() => setSelectedShiftCode(shift.code)}
                    className={`p-3 rounded-xl border cursor-pointer text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600 shadow-2xs'
                        : 'border-ds-neutral-200 bg-white hover:bg-ds-neutral-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-ds-brand-navy">
                          {shift.name}
                        </span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${shift.badgeClass || 'bg-slate-100 text-slate-800'}`}>
                          {shift.code}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-ds-neutral-600 mt-1 block">
                        {shift.timings}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-indigo-700">
                        <Check className="size-3" />
                        <span>Selected Shift</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Step 4: Live Summary Card ── */}
          <div className="rounded-2xl border border-emerald-300/90 bg-emerald-50/80 p-4 space-y-2.5 text-xs shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-950 font-bold">
                <Sparkles className="size-4 text-emerald-700" />
                <span className="text-xs sm:text-sm font-bold">Roster Schedule Execution Preview</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dynamicPolicy.badgeClass}`}>
                {dynamicPolicy.badge}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="rounded-xl bg-white/95 border border-emerald-200/80 p-2 shadow-2xs">
                <span className="text-[10px] font-bold text-ds-neutral-500 uppercase tracking-wider block">Duration</span>
                <span className="text-sm font-extrabold text-ds-brand-navy block mt-0.5">
                  {dateBreakdown?.totalCalendarDays || 0} Days
                </span>
                <span className="text-[10px] text-ds-neutral-500 mt-0.5 block truncate">
                  {startDate} to {endDate}
                </span>
              </div>

              <div className="rounded-xl bg-white/95 border border-emerald-200/80 p-2 shadow-2xs">
                <span className="text-[10px] font-bold text-ds-neutral-500 uppercase tracking-wider block">Working Shifts</span>
                <span className="text-sm font-extrabold text-emerald-800 block mt-0.5">
                  {dateBreakdown?.workingShifts || 0} Shifts
                </span>
                <span className="text-[10px] text-emerald-700 mt-0.5 block">
                  {selectedShiftObj?.code} ({dateBreakdown?.saturdaysWorking || 0} Sats work)
                </span>
              </div>

              <div className="rounded-xl bg-white/95 border border-emerald-200/80 p-2 shadow-2xs">
                <span className="text-[10px] font-bold text-ds-neutral-500 uppercase tracking-wider block">Weekly Offs (WO)</span>
                <span className="text-sm font-extrabold text-amber-800 block mt-0.5">
                  {dateBreakdown?.weeklyOffs || 0} Offs
                </span>
                <span className="text-[10px] text-amber-700 mt-0.5 block">
                  {dateBreakdown?.saturdaysOff || 0} Sats off + Suns off
                </span>
              </div>

              <div className="rounded-xl bg-white/95 border border-emerald-200/80 p-2 shadow-2xs">
                <span className="text-[10px] font-bold text-ds-neutral-500 uppercase tracking-wider block">Employees Targeted</span>
                <span className="text-sm font-extrabold text-indigo-800 block mt-0.5">
                  {targetEmployeesCount} Staff
                </span>
                <span className="text-[10px] text-indigo-700 mt-0.5 block">
                  {((dateBreakdown?.workingShifts || 0) * targetEmployeesCount).toLocaleString()} total assignments
                </span>
              </div>
            </div>

            <div className="pt-1.5 text-[11px] text-emerald-900 border-t border-emerald-200/60 flex items-start gap-1.5 leading-normal">
              <Info className="size-3.5 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                Assigning <strong>{selectedShiftObj?.name} ({selectedShiftObj?.code} • {selectedShiftObj?.timings})</strong> to <strong>{targetEmployeesCount} staff</strong> with <strong>{SATURDAY_RULES.find((r) => r.key === saturdayRule)?.label}</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* ── Fixed Sticky Modal Footer ── */}
        <div className="flex shrink-0 items-center justify-between border-t border-ds-neutral-200 px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-ds-neutral-300 bg-white text-xs font-bold text-ds-neutral-700 hover:bg-ds-neutral-100 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-ds-neutral-500 font-semibold hidden sm:inline-block">
              {targetEmployeesCount} staff selected
            </span>
            <Button
              variant="default"
              size="md"
              disabled={loading || targetEmployeesCount === 0}
              onClick={handleCreateRoster}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-xs"
            >
              {loading ? (
                <>
                  <Spinner className="size-4" />
                  <span>Applying Schedule...</span>
                </>
              ) : (
                <>
                  <CalendarDays className="size-4" />
                  <span>Create & Apply Roster Schedule</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
