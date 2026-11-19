"use client"

import * as React from 'react'
import {
  DrawerWrapper,
  FormField,
  FormFieldInput,
  Select,
  Button,
} from '@hryantra/ui'
import { api } from '@/shared/api'
import { notifyDataChanged } from '@/shared/events'
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Users,
  Building2,
  Sparkles,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'

export interface BulkAssignRosterDrawerProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  selectedEmployeeIds: string[]
  departments: string[]
  totalEmployeesCount: number
}

const PATTERNS = [
  {
    key: 'ALTERNATE_SAT_2ND_4TH',
    label: 'Alternate Saturdays Off (2nd & 4th Sat Off)',
    badge: 'Indian Standard',
    description: '2nd & 4th Saturdays and all Sundays are scheduled offs. 1st, 3rd, 5th Saturdays are active working days.',
    weekendPreview: 'This Weekend: 2nd & 4th Sat OFF, 1st & 3rd Sat WORKING, All Sundays OFF',
  },
  {
    key: 'FIVE_DAY',
    label: 'Complete Weekend Off (5-Day Work Week)',
    badge: 'Sat & Sun Off',
    description: 'Both Saturday and Sunday are complete weekly offs. Standard for software engineering & corporate MNCs.',
    weekendPreview: 'This Weekend: Both Saturday & Sunday are OFF',
  },
  {
    key: 'ALTERNATE_SAT_1ST_3RD',
    label: 'Alternate Saturdays Off (1st & 3rd Sat Off)',
    badge: '1st & 3rd Sat Off',
    description: '1st & 3rd Saturdays and all Sundays are weekly offs. 2nd, 4th, 5th Saturdays are active working days.',
    weekendPreview: 'This Weekend: 1st & 3rd Sat OFF, 2nd & 4th Sat WORKING, All Sundays OFF',
  },
  {
    key: 'SIX_DAY',
    label: '6-Day Work Week (Sunday Only Off)',
    badge: 'Sunday Only Off',
    description: 'All Saturdays are active working days. Only Sundays are scheduled off. Standard for operations & retail.',
    weekendPreview: 'This Weekend: Saturday is WORKING, Sunday is OFF',
  },
  {
    key: 'CUSTOM',
    label: 'Custom Weekly Off Days',
    badge: 'Custom Offs',
    description: 'Define specific days of the week as scheduled offs for shift work or rotating teams.',
    weekendPreview: 'Custom Off Days selected below',
  },
]

