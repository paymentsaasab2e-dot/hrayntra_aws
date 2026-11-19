"use client"
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeroBanner, SectionCard, Button, FormField, FormFieldInput, Input, Select, Textarea, FormGrid } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { Building2, CalendarDays, Clock, Target, ShieldCheck, Save, Check, Banknote, Layers, SlidersHorizontal, FileCode2 } from 'lucide-react'
import { ComplianceProfileEditor } from '@/modules/compensation/components/ComplianceProfileEditor'
import { MasterDataManagement } from '@/modules/org/components/MasterDataManagement'
import { CustomFieldsSettings } from '@/modules/employees/components/CustomFieldsSettings'
import { TemplatesHub } from '@/modules/templates/components/TemplatesHub'

type SettingsTab = 'templates' | 'master-data' | 'organization' | 'custom-fields' | 'leave' | 'attendance' | 'performance' | 'salary' | 'roles'

export default function SettingsPage() {
  const { hasTab } = useStore()
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('templates')

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'templates' || tab === 'template') setActiveTab('templates')
    if (tab === 'salary' || tab === 'payroll') setActiveTab('salary')
    if (tab === 'master-data' || tab === 'master') setActiveTab('master-data')
    if (tab === 'organization') setActiveTab('organization')
    if (tab === 'custom-fields' || tab === 'customfields') setActiveTab('custom-fields')
  }, [])
  const [isSaving, setIsSaving] = React.useState(false)
  const [showSuccess, setShowSuccess] = React.useState(false)
  const [policyRules, setPolicyRules] = React.useState<any>(null)

  React.useEffect(() => {
    if (!hasTab('settings')) return
    api.policies.getActive()
      .then((res) => setPolicyRules(res?.data?.rules || null))
      .catch(() => undefined)
  }, [hasTab])

  const patchRules = (patch: any) => {
    setPolicyRules((prev: any) => ({
      ...prev,
      leave: { ...prev?.leave, ...(patch.leave || {}) },
      workWeek: { ...prev?.workWeek, ...(patch.workWeek || {}) },
      attendance: { ...prev?.attendance, ...(patch.attendance || {}) },
      overtime: { ...prev?.overtime, ...(patch.overtime || {}) },
      exit: { ...prev?.exit, ...(patch.exit || {}) },
      departmentPolicies: patch.departmentPolicies !== undefined ? patch.departmentPolicies : prev?.departmentPolicies,
    }))
  }

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  if (!hasTab('settings')) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-ds-neutral-50">
        <ShieldCheck className="size-16 text-ds-neutral-200 mb-4" />
        <h3 className="text-ds-heading text-ds-brand-navy">Settings Restricted</h3>
        <p className="text-ds-body text-ds-neutral-500 max-w-md">System configuration and organization settings are restricted to HR and Administrators.</p>
      </div>
    )
  }

  const handleSave = async () => {
    if (!policyRules) {
      alert('Policy rules are still loading. Try again in a moment.')
      return
    }
    setIsSaving(true)
    try {
      await api.policies.updateActive(policyRules)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const tabs = [
    { id: 'templates', label: 'HR Setup Templates', icon: FileCode2 },
    { id: 'master-data', label: 'Master Data', icon: Layers },
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'custom-fields', label: 'Custom Fields', icon: SlidersHorizontal },
    { id: 'leave', label: 'Leave', icon: CalendarDays },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'performance', label: 'Performance', icon: Target },
    { id: 'salary', label: 'Salary & CTC', icon: Banknote },
    { id: 'roles', label: 'Roles', icon: ShieldCheck },
  ]

  return (
    <div className="flex flex-col h-full space-y-5 w-full max-w-[1600px] mx-auto px-4 py-5 md:px-6 md:py-6 pb-10">
      <PageHeroBanner
        compact
        eyebrow={dateEyebrow}
        title="Settings & Configuration"
        description="Manage system-wide rules, company policies, and organizational preferences."
        actions={
          activeTab === 'leave' || activeTab === 'attendance' ? (
            <Button variant="default" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : showSuccess ? <><Check className="size-4" /> Saved</> : <><Save className="size-4" /> Save Changes</>}
            </Button>
          ) : activeTab === 'roles' ? (
            <Button variant="default" onClick={() => (window.location.href = '/users')}>
              Manage users
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">
        {/* Compact sidebar — narrow so content card gets more width */}
        <aside className="w-full lg:w-[168px] xl:w-[180px] shrink-0">
          <SectionCard noPadding bodyClassName="p-1.5">
            <nav className="flex flex-row lg:flex-col gap-0.5 overflow-x-auto lg:overflow-x-visible">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap lg:whitespace-normal lg:w-full border ${
                    activeTab === tab.id 
                      ? 'bg-[#111827] !text-white border-[#111827] shadow-sm [&_svg]:!text-white' 
                      : 'text-[#64748b] border-transparent hover:bg-[#f1f5f9] hover:text-[#111827] hover:border-[#e2e8f0]'
                  }`}
                >
                  <tab.icon className="size-3.5 shrink-0" />
                  <span className="text-left leading-tight">{tab.label}</span>
                </button>
              ))}
            </nav>
          </SectionCard>
        </aside>

        {/* Wider content area */}
        <div className="flex-1 min-w-0 w-full">
          <SectionCard bodyClassName="p-4 md:p-6">
            {activeTab === 'templates' && <TemplatesHub />}
            {activeTab === 'master-data' && <MasterDataManagement />}
            {activeTab === 'organization' && <OrganizationSettings onNavigateMasterData={() => setActiveTab('master-data')} />}
            {activeTab === 'custom-fields' && <CustomFieldsSettings />}
            {activeTab === 'leave' && <LeaveSettings rules={policyRules} onChange={patchRules} />}
            {activeTab === 'attendance' && <AttendanceSettings rules={policyRules} onChange={patchRules} />}
            {activeTab === 'performance' && <PerformanceSettings />}
            {activeTab === 'salary' && (
              <div className="space-y-4">
                <div className="pb-4 border-b border-ds-neutral-100">
                  <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">Salary & CTC templates</h3>
                  <p className="text-ds-body-sm text-ds-neutral-500 mt-1 max-w-3xl leading-relaxed">
                    Define how offered CTC splits into Basic, HRA, PF, and other components for onboarding and employee records in HRMS.
                    Payroll processing stays in your separate payroll application.
                  </p>
                </div>
                <ComplianceProfileEditor />
              </div>
            )}
            {activeTab === 'roles' && <RoleSettings />}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function OrganizationSettings({ onNavigateMasterData }: { onNavigateMasterData?: () => void }) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-ds-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">Organization Settings</h3>
          <p className="text-ds-body-xs text-ds-neutral-500 mt-0.5">
            Basic company profile and core organizational metadata.
          </p>
        </div>
        {onNavigateMasterData && (
          <Button variant="outline" size="sm" onClick={onNavigateMasterData} className="gap-2">
            <Layers className="size-3.5 text-indigo-600" />
            <span>Master Data Repository</span>
          </Button>
        )}
      </div>

      {/* Master Data Highlight Banner */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
            <Layers className="size-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Enterprise Master Data Available</h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Standardize Departments, Designations, Grades & Bands, and Cost Centres with live employee counting.
            </p>
          </div>
        </div>
        {onNavigateMasterData && (
          <Button variant="default" size="sm" onClick={onNavigateMasterData} className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white">
            Open Master Data
          </Button>
        )}
      </div>
      
      <FormGrid cols={2}>
        <FormField label="Company Name">
          <FormFieldInput>
            <Input defaultValue="Framework Corp" />
          </FormFieldInput>
        </FormField>
        <FormField label="Website">
          <FormFieldInput>
            <Input defaultValue="https://framework.com" />
          </FormFieldInput>
        </FormField>
        <FormField label="Tax ID / Registration">
          <FormFieldInput>
            <Input defaultValue="TX-992-110" />
          </FormFieldInput>
        </FormField>
        <FormField label="Primary Currency">
          <FormFieldInput>
            <Select defaultValue="USD">
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </Select>
          </FormFieldInput>
        </FormField>
        <FormField label="Timezone">
          <FormFieldInput>
            <Select defaultValue="GMT-5">
              <option value="GMT-5">EST (GMT-5)</option>
              <option value="GMT+0">UTC (GMT+0)</option>
              <option value="GMT+5.5">IST (GMT+5.5)</option>
            </Select>
          </FormFieldInput>
        </FormField>
      </FormGrid>
      
      <FormField label="Company Address">
        <FormFieldInput>
          <Textarea rows={3} defaultValue="101 Innovation Way, Tech District, San Francisco, CA 94105" />
        </FormFieldInput>
      </FormField>
    </div>
  )
}

function LeaveSettings({ rules, onChange }: { rules: any; onChange: (patch: any) => void }) {
  if (!rules) return <p className="text-sm text-ds-neutral-500">Loading policy...</p>

  const workWeekPattern = rules.workWeek?.pattern || 'FIVE_DAY'
  const customDays: number[] = rules.workWeek?.customWeekOffDays || [0, 6]
  const excludeWeekends = rules.leave?.excludeWeekendsFromLeave ?? true
  const sandwichRule = rules.leave?.sandwichLeaveRule ?? false

  // Compute live Saturday roster for current month
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const saturdays: { date: number; occurrence: number; isOff: boolean; label: string }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(year, month, d)
    if (curDate.getDay() === 6) {
      const occurrence = Math.ceil(d / 7)
      let isOff = false
      if (workWeekPattern === 'FIVE_DAY') isOff = true
      else if (workWeekPattern === 'SIX_DAY') isOff = false
      else if (workWeekPattern === 'ALTERNATE_SAT_2ND_4TH') isOff = (occurrence === 2 || occurrence === 4)
      else if (workWeekPattern === 'ALTERNATE_SAT_1ST_3RD') isOff = (occurrence === 1 || occurrence === 3)
      else if (workWeekPattern === 'CUSTOM') isOff = customDays.includes(6)

      const ordinals = ['1st', '2nd', '3rd', '4th', '5th']
      saturdays.push({
        date: d,
        occurrence,
        isOff,
        label: `${ordinals[occurrence - 1] || `${occurrence}th`} Saturday`,
      })
    }
  }

  const daysOfWeek = [
    { day: 0, label: 'Sunday' },
    { day: 1, label: 'Monday' },
    { day: 2, label: 'Tuesday' },
    { day: 3, label: 'Wednesday' },
    { day: 4, label: 'Thursday' },
    { day: 5, label: 'Friday' },
    { day: 6, label: 'Saturday' },
  ]

  const handleDayToggle = (day: number) => {
    const next = customDays.includes(day)
      ? customDays.filter((d) => d !== day)
      : [...customDays, day]
    onChange({ workWeek: { customWeekOffDays: next } })
  }

  return (
    <div className="space-y-8">
      {/* ── Section 1: Work Week & Weekend Off Configuration ── */}
      <div>
        <div className="pb-3 border-b border-ds-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">Work Week & Weekend Roster Policy</h3>
            <p className="text-ds-body-xs text-ds-neutral-500 mt-0.5">
              Configure complete weekend offs, alternate Saturdays, or 6-day roster. Synced with leave calculations and attendance.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <FormField label="Work Week Pattern">
            <FormFieldInput>
              <Select
                value={workWeekPattern}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({ workWeek: { pattern: e.target.value } })}
              >
                <option value="FIVE_DAY">Complete Weekend Off (5-Day Week: Saturday & Sunday Off)</option>
                <option value="ALTERNATE_SAT_2ND_4TH">Alternate Saturdays Off (2nd & 4th Saturday Off) — Indian Corporate & Banking Standard</option>
                <option value="ALTERNATE_SAT_1ST_3RD">Alternate Saturdays Off (1st & 3rd Saturday Off)</option>
                <option value="SIX_DAY">6-Day Work Week (Only Sunday Off — All Saturdays Working)</option>
                <option value="CUSTOM">Custom Weekly Off Days</option>
              </Select>
            </FormFieldInput>
          </FormField>

          {workWeekPattern === 'CUSTOM' && (
            <div className="bg-ds-neutral-50 p-4 rounded-xl border border-ds-neutral-200 space-y-2">
              <label className="text-ds-caption font-bold text-ds-neutral-700 block">Select Weekly Off Days</label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(({ day, label }) => {
                  const isChecked = customDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayToggle(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isChecked
                          ? 'bg-ds-brand-navy text-white border-ds-brand-navy shadow-xs'
                          : 'bg-white text-ds-neutral-700 border-ds-neutral-300 hover:bg-ds-neutral-100'
                      }`}
                    >
                      {label} {isChecked ? '✓' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Saturday Roster Live Preview Card */}
          <div className="bg-gradient-to-r from-ds-neutral-50 to-ds-neutral-100/60 p-4 rounded-xl border border-ds-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ds-brand-navy uppercase tracking-wider flex items-center gap-1.5">
                📅 Current Month Roster Preview ({monthName})
              </span>
              <span className="text-[11px] text-ds-neutral-500">
                {workWeekPattern === 'ALTERNATE_SAT_2ND_4TH'
                  ? '2nd & 4th Sat = Off • 1st, 3rd, 5th Sat = Working'
                  : workWeekPattern === 'ALTERNATE_SAT_1ST_3RD'
                  ? '1st & 3rd Sat = Off • 2nd, 4th, 5th Sat = Working'
                  : workWeekPattern === 'FIVE_DAY'
                  ? 'All Saturdays = Off'
                  : 'All Saturdays = Working'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {saturdays.map((sat) => (
                <div
                  key={sat.date}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    sat.isOff
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                      : 'bg-white border-ds-neutral-200 text-ds-neutral-700 shadow-2xs'
                  }`}
                >
                  <div className="text-[11px] font-bold">{sat.label}</div>
                  <div className="text-xs font-extrabold mt-0.5">
                    {monthName.slice(0, 3)} {sat.date}
                  </div>
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      sat.isOff
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-ds-neutral-100 text-ds-neutral-600'
                    }`}
                  >
                    {sat.isOff ? '🏖️ Week Off' : '💼 Working'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Leave Deduction & Week-off Rules */}
          <div className="pt-2 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-ds-neutral-200">
              <input
                type="checkbox"
                id="excludeWeekends"
                checked={excludeWeekends}
                onChange={(e) => onChange({ leave: { excludeWeekendsFromLeave: e.target.checked } })}
                className="mt-0.5 size-4 rounded border-ds-neutral-300 text-ds-brand-navy focus:ring-ds-brand-navy"
              />
              <label htmlFor="excludeWeekends" className="text-xs text-ds-neutral-700 cursor-pointer">
                <span className="font-bold text-ds-brand-navy block">Exclude Scheduled Weekends & Alternate Off-Saturdays from Leave Deduction</span>
                When checked, if an employee applies leave from Friday to Monday, only working days are deducted from their paid leave quota (Sundays and scheduled Off-Saturdays are not consumed).
              </label>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-ds-neutral-200">
              <input
                type="checkbox"
                id="sandwichRule"
                checked={sandwichRule}
                onChange={(e) => onChange({ leave: { sandwichLeaveRule: e.target.checked } })}
                className="mt-0.5 size-4 rounded border-ds-neutral-300 text-ds-brand-navy focus:ring-ds-brand-navy"
              />
              <label htmlFor="sandwichRule" className="text-xs text-ds-neutral-700 cursor-pointer">
                <span className="font-bold text-ds-brand-navy block">Enforce Sandwich Leave Policy</span>
                If active, when an employee takes leave on both the working day before and after a weekend (e.g. Friday and Monday), intervening week-offs are also counted as leave days.
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Statutory Leave Quotas & Limits ── */}
      <div>
        <div className="pb-3 border-b border-ds-neutral-100">
          <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">Annual Statutory Leave Entitlements</h3>
          <p className="text-ds-body-xs text-ds-neutral-500 mt-0.5">Annual paid leave quotas (Casual, Sick, Earned/Privilege) and notice constraints.</p>
        </div>

        <FormGrid cols={2} className="mt-4">
          <FormField label="Annual Sick Leave (Days)">
            <FormFieldInput>
              <Input type="number" value={rules.leave?.annualSickLeave ?? 12} onChange={(e) => onChange({ leave: { annualSickLeave: Number(e.target.value) } })} />
            </FormFieldInput>
          </FormField>
          <FormField label="Annual Casual Leave (Days)">
            <FormFieldInput>
              <Input type="number" value={rules.leave?.annualCasualLeave ?? 15} onChange={(e) => onChange({ leave: { annualCasualLeave: Number(e.target.value) } })} />
            </FormFieldInput>
          </FormField>
          <FormField label="Annual Earned / Privilege Leave (Days)">
            <FormFieldInput>
              <Input type="number" value={rules.leave?.annualEarnedLeave ?? 12} onChange={(e) => onChange({ leave: { annualEarnedLeave: Number(e.target.value) } })} />
            </FormFieldInput>
          </FormField>
          <FormField label="Carry Forward Limit (Days)">
            <FormFieldInput>
              <Input type="number" value={rules.leave?.carryForwardLimit ?? 5} onChange={(e) => onChange({ leave: { carryForwardLimit: Number(e.target.value) } })} />
            </FormFieldInput>
          </FormField>
          <FormField label="Advance Notice for Leave (Days)">
            <FormFieldInput>
              <Input type="number" value={rules.leave?.leaveAdvanceNoticeDays ?? 3} onChange={(e) => onChange({ leave: { leaveAdvanceNoticeDays: Number(e.target.value) } })} />
            </FormFieldInput>
          </FormField>
          <FormField label="Max Consecutive Leave (Days)">
            <FormFieldInput>
              <Input type="number" value={rules.leave?.maxConsecutiveLeaveDays ?? 15} onChange={(e) => onChange({ leave: { maxConsecutiveLeaveDays: Number(e.target.value) } })} />
            </FormFieldInput>
          </FormField>
        </FormGrid>
      </div>
    </div>
  )
}

