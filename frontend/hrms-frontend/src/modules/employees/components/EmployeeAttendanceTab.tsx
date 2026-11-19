import * as React from 'react'
import { AttendanceLogsTable } from '../../attendance/components/AttendanceLogsTable'
import { useStore } from '@/store/StoreProvider'
import { SectionCard } from '@hryantra/ui'
import { Laptop, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { api } from '@/shared/api'

interface EmployeeAttendanceTabProps {
  employeeId: string
}

export function EmployeeAttendanceTab({ employeeId }: EmployeeAttendanceTabProps) {
  const { attendanceRecords, currentUserRole, hasAction } = useStore()
  const canEdit = currentUserRole === 'HR' || currentUserRole === 'Superadmin' || currentUserRole === 'Manager' || hasAction('employees_edit')

  const [webPunchAllowed, setWebPunchAllowed] = React.useState<boolean>(true)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [updating, setUpdating] = React.useState<boolean>(false)
  const [toast, setToast] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    api.attendance.getWebPunchPermission(employeeId)
      .then((res: any) => {
        if (mounted && res?.data) {
          setWebPunchAllowed(Boolean(res.data.allowed))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [employeeId])

  const handleToggle = async () => {
    if (!canEdit || updating) return
    const nextState = !webPunchAllowed
    setWebPunchAllowed(nextState)
    setUpdating(true)
    setToast(null)

    try {
      await api.attendance.setWebPunchPermission({
        employeeId,
        allowed: nextState,
      })
      setToast(`Web Clock-In ${nextState ? 'ENABLED' : 'RESTRICTED'} for this employee`)
      setTimeout(() => setToast(null), 3000)
    } catch {
      setWebPunchAllowed(!nextState)
      setToast('Failed to update permission')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setUpdating(false)
    }
  }

  const userLogs = React.useMemo(() => {
    return attendanceRecords.filter(r => r.employeeId === employeeId)
  }, [attendanceRecords, employeeId])

  return (
    <div className="flex flex-col gap-5">
      {/* Policy & Permissions Card */}
      <SectionCard title="Web Clock-In Access & Punch Policy">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-1">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5 border border-purple-200">
              <Laptop className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  Browser Web Punch Permission
                </h4>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                  webPunchAllowed
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  <span className={`size-1.5 rounded-full ${webPunchAllowed ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {loading ? 'Checking...' : webPunchAllowed ? 'Allowed' : 'Restricted'}
                </span>
                {toast && (
                  <span className="text-xs font-semibold text-purple-700 animate-in fade-in">
                    {toast}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Allow this employee to punch daily attendance, lunch, and tea breaks directly from their web browser on authorized office IP or GPS radius.
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2.5 shrink-0 sm:self-center">
              <button
                type="button"
                role="switch"
                aria-checked={webPunchAllowed}
                disabled={updating || loading}
                onClick={handleToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                  webPunchAllowed ? 'bg-purple-600' : 'bg-slate-300'
                }`}
                title={`Click to ${webPunchAllowed ? 'restrict' : 'enable'} web clock-in`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    webPunchAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-semibold text-slate-700">
                {webPunchAllowed ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Attendance Logs">
        <AttendanceLogsTable records={userLogs} />
      </SectionCard>
    </div>
  )
}
