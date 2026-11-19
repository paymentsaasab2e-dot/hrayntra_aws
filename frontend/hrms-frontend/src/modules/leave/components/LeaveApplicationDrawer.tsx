"use client"
import * as React from 'react'
import { DrawerWrapper, FormField, FormFieldInput, Input, Select, Textarea, Button, FormGrid } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { LeaveType } from '../types'
import { CalendarDays, Info, ShieldCheck } from 'lucide-react'

interface LeaveApplicationDrawerProps {
  open: boolean
  onClose: () => void
}

export function LeaveApplicationDrawer({ open, onClose }: LeaveApplicationDrawerProps) {
  const { applyForLeave } = useStore()
  
  const [type, setType] = React.useState<LeaveType | ''>('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [workWeekPattern, setWorkWeekPattern] = React.useState<string>('ALTERNATE_SAT_2ND_4TH')
  const [customOffDays, setCustomOffDays] = React.useState<number[]>([0, 6])
  const [rosterSummaryLabel, setRosterSummaryLabel] = React.useState<string>('Alternate Saturdays Off (2nd & 4th Sat)')

  // Fetch tenant work week configuration when drawer opens
  React.useEffect(() => {
    if (open) {
      api.leaves.getWorkWeekRoster()
        .then((res) => {
          if (res?.success && res.data) {
            if (res.data.workWeek?.pattern) setWorkWeekPattern(res.data.workWeek.pattern)
            if (Array.isArray(res.data.workWeek?.customWeekOffDays)) setCustomOffDays(res.data.workWeek.customWeekOffDays)
            if (res.data.currentOption?.label) setRosterSummaryLabel(res.data.currentOption.label)
          }
        })
        .catch(() => {})
    }
  }, [open])

  const dateCalculation = React.useMemo(() => {
    if (!startDate || !endDate) return null
    const d1 = new Date(startDate)
    const d2 = new Date(endDate)
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return null

    let workingDays = 0
    let weekOffs = 0
    let totalCalendarDays = 0
    const offDayDescriptions: string[] = []
    const cursor = new Date(d1)
    const ordinals = ['1st', '2nd', '3rd', '4th', '5th']

    while (cursor <= d2) {
      totalCalendarDays += 1
      const day = cursor.getDay()
      let isOff = false
      let offLabel = ''

      if (workWeekPattern === 'FIVE_DAY') {
        if (day === 0) { isOff = true; offLabel = `Sun (${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` }
        else if (day === 6) { isOff = true; offLabel = `Sat (${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` }
      } else if (workWeekPattern === 'SIX_DAY') {
        if (day === 0) { isOff = true; offLabel = `Sun (${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` }
      } else if (workWeekPattern === 'ALTERNATE_SAT_2ND_4TH') {
        if (day === 0) { isOff = true; offLabel = `Sun (${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` }
        else if (day === 6) {
          const occ = Math.ceil(cursor.getDate() / 7)
          if (occ === 2 || occ === 4) {
            isOff = true
            offLabel = `${ordinals[occ - 1]} Sat (${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
          }
        }
      } else if (workWeekPattern === 'ALTERNATE_SAT_1ST_3RD') {
        if (day === 0) { isOff = true; offLabel = `Sun (${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` }
        else if (day === 6) {
          const occ = Math.ceil(cursor.getDate() / 7)
          if (occ === 1 || occ === 3) {
            isOff = true
            offLabel = `${ordinals[occ - 1]} Sat (${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
          }
        }
      } else if (workWeekPattern === 'CUSTOM') {
        if (customOffDays.includes(day)) {
          isOff = true
          offLabel = `${cursor.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
        }
      } else {
        if (day === 0) { isOff = true; offLabel = `Sun (${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` }
        else if (day === 6) {
          const occ = Math.ceil(cursor.getDate() / 7)
          if (occ === 2 || occ === 4) {
            isOff = true
            offLabel = `${ordinals[occ - 1]} Sat (${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
          }
        }
      }

      if (isOff) {
        weekOffs += 1
        if (offLabel) offDayDescriptions.push(offLabel)
      } else {
        workingDays += 1
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    return {
      totalCalendarDays,
      workingDays: Math.max(1, workingDays),
      weekOffs,
      offDayDescriptions,
    }
  }, [startDate, endDate, workWeekPattern, customOffDays])

  const handleSave = () => {
    if (!type || !startDate || !endDate || !reason) return

    const appliedDays = dateCalculation?.workingDays ?? 1

    applyForLeave({
      type: type as LeaveType,
      startDate,
      endDate,
      totalDays: appliedDays,
      reason,
    })

    // Reset and close
    setType('')
    setStartDate('')
    setEndDate('')
    setReason('')
    onClose()
  }

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title="Apply for Leave"
      subtitle="Submit your time off request for approval"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="mr-auto">Cancel</Button>
          <Button variant="default" onClick={handleSave}>Submit Request</Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField label="Leave Type" required>
          <FormFieldInput>
            <Select value={type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setType(e.target.value as LeaveType)}>
              <option value="">Select Type</option>
              <option value="Casual">Casual Leave (CL)</option>
              <option value="Sick">Sick Leave (SL)</option>
              <option value="Earned">Earned Leave (EL)</option>
              <option value="Maternity">Maternity Leave (26 Weeks)</option>
              <option value="Paternity">Paternity Leave (15 Days)</option>
              <option value="Unpaid">Unpaid Leave</option>
            </Select>
          </FormFieldInput>
        </FormField>

        {type === 'Maternity' && (
          <div className="p-3 bg-pink-50 border border-pink-200 text-pink-900 rounded-xl text-xs space-y-1 shadow-2xs">
            <div className="font-bold flex items-center gap-1.5 text-pink-800">
              <ShieldCheck className="size-4 text-pink-600" />
              Indian Maternity Benefit (Amendment) Act 2017 Rules
            </div>
            <p className="text-[11px] leading-relaxed text-pink-800">
              • Maximum statutory entitlement: <strong>26 weeks (182 calendar days)</strong> for eligible female employees.<br />
              • Section 5(2) Statutory Requirement: Minimum <strong>80 days worked</strong> in the preceding 12 months.<br />
              • Full statutory salary protection applies during approved period.
            </p>
          </div>
        )}

        {type === 'Paternity' && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs space-y-1 shadow-2xs">
            <div className="font-bold flex items-center gap-1.5 text-blue-800">
              <ShieldCheck className="size-4 text-blue-600" />
              Paternity Leave Policy
            </div>
            <p className="text-[11px] leading-relaxed text-blue-800">
              • Entitlement: Up to <strong>15 calendar days</strong> for male employees upon childbirth/adoption.
            </p>
          </div>
        )}

        {type === 'Earned' && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1 shadow-2xs">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <Info className="size-4 text-amber-600" />
              Earned Leave (EL) Probation Policy
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              • Earned leave becomes accessible upon completing the mandatory 6-month probation period (180 days from joining).
            </p>
          </div>
        )}
        
        <FormGrid cols={2}>
          <FormField label="Start Date" required>
            <FormFieldInput>
              <Input type="date" value={startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)} />
            </FormFieldInput>
          </FormField>
          <FormField label="End Date" required>
            <FormFieldInput>
              <Input type="date" value={endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)} />
            </FormFieldInput>
          </FormField>
        </FormGrid>

        {dateCalculation && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 text-xs space-y-2.5 shadow-2xs">
            <div className="flex justify-between items-center text-emerald-950">
              <span className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-600" />
                Applied Leave Working Days:
              </span>
              <span className="font-extrabold text-sm bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-md border border-emerald-300">
                {dateCalculation.workingDays} Working Day{dateCalculation.workingDays !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/60">
              <span className="font-semibold text-emerald-900">Schedule Policy:</span>
              <span className="font-bold bg-white/80 px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-900">
                {rosterSummaryLabel}
              </span>
            </div>

            {dateCalculation.weekOffs > 0 ? (
              <div className="space-y-1.5 pt-1">
                <p className="text-emerald-900 text-[11px] leading-relaxed">
                  🏖️ <strong>{dateCalculation.weekOffs} scheduled week-off{dateCalculation.weekOffs !== 1 ? 's' : ''} excluded</strong> from balance deduction ({dateCalculation.totalCalendarDays} calendar days total):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dateCalculation.offDayDescriptions.map((desc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 shadow-2xs"
                    >
                      {desc}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-emerald-700 text-[11px]">
                Standard working days applied ({dateCalculation.totalCalendarDays} calendar day{dateCalculation.totalCalendarDays !== 1 ? 's' : ''}). No week-offs fall within this range.
              </p>
            )}
          </div>
        )}

        <FormField label="Reason" required>
          <FormFieldInput>
            <Textarea placeholder="Please provide details..." rows={4} value={reason} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)} />
          </FormFieldInput>
        </FormField>

        {/* Attachment mocked UI */}
        <div className="flex flex-col gap-2">
            <span className="text-ds-label text-ds-neutral-900 font-medium font-semibold">Attachments (Optional)</span>
            <div className="border border-dashed border-ds-neutral-300 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-ds-neutral-50/50 cursor-pointer hover:bg-ds-neutral-50">
               <span className="text-ds-body-sm text-ds-brand-navy font-medium">Click to upload</span>
               <span className="text-ds-caption text-ds-neutral-500 mt-1">Medical certificates or other supporting documents</span>
            </div>
        </div>
      </div>
    </DrawerWrapper>
  )
}