const SHIFT_OPTIONS = [
  {
    code: 'GS',
    name: 'General Shift',
    hours: '09:30 AM – 06:30 PM',
    tag: 'Standard Office',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  {
    code: 'MS',
    name: 'Morning Shift',
    hours: '06:00 AM – 02:30 PM',
    tag: 'Early / Site',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    code: 'ES',
    name: 'Evening Shift',
    hours: '02:00 PM – 10:30 PM',
    tag: 'Support / Ops',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  {
    code: 'NS',
    name: 'Night Shift',
    hours: '10:00 PM – 06:30 AM',
    tag: 'Overnight 24/7',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
]

const DAYS_OF_WEEK = [
  { day: 0, label: 'Sun' },
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
]

export function BulkAssignRosterDrawer({
  open,
  onClose,
  onSuccess,
  selectedEmployeeIds,
  departments,
  totalEmployeesCount,
}: BulkAssignRosterDrawerProps) {
  const [scope, setScope] = React.useState<'ALL' | 'DEPARTMENT' | 'SELECTED'>(
    selectedEmployeeIds.length > 0 ? 'SELECTED' : 'ALL'
  )
  const [selectedDept, setSelectedDept] = React.useState<string>(departments[0] || '')
  const [selectedPattern, setSelectedPattern] = React.useState<string>('ALTERNATE_SAT_2ND_4TH')
  const [selectedShift, setSelectedShift] = React.useState<string>('GS')
  const [customDays, setCustomDays] = React.useState<number[]>([0, 6])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [shiftList, setShiftList] = React.useState<any[]>(SHIFT_OPTIONS)

  React.useEffect(() => {
    if (open) {
      api.leaves.getShifts()
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            const valid = res.data.filter((s: any) => s.code !== 'WO')
            if (valid.length > 0) setShiftList(valid)
          }
        })
        .catch(() => {})
    }
  }, [open])

  // Reset or adjust default scope when drawer opens or selection changes
  React.useEffect(() => {
    if (selectedEmployeeIds.length > 0) {
      setScope('SELECTED')
    } else if (scope === 'SELECTED') {
      setScope('ALL')
    }
  }, [selectedEmployeeIds])

  const handleCustomDayToggle = (day: number) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const handleAssign = async () => {
    try {
      setLoading(true)
      setError(null)

      const payload: any = {
        pattern: selectedPattern,
        shiftCode: selectedShift,
        customWeekOffDays: selectedPattern === 'CUSTOM' ? customDays : undefined,
      }

      if (scope === 'SELECTED') {
        if (selectedEmployeeIds.length === 0) {
          setError('Please select at least one employee from the roster grid.')
          setLoading(false)
          return
        }
        payload.employeeIds = selectedEmployeeIds
      } else if (scope === 'DEPARTMENT') {
        if (!selectedDept) {
          setError('Please select a department.')
          setLoading(false)
          return
        }
        payload.department = selectedDept
      } else {
        // ALL
        payload.applyToAll = true
        payload.department = 'ALL'
      }

      const res = await api.leaves.bulkAssignRoster(payload)
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to bulk assign roster')
      }

      notifyDataChanged('roster', { scope, department: selectedDept })
      notifyDataChanged('attendance', { scope, department: selectedDept })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Error occurred while saving roster assignment.')
    } finally {
      setLoading(false)
    }
  }

  const targetCountPreview = React.useMemo(() => {
    if (scope === 'SELECTED') return `${selectedEmployeeIds.length} Selected Employees`
    if (scope === 'DEPARTMENT') return `All Employees in ${selectedDept || 'selected department'}`
    return `All ${totalEmployeesCount} Organization Employees`
  }, [scope, selectedEmployeeIds, selectedDept, totalEmployeesCount])

  const activePatternObj = PATTERNS.find((p) => p.key === selectedPattern) || PATTERNS[0]
  const activeShiftObj = SHIFT_OPTIONS.find((s) => s.code === selectedShift) || SHIFT_OPTIONS[0]

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title="Bulk Assign Roster & Shifts"
      subtitle="Assign weekend work week policies and shift timings in bulk to staff or departments"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading} className="mr-auto">
            Cancel
          </Button>
          <Button variant="default" onClick={handleAssign} disabled={loading}>
            {loading ? 'Assigning Roster...' : 'Apply & Save Schedule'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 text-xs text-ds-neutral-800">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* ── 1. Target Scope Selection ── */}
        <div className="flex flex-col gap-2">
          <label className="text-ds-label font-bold text-ds-brand-navy flex items-center gap-1.5">
            <Users className="size-4 text-ds-brand-navy" />
            <span>1. Target Scope (Who to Assign)</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setScope('ALL')}
              className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                scope === 'ALL'
                  ? 'border-ds-brand-navy bg-ds-brand-navy/5 text-ds-brand-navy font-bold ring-1 ring-ds-brand-navy'
                  : 'border-ds-neutral-200 bg-white text-ds-neutral-600 hover:bg-ds-neutral-50'
              }`}
            >
              <Users className="size-4 mb-1 text-ds-brand-navy" />
              <span className="text-xs">Entire Org</span>
              <span className="text-[10px] text-ds-neutral-400 mt-0.5">All {totalEmployeesCount} Staff</span>
            </button>

            <button
              type="button"
              onClick={() => setScope('DEPARTMENT')}
              className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                scope === 'DEPARTMENT'
                  ? 'border-ds-brand-navy bg-ds-brand-navy/5 text-ds-brand-navy font-bold ring-1 ring-ds-brand-navy'
                  : 'border-ds-neutral-200 bg-white text-ds-neutral-600 hover:bg-ds-neutral-50'
              }`}
            >
              <Building2 className="size-4 mb-1 text-emerald-600" />
              <span className="text-xs">By Department</span>
              <span className="text-[10px] text-ds-neutral-400 mt-0.5">Specific Dept</span>
            </button>

            <button
              type="button"
              onClick={() => setScope('SELECTED')}
              disabled={selectedEmployeeIds.length === 0}
              className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                selectedEmployeeIds.length === 0
                  ? 'opacity-40 cursor-not-allowed border-ds-neutral-200 bg-ds-neutral-100 text-ds-neutral-400'
                  : scope === 'SELECTED'
                  ? 'border-ds-brand-navy bg-ds-brand-navy/5 text-ds-brand-navy font-bold ring-1 ring-ds-brand-navy'
                  : 'border-ds-neutral-200 bg-white text-ds-neutral-600 hover:bg-ds-neutral-50'
              }`}
            >
              <CheckCircle2 className="size-4 mb-1 text-indigo-600" />
              <span className="text-xs">Selected</span>
              <span className="text-[10px] text-ds-neutral-500 mt-0.5 font-bold">
                {selectedEmployeeIds.length} checked
              </span>
            </button>
          </div>

          {scope === 'DEPARTMENT' && (
            <div className="mt-2">
              <FormField label="Select Department" required>
                <FormFieldInput>
                  <Select
                    value={selectedDept}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDept(e.target.value)}
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept} Department
                      </option>
                    ))}
                  </Select>
                </FormFieldInput>
              </FormField>
            </div>
          )}
        </div>

        {/* ── 2. Work Week & Weekend Policy ── */}
        <div className="flex flex-col gap-2">
          <label className="text-ds-label font-bold text-ds-brand-navy flex items-center gap-1.5">
            <CalendarDays className="size-4 text-ds-brand-navy" />
            <span>2. Work Week & Weekend Policy</span>
          </label>
          <div className="flex flex-col gap-1.5">
            {PATTERNS.map((p) => {
              const isSelected = selectedPattern === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelectedPattern(p.key)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-600 shadow-2xs'
                      : 'border-ds-neutral-200 bg-white text-ds-neutral-700 hover:bg-ds-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${
                        isSelected ? 'bg-emerald-600 text-white' : 'border border-ds-neutral-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-xs">{p.label}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ds-neutral-100 text-ds-neutral-600">
                    {p.badge}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedPattern === 'CUSTOM' && (
            <div className="mt-2 rounded-xl border border-ds-neutral-200 bg-ds-neutral-50/80 p-3 space-y-2">
              <span className="text-[11px] font-bold text-ds-brand-navy">Choose Weekly Off Days:</span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((d) => {
                  const isOff = customDays.includes(d.day)
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => handleCustomDayToggle(d.day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isOff
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-white border border-ds-neutral-300 text-ds-neutral-600 hover:bg-ds-neutral-100'
                      }`}
                    >
                      {d.label} {isOff ? '(Off)' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Shift Timings ── */}
        <div className="flex flex-col gap-2">
          <label className="text-ds-label font-bold text-ds-brand-navy flex items-center gap-1.5">
            <Clock className="size-4 text-ds-brand-navy" />
            <span>3. Working Shift Timing</span>
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {shiftList.map((s) => {
              const isSelected = selectedShift === s.code
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setSelectedShift(s.code)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold ring-1 ring-indigo-600 shadow-2xs'
                      : 'border-ds-neutral-200 bg-white text-ds-neutral-700 hover:bg-ds-neutral-50'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs">{s.name}</span>
                    <p className="text-[10px] text-ds-neutral-500 mt-0.5">{s.timings || s.hours}</p>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-ds-neutral-100 text-ds-neutral-700">
                    {s.code}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 4. Impact Summary & Indian Roster Guarantee ── */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs">
            <ShieldCheck className="size-4 text-emerald-700" />
            <span>Schedule Assignment Preview</span>
          </div>
          <div className="space-y-1 text-[11px] text-emerald-900 leading-relaxed">
            <div>
              • <strong>Target:</strong> {targetCountPreview}
            </div>
            <div>
              • <strong>Weekend Model:</strong> {activePatternObj.label}
            </div>
            <div>
              • <strong>Working Shift:</strong> {activeShiftObj.name} ({activeShiftObj.hours})
            </div>
            <div>
              • <strong>Attendance & Leave Effect:</strong> Sundays and scheduled alternate Saturdays will be
              automatically recognized as <strong>Weekly Off (WO)</strong>. Any leaves taken across these dates
              will exclude week-offs from salary/leave balance deduction.
            </div>
          </div>
        </div>
      </div>
    </DrawerWrapper>
  )
}