function AttendanceSettings({ rules, onChange }: { rules: any; onChange: (patch: any) => void }) {
  if (!rules) return <p className="text-sm text-ds-neutral-500">Loading policy...</p>
  const att = rules.attendance || {}
  const ot = rules.overtime || {}
  const deptPolicies = rules.departmentPolicies || {}

  const [selectedDept, setSelectedDept] = React.useState('Sales')

  const currentDeptPolicy = deptPolicies[selectedDept] || {
    isFlexiHours: false,
    gracePeriodMinutes: att.gracePeriodMinutes || 15,
    flexiMinHoursPerDay: 8,
  }

  const handleUpdateDeptPolicy = (field: string, val: any) => {
    const updated = {
      ...deptPolicies,
      [selectedDept]: {
        ...currentDeptPolicy,
        [field]: val,
      },
    }
    onChange({ departmentPolicies: updated })
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-ds-neutral-100">
        <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">Attendance & Shift Policies</h3>
        <p className="text-ds-body-xs text-ds-neutral-500 mt-0.5">
          Configure general shifts, flexi-hours, overtime accrual, comp-off credits, short-leaves, and department-specific rules.
        </p>
      </div>

      {/* ── SECTION 1: STANDARD SHIFT TIMINGS ── */}
      <div>
        <h4 className="text-sm font-bold text-ds-brand-navy mb-1">Standard Shift Hours & Punctuality</h4>
        <p className="text-xs text-ds-neutral-500 mb-4">Default working schedule for employees on standard general shift.</p>
        <FormGrid cols={2}>
          <FormField label="Standard Shift Start">
            <FormFieldInput>
              <Input value={att.workStartTime || '09:30'} onChange={(e) => onChange({ attendance: { workStartTime: e.target.value } })} />
            </FormFieldInput>
          </FormField>
          <FormField label="Standard Shift End">
            <FormFieldInput>
              <Input value={att.workEndTime || '18:30'} onChange={(e) => onChange({ attendance: { workEndTime: e.target.value } })} />
            </FormFieldInput>
          </FormField>
          <FormField label="Late Arrival Grace (Minutes)">
            <FormFieldInput>
              <Input type="number" value={att.gracePeriodMinutes ?? 15} onChange={(e) => onChange({ attendance: { gracePeriodMinutes: Number(e.target.value) } })} />
            </FormFieldInput>
          </FormField>
          <FormField label="Half-day Threshold (Hours)">
            <FormFieldInput>
              <Input type="number" value={att.halfDayThresholdHours ?? 4} onChange={(e) => onChange({ attendance: { halfDayThresholdHours: Number(e.target.value) } })} />
            </FormFieldInput>
          </FormField>
        </FormGrid>
      </div>

      {/* ── SECTION 2: FLEXI-HOURS POLICY (ROW 3) ── */}
      <div className="pt-4 border-t border-ds-neutral-100">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-ds-brand-navy">Flexi-Hours & Flexible Punch Window</h4>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
            {att.isFlexiHours ? 'FLEXI ENABLED' : 'FIXED SHIFTS'}
          </span>
        </div>
        <p className="text-xs text-ds-neutral-500 mb-4">
          Allows employees to punch in flexibly within a wide arrival window without late marks. Total net duration must meet the minimum hours.
        </p>

        <FormGrid cols={2}>
          <FormField label="Flexi Hours Mode">
            <FormFieldInput>
              <Select
                value={att.isFlexiHours ? 'ENABLED' : 'DISABLED'}
                onChange={(e) => onChange({ attendance: { isFlexiHours: e.target.value === 'ENABLED' } })}
              >
                <option value="DISABLED">Disabled (Strict shift arrival timings & late marks apply)</option>
                <option value="ENABLED">Enabled (Flexible arrival window without late marks)</option>
              </Select>
            </FormFieldInput>
          </FormField>

          <FormField label="Minimum Required Net Working Hours">
            <FormFieldInput>
              <Input
                type="number"
                min="4"
                max="12"
                step="0.5"
                value={att.flexiMinHoursPerDay ?? 8}
                onChange={(e) => onChange({ attendance: { flexiMinHoursPerDay: Number(e.target.value) } })}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Flexi Arrival Window Start">
            <FormFieldInput>
              <Input
                type="time"
                value={att.flexiWindowStartTime || '08:00'}
                onChange={(e) => onChange({ attendance: { flexiWindowStartTime: e.target.value } })}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Flexi Window End (Latest Checkout)">
            <FormFieldInput>
              <Input
                type="time"
                value={att.flexiWindowEndTime || '20:00'}
                onChange={(e) => onChange({ attendance: { flexiWindowEndTime: e.target.value } })}
              />
            </FormFieldInput>
          </FormField>
        </FormGrid>
      </div>

      {/* ── SECTION 3: OVERTIME & COMP-OFF RULES (ROW 5) ── */}
      <div className="pt-4 border-t border-ds-neutral-100">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-ds-brand-navy">Overtime (OT) & Off-Day Comp-Off</h4>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
            {ot.enabled ? 'OT ACCRUAL ACTIVE' : 'OT DISABLED'}
          </span>
        </div>
        <p className="text-xs text-ds-neutral-500 mb-4">
          Calculate overtime hours beyond scheduled shift and automatically award Comp-Off credit for work on Weekly Offs or Public Holidays.
        </p>

        <FormGrid cols={2}>
          <FormField label="Overtime Calculation">
            <FormFieldInput>
              <Select
                value={ot.enabled ? 'ENABLED' : 'DISABLED'}
                onChange={(e) => onChange({ overtime: { enabled: e.target.value === 'ENABLED' } })}
              >
                <option value="ENABLED">Enabled (Track overtime beyond shift duration)</option>
                <option value="DISABLED">Disabled (Do not track overtime)</option>
              </Select>
            </FormFieldInput>
          </FormField>

          <FormField label="Minimum Extra Minutes for OT to Accrue">
            <FormFieldInput>
              <Input
                type="number"
                min="15"
                max="180"
                step="15"
                value={ot.minimumOtMinutes ?? 60}
                onChange={(e) => onChange({ overtime: { minimumOtMinutes: Number(e.target.value) } })}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Daily Overtime Cap (Hours)">
            <FormFieldInput>
              <Input
                type="number"
                min="1"
                max="8"
                value={ot.dailyMaxOtHours ?? 4}
                onChange={(e) => onChange({ overtime: { dailyMaxOtHours: Number(e.target.value) } })}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Comp-Off for Weekly Off / Holiday Work">
            <FormFieldInput>
              <Select
                value={ot.enableCompOffForOffDayWork !== false ? 'ENABLED' : 'DISABLED'}
                onChange={(e) => onChange({ overtime: { enableCompOffForOffDayWork: e.target.value === 'ENABLED' } })}
              >
                <option value="ENABLED">Enabled (&ge;4h = 0.5 Day, &ge;7h = 1.0 Day Comp-Off)</option>
                <option value="DISABLED">Disabled</option>
              </Select>
            </FormFieldInput>
          </FormField>
        </FormGrid>
      </div>

      {/* ── SECTION 4: SHORT-LEAVE & PERMISSION PASS (ROW 6) ── */}
      <div className="pt-4 border-t border-ds-neutral-100">
        <h4 className="text-sm font-bold text-ds-brand-navy mb-1">Short-Leave & Permission Pass Policy</h4>
        <p className="text-xs text-ds-neutral-500 mb-4">
          Governs partial leaves (up to 2h) for late entry or early departure without salary deduction.
        </p>

        <FormGrid cols={2}>
          <FormField label="Max Hours Allowed Per Short-Leave Pass">
            <FormFieldInput>
              <Input
                type="number"
                min="1"
                max="4"
                step="0.5"
                value={att.maxShortLeaveHours ?? 2}
                onChange={(e) => onChange({ attendance: { maxShortLeaveHours: Number(e.target.value) } })}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Monthly Short-Leave Pass Quota">
            <FormFieldInput>
              <Input
                type="number"
                min="0"
                max="10"
                value={att.monthlyShortLeaveQuota ?? 2}
                onChange={(e) => onChange({ attendance: { monthlyShortLeaveQuota: Number(e.target.value) } })}
              />
            </FormFieldInput>
          </FormField>
        </FormGrid>
      </div>

      {/* ── SECTION 5: DEPARTMENT & GROUP ATTENDANCE RULES (ROW 4) ── */}
      <div className="pt-4 border-t border-ds-neutral-100">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-ds-brand-navy">Department Attendance Policies (Group Overrides)</h4>
          <span className="text-xs font-semibold text-ds-neutral-500">Override defaults per department</span>
        </div>
        <p className="text-xs text-ds-neutral-500 mb-4">
          Assign customized flexi-hours and grace policies to specific department groups (e.g. Sales, Engineering, Operations).
        </p>

        <div className="rounded-xl border border-ds-neutral-200 bg-ds-neutral-50/50 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Select Department:</span>
            {['Sales', 'Engineering', 'Operations', 'Customer Support'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDept(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDept === d
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <FormGrid cols={3}>
            <FormField label={`${selectedDept} Flexi-Hours`}>
              <FormFieldInput>
                <Select
                  value={currentDeptPolicy.isFlexiHours ? 'ENABLED' : 'DISABLED'}
                  onChange={(e) => handleUpdateDeptPolicy('isFlexiHours', e.target.value === 'ENABLED')}
                >
                  <option value="DISABLED">Inherit Standard Shift</option>
                  <option value="ENABLED">Flexi-Hours Enabled</option>
                </Select>
              </FormFieldInput>
            </FormField>

            <FormField label={`${selectedDept} Grace Period (Mins)`}>
              <FormFieldInput>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  value={currentDeptPolicy.gracePeriodMinutes ?? 15}
                  onChange={(e) => handleUpdateDeptPolicy('gracePeriodMinutes', Number(e.target.value))}
                />
              </FormFieldInput>
            </FormField>

            <FormField label={`${selectedDept} Min Required Hours`}>
              <FormFieldInput>
                <Input
                  type="number"
                  min="4"
                  max="12"
                  step="0.5"
                  value={currentDeptPolicy.flexiMinHoursPerDay ?? 8}
                  onChange={(e) => handleUpdateDeptPolicy('flexiMinHoursPerDay', Number(e.target.value))}
                />
              </FormFieldInput>
            </FormField>
          </FormGrid>
        </div>
      </div>

      {/* ── SECTION 6: AUTO-CHECKOUT & CLOSURE (ROW 7) ── */}
      <div className="pt-4 border-t border-ds-neutral-100">
        <h4 className="text-sm font-bold text-ds-brand-navy mb-1">Auto Check-Out & Tolerance Quota</h4>
        <p className="text-xs text-ds-neutral-500 mb-4">
          Automate closure of dangling punches while preventing employees from exploiting machine-side checkouts.
        </p>

        <FormGrid cols={2}>
          <FormField label="Monthly Free Auto-Checkouts (Tolerance Quota)">
            <FormFieldInput>
              <Input
                type="number"
                min="0"
                max="10"
                value={att.monthlyAutoCheckoutQuota ?? 2}
                onChange={(e) => onChange({ attendance: { monthlyAutoCheckoutQuota: Number(e.target.value) } })}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Auto Check-Out Buffer (Minutes after shift end)">
            <FormFieldInput>
              <Input
                type="number"
                min="15"
                max="240"
                value={att.autoCheckoutBufferMinutes ?? 60}
                onChange={(e) => onChange({ attendance: { autoCheckoutBufferMinutes: Number(e.target.value) } })}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Action when Quota Exceeded (3rd missing checkout)">
            <FormFieldInput>
              <Select
                value={att.penaltyAfterQuotaExceeded || 'REQUIRE_REGULARIZATION'}
                onChange={(e) => onChange({ attendance: { penaltyAfterQuotaExceeded: e.target.value } })}
              >
                <option value="REQUIRE_REGULARIZATION">Require Regularization Approval (Lock as Half-Day)</option>
                <option value="HALFDAY">Mark Half-Day Automatically</option>
                <option value="MARK_ABSENT">Mark Absent Automatically</option>
              </Select>
            </FormFieldInput>
          </FormField>

          <FormField label="Missing-Punch In-App Reminders">
            <FormFieldInput>
              <Select
                value={att.enableMissingPunchReminders !== false ? 'ENABLED' : 'DISABLED'}
                onChange={(e) => onChange({ attendance: { enableMissingPunchReminders: e.target.value === 'ENABLED' } })}
              >
                <option value="ENABLED">Enabled (Nudge at shift start + 15m & shift end + 15m)</option>
                <option value="DISABLED">Disabled</option>
              </Select>
            </FormFieldInput>
          </FormField>

          <FormField label="Auto-Mark Absent for Unclocked Employees">
            <FormFieldInput>
              <Select
                value={att.autoMarkAbsentUnclocked !== false ? 'ENABLED' : 'DISABLED'}
                onChange={(e) => onChange({ attendance: { autoMarkAbsentUnclocked: e.target.value === 'ENABLED' } })}
              >
                <option value="ENABLED">Enabled (Mark unclocked staff Absent at shift end/EOD)</option>
                <option value="DISABLED">Disabled (Keep as Unmarked)</option>
              </Select>
            </FormFieldInput>
          </FormField>
        </FormGrid>
      </div>
    </div>
  )
}

function PerformanceSettings() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-ds-neutral-100">
        <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">Performance Configuration</h3>
        <p className="text-ds-body-xs text-ds-neutral-500 mt-0.5">
          Review cycle defaults (display only — manage live reviews in the Performance tab).
        </p>
      </div>

      <FormGrid cols={2}>
        <FormField label="Review Frequency">
          <FormFieldInput>
            <Select defaultValue="Quarterly">
              <option value="Quarterly">Quarterly</option>
              <option value="Biannual">Bi-Annual</option>
              <option value="Yearly">Yearly</option>
            </Select>
          </FormFieldInput>
        </FormField>
        <FormField label="Rating Scale">
          <FormFieldInput>
            <Select defaultValue="5">
              <option value="3">1 - 3 (Simple)</option>
              <option value="5">1 - 5 (Standard)</option>
              <option value="10">1 - 10 (Detailed)</option>
            </Select>
          </FormFieldInput>
        </FormField>
      </FormGrid>

      <div className="space-y-4">
         <h4 className="text-[11px] font-bold text-ds-neutral-400 uppercase tracking-wider">Score Weights</h4>
         <div className="space-y-4 bg-ds-neutral-50 p-5 rounded-xl border border-ds-neutral-200">
            {[
              { label: 'Task Completion', weight: '40%' },
              { label: 'Attendance & Punctuality', weight: '20%' },
              { label: 'Manager Subjective Feedback', weight: '30%' },
              { label: 'Peer Feedback', weight: '10%' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-ds-body-sm text-ds-neutral-700">{item.label}</span>
                <span className="text-ds-body-sm font-bold text-ds-brand-navy">{item.weight}</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  )
}

function RoleSettings() {
  const router = useRouter()
  const roles = [
    { id: 1, name: 'Super Admin', desc: 'Full system access — configure in Users', members: 2 },
    { id: 2, name: 'HR Manager', desc: 'Employee, Leave, and Assets access', members: 5 },
    { id: 3, name: 'Team Lead / Manager', desc: 'Team tasks, attendance, and approvals', members: 12 },
    { id: 4, name: 'Employee', desc: 'Self-service portal access only', members: 84 },
  ]

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-ds-neutral-100 flex justify-between items-end">
        <div>
          <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">Roles & Permissions</h3>
          <p className="text-ds-body-xs text-ds-neutral-500 mt-0.5">
            Permissions are managed per user in the Users tab.{' '}
            <Link href="/users" className="font-semibold text-ds-brand-navy underline">Open Users</Link>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/users')}>
          Manage users
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {roles.map(role => (
          <div key={role.id} className="p-4 border border-ds-neutral-200 rounded-xl hover:border-ds-brand-green/50 hover:bg-ds-neutral-50/50 transition-all group flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-ds-brand-navy/5 text-ds-brand-navy flex items-center justify-center font-bold">
                  {role.members}
                </div>
                <div>
                  <h4 className="text-ds-body-sm font-bold text-ds-brand-navy">{role.name}</h4>
                  <p className="text-ds-caption text-ds-neutral-500">{role.desc}</p>
                </div>
             </div>
             <Button variant="outline" size="sm" onClick={() => router.push('/users')}>
               Edit Permissions
             </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
