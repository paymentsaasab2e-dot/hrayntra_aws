"use client"
import * as React from 'react'
import { FormField, FormFieldInput, Input, Textarea, Button, DrawerWrapper } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { Home, Briefcase, Clock, Calendar, CheckCircle, AlertCircle, Timer } from 'lucide-react'

export type AttendanceModalRequestType = 'WFH' | 'ON_DUTY' | 'REGULARIZATION' | 'SHORT_LEAVE'

interface AttendanceRequestModalProps {
  open: boolean
  onClose: () => void
  defaultType?: AttendanceModalRequestType
}

export function RemoteRequestForm({ open, onClose, defaultType = 'WFH' }: AttendanceRequestModalProps) {
  const { submitRemoteRequest, employees, activeEmployeeId, currentUserRole } = useStore()
  
  const [requestType, setRequestType] = React.useState<AttendanceModalRequestType>(defaultType)
  const [targetEmployeeId, setTargetEmployeeId] = React.useState<string>('')
  
  // WFH Fields
  const [wfhStartDate, setWfhStartDate] = React.useState('')
  const [wfhEndDate, setWfhEndDate] = React.useState('')
  const [wfhLocation, setWfhLocation] = React.useState('Home')
  const [wfhReason, setWfhReason] = React.useState('')

  // On-Duty Fields
  const [odStartDate, setOdStartDate] = React.useState('')
  const [odEndDate, setOdEndDate] = React.useState('')
  const [odClientSite, setOdClientSite] = React.useState('')
  const [odPurpose, setOdPurpose] = React.useState('')

  // Short-Leave Fields
  const [slDate, setSlDate] = React.useState('')
  const [slType, setSlType] = React.useState<'EARLY_EXIT' | 'LATE_ENTRY'>('LATE_ENTRY')
  const [slHours, setSlHours] = React.useState<number>(2)
  const [slTime, setSlTime] = React.useState('11:00')
  const [slReason, setSlReason] = React.useState('')

  // Regularization Fields
  const [regDate, setRegDate] = React.useState('')
  const [regInTime, setRegInTime] = React.useState('09:30')
  const [regOutTime, setRegOutTime] = React.useState('18:30')
  const [regReasonType, setRegReasonType] = React.useState('Forgot Punch')
  const [regRemarks, setRegRemarks] = React.useState('')

  const [submitting, setSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const isHrOrAdmin = currentUserRole === 'HR' || currentUserRole === 'Superadmin' || currentUserRole === 'Manager'

  React.useEffect(() => {
    if (open) {
      setErrorMsg(null)
      setSuccessMsg(null)
      const today = new Date().toISOString().slice(0, 10)
      setWfhStartDate(today)
      setWfhEndDate(today)
      setOdStartDate(today)
      setOdEndDate(today)
      setSlDate(today)
      setRegDate(today)
      if (activeEmployeeId) setTargetEmployeeId(activeEmployeeId)
    }
  }, [open, activeEmployeeId])

  const handleSave = async () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setSubmitting(true)

    try {
      if (requestType === 'WFH') {
        if (!wfhStartDate || !wfhReason) {
          throw new Error('Please select dates and provide a reason for Work From Home.')
        }
        await submitRemoteRequest({
          type: 'WFH',
          startDate: wfhStartDate,
          endDate: wfhEndDate || wfhStartDate,
          date: wfhStartDate,
          location: wfhLocation || 'Home',
          reason: wfhReason,
          purpose: wfhReason,
          employeeId: targetEmployeeId || undefined,
        })
        setSuccessMsg('Work From Home request submitted! Once approved, it will be reflected as WFH in muster roll and attendance calendar.')
      } else if (requestType === 'ON_DUTY') {
        if (!odStartDate || !odClientSite || !odPurpose) {
          throw new Error('Please enter dates, client/site location, and on-duty purpose.')
        }
        await submitRemoteRequest({
          type: 'ON_DUTY',
          startDate: odStartDate,
          endDate: odEndDate || odStartDate,
          date: odStartDate,
          location: odClientSite,
          reason: `On-Duty at ${odClientSite}: ${odPurpose}`,
          purpose: odPurpose,
          employeeId: targetEmployeeId || undefined,
        })
        setSuccessMsg('On-Duty request submitted! Once approved, it will be marked as OD in the muster roll.')
      } else if (requestType === 'SHORT_LEAVE') {
        if (!slDate || !slReason) {
          throw new Error('Please select date and provide reason for Short-Leave permission.')
        }
        await submitRemoteRequest({
          type: 'SHORT_LEAVE',
          startDate: slDate,
          endDate: slDate,
          date: slDate,
          location: slType === 'LATE_ENTRY' ? 'Late Entry Permission' : 'Early Exit Permission',
          reason: `[${slType === 'LATE_ENTRY' ? 'Late Entry' : 'Early Exit'} - ${slHours}h]: ${slReason}`,
          purpose: slReason,
          shortLeaveType: slType,
          shortLeaveHours: slHours,
          employeeId: targetEmployeeId || undefined,
        })
        setSuccessMsg(`Short-Leave permission (${slHours}h ${slType === 'LATE_ENTRY' ? 'Late Arrival' : 'Early Exit'}) submitted! Once approved, it protects you from late penalties or half-day deductions.`)
      } else if (requestType === 'REGULARIZATION') {
        if (!regDate || !regInTime || !regOutTime || !regRemarks) {
          throw new Error('Please select punch date, in/out timings, and regularization reason.')
        }
        await submitRemoteRequest({
          type: 'REGULARIZATION',
          startDate: regDate,
          endDate: regDate,
          date: regDate,
          location: 'Office Regularization',
          reason: `[${regReasonType}] ${regRemarks}`,
          purpose: regRemarks,
          inTime: regInTime,
          outTime: regOutTime,
          employeeId: targetEmployeeId || undefined,
        })
        setSuccessMsg('Attendance Regularization submitted for manager/HR approval.')
      }

      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title="Attendance Requests"
      subtitle="Submit Work From Home, On-Duty, Short-Leave Pass, or Attendance Regularization for approval"
      size="md"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Request Type Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-slate-100 p-1.5 border border-slate-200">
          <button
            type="button"
            onClick={() => { setRequestType('WFH'); setErrorMsg(null); }}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-bold transition-all ${
              requestType === 'WFH'
                ? 'bg-white text-cyan-900 shadow-sm border border-cyan-200 ring-1 ring-cyan-500/20'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Home className="size-4 text-cyan-600 shrink-0" />
            <span>WFH</span>
          </button>

          <button
            type="button"
            onClick={() => { setRequestType('ON_DUTY'); setErrorMsg(null); }}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-bold transition-all ${
              requestType === 'ON_DUTY'
                ? 'bg-white text-indigo-900 shadow-sm border border-indigo-200 ring-1 ring-indigo-500/20'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="size-4 text-indigo-600 shrink-0" />
            <span>On-Duty</span>
          </button>

          <button
            type="button"
            onClick={() => { setRequestType('SHORT_LEAVE'); setErrorMsg(null); }}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-bold transition-all ${
              requestType === 'SHORT_LEAVE'
                ? 'bg-white text-amber-900 shadow-sm border border-amber-200 ring-1 ring-amber-500/20'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Timer className="size-4 text-amber-600 shrink-0" />
            <span>Short-Leave</span>
          </button>

          <button
            type="button"
            onClick={() => { setRequestType('REGULARIZATION'); setErrorMsg(null); }}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-bold transition-all ${
              requestType === 'REGULARIZATION'
                ? 'bg-white text-emerald-900 shadow-sm border border-emerald-200 ring-1 ring-emerald-500/20'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="size-4 text-emerald-600 shrink-0" />
            <span>Regularize</span>
          </button>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-800">
            <AlertCircle className="size-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800">
            <CheckCircle className="size-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Optional Employee Switcher for HR/Admins */}
        {isHrOrAdmin && employees.length > 0 && (
          <FormField label="Applying on behalf of">
            <FormFieldInput>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
              >
                <option value="">Myself</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id})
                  </option>
                ))}
              </select>
            </FormFieldInput>
          </FormField>
        )}

        {/* ── TAB 1: WORK FROM HOME (WFH) ── */}
        {requestType === 'WFH' && (
          <div className="flex flex-col gap-4 rounded-xl border border-cyan-100 bg-cyan-50/30 p-4">
            <div className="flex items-center justify-between border-b border-cyan-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">
                Work From Home Request
              </span>
              <span className="text-[11px] font-semibold text-cyan-600 bg-cyan-100/70 px-2 py-0.5 rounded">
                Counts as Present (WFH)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="From Date" required>
                <FormFieldInput>
                  <Input
                    type="date"
                    value={wfhStartDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setWfhStartDate(e.target.value)
                      if (!wfhEndDate || wfhEndDate < e.target.value) setWfhEndDate(e.target.value)
                    }}
                  />
                </FormFieldInput>
              </FormField>

              <FormField label="To Date" required>
                <FormFieldInput>
                  <Input
                    type="date"
                    value={wfhEndDate}
                    min={wfhStartDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWfhEndDate(e.target.value)}
                  />
                </FormFieldInput>
              </FormField>
            </div>

            <FormField label="Working From Location" required>
              <FormFieldInput>
                <Input
                  placeholder="e.g. Home Office, Mumbai Residence, Native Place"
                  value={wfhLocation}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWfhLocation(e.target.value)}
                />
              </FormFieldInput>
            </FormField>

            <FormField label="Reason for WFH" required>
              <FormFieldInput>
                <Textarea
                  placeholder="Explain reason (e.g., family medical commitment, transit disruption, intense focus on sprint deliverables)..."
                  rows={3}
                  value={wfhReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setWfhReason(e.target.value)}
                />
              </FormFieldInput>
            </FormField>

            <p className="text-[11px] text-cyan-700 bg-cyan-100/50 p-2.5 rounded-lg">
              ℹ️ <strong>Muster Roll Policy:</strong> Approved WFH days are registered with status <strong>WFH</strong> in your attendance muster register and monthly attendance sheet. They count toward payable days and will <strong>never</strong> be marked as absent.
            </p>
          </div>
        )}

        {/* ── TAB 2: ON-DUTY / OUTDOOR DUTY (OD) ── */}
        {requestType === 'ON_DUTY' && (
          <div className="flex flex-col gap-4 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                On-Duty / Outdoor Duty (OD)
              </span>
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded">
                Official Client/Site Visit
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Start Date" required>
                <FormFieldInput>
                  <Input
                    type="date"
                    value={odStartDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setOdStartDate(e.target.value)
                      if (!odEndDate || odEndDate < e.target.value) setOdEndDate(e.target.value)
                    }}
                  />
                </FormFieldInput>
              </FormField>

              <FormField label="End Date" required>
                <FormFieldInput>
                  <Input
                    type="date"
                    value={odEndDate}
                    min={odStartDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOdEndDate(e.target.value)}
                  />
                </FormFieldInput>
              </FormField>
            </div>

            <FormField label="Client / Site Location" required>
              <FormFieldInput>
                <Input
                  placeholder="e.g. Acme Corp Headquarters, Pune Tech Park, Vendor Warehouse"
                  value={odClientSite}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOdClientSite(e.target.value)}
                />
              </FormFieldInput>
            </FormField>

            <FormField label="Duty Purpose" required>
              <FormFieldInput>
                <Textarea
                  placeholder="Explain business purpose (e.g. Client discovery workshop, vendor inspection, statutory authority audit)..."
                  rows={3}
                  value={odPurpose}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOdPurpose(e.target.value)}
                />
              </FormFieldInput>
            </FormField>

            <p className="text-[11px] text-indigo-700 bg-indigo-100/50 p-2.5 rounded-lg">
              ℹ️ <strong>Muster Roll Policy:</strong> Approved On-Duty visits display as <strong>OD</strong> in the muster roll and count as full working days.
            </p>
          </div>
        )}

        {/* ── TAB 3: SHORT-LEAVE / PERMISSION PASS ── */}
        {requestType === 'SHORT_LEAVE' && (
          <div className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Short-Leave / Permission Pass
              </span>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                Max 2 Hours / Pass
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Permission Date" required>
                <FormFieldInput>
                  <Input
                    type="date"
                    value={slDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlDate(e.target.value)}
                  />
                </FormFieldInput>
              </FormField>

              <FormField label="Pass Category" required>
                <FormFieldInput>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-400"
                    value={slType}
                    onChange={(e) => setSlType(e.target.value as 'EARLY_EXIT' | 'LATE_ENTRY')}
                  >
                    <option value="LATE_ENTRY">Late Arrival Permission (Late Entry)</option>
                    <option value="EARLY_EXIT">Early Departure Permission (Early Exit)</option>
                  </select>
                </FormFieldInput>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Duration (Hours)" required>
                <FormFieldInput>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-400"
                    value={slHours}
                    onChange={(e) => setSlHours(parseFloat(e.target.value))}
                  >
                    <option value={1}>1.0 Hour</option>
                    <option value={1.5}>1.5 Hours</option>
                    <option value={2}>2.0 Hours (Maximum Limit)</option>
                  </select>
                </FormFieldInput>
              </FormField>

              <FormField label={slType === 'LATE_ENTRY' ? 'Expected Check-in Time' : 'Planned Exit Time'} required>
                <FormFieldInput>
                  <Input
                    type="time"
                    value={slTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlTime(e.target.value)}
                  />
                </FormFieldInput>
              </FormField>
            </div>

            <FormField label="Reason for Short-Leave" required>
              <FormFieldInput>
                <Textarea
                  placeholder="Explain reason (e.g. Doctor's appointment, urgent bank errand, child school pickup)..."
                  rows={2}
                  value={slReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSlReason(e.target.value)}
                />
              </FormFieldInput>
            </FormField>

            <div className="text-[11px] text-amber-800 bg-amber-100/70 p-2.5 rounded-lg space-y-1">
              <p>⚡ <strong>Late Penalty & Deduction Shield:</strong></p>
              <p>• <strong>Late Arrival:</strong> Exempts you from late arrival marks and protects attendance status as <strong>PRESENT</strong>.</p>
              <p>• <strong>Early Exit:</strong> Prevents half-day attendance penalties on early departure.</p>
              <p>• <strong>Quota:</strong> Standard quota is 2 short-leaves per calendar month (max 2h each).</p>
            </div>
          </div>
        )}

        {/* ── TAB 4: ATTENDANCE REGULARIZATION ── */}
        {requestType === 'REGULARIZATION' && (
          <div className="flex flex-col gap-4 rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Attendance Regularization
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-100/70 px-2 py-0.5 rounded">
                Punches Adjustment
              </span>
            </div>

            <FormField label="Punch Date" required>
              <FormFieldInput>
                <Input
                  type="date"
                  value={regDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegDate(e.target.value)}
                />
              </FormFieldInput>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Requested In Time" required>
                <FormFieldInput>
                  <Input
                    type="time"
                    value={regInTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegInTime(e.target.value)}
                  />
                </FormFieldInput>
              </FormField>

              <FormField label="Requested Out Time" required>
                <FormFieldInput>
                  <Input
                    type="time"
                    value={regOutTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegOutTime(e.target.value)}
                  />
                </FormFieldInput>
              </FormField>
            </div>

            <FormField label="Reason Category" required>
              <FormFieldInput>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                  value={regReasonType}
                  onChange={(e) => setRegReasonType(e.target.value)}
                >
                  <option value="Forgot Punch">Forgot to punch in/out</option>
                  <option value="Biometric Glitch">Biometric device / machine error</option>
                  <option value="Mobile App GPS Error">Mobile punch GPS mismatch</option>
                  <option value="Meeting at Shift Start">Client meeting during punch window</option>
                  <option value="Power/Network Outage">Office network / power outage</option>
                </select>
              </FormFieldInput>
            </FormField>

            <FormField label="Detailed Explanation" required>
              <FormFieldInput>
                <Textarea
                  placeholder="Provide supporting details for your manager to review..."
                  rows={2}
                  value={regRemarks}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRegRemarks(e.target.value)}
                />
              </FormFieldInput>
            </FormField>
          </div>
        )}
      </div>
    </DrawerWrapper>
  )
}

export const AttendanceRequestModal = RemoteRequestForm
