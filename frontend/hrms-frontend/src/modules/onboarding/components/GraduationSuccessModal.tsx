"use client"

import * as React from 'react'
import { Button } from '@hryantra/ui'
import { GraduationCap, CheckCircle2, Copy, Check, Eye, EyeOff, User, Key, ExternalLink, Mail, Sparkles, X } from 'lucide-react'

export interface GraduationData {
  hire?: any
  employee?: {
    id: string
    employeeId: string
    name: string
    firstName?: string
    lastName?: string
    email: string
    department: string
    designation: string
    joiningDate?: string
    status?: string
  }
  user?: {
    id: string
    email: string
    role: string
    displayName?: string
    status?: string
  }
  credentials?: {
    email: string
    password?: string | null
    role?: string
    isNewUser?: boolean
    emailSent?: boolean
    message?: string
  }
}

type Props = {
  open: boolean
  data: GraduationData | null
  onClose: () => void
  onViewEmployee?: (employeeCode: string) => void
  onViewUser?: () => void
}

export function GraduationSuccessModal({ open, data, onClose, onViewEmployee, onViewUser }: Props) {
  const [copied, setCopied] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  if (!open || !data) return null

  const emp = data.employee
  const user = data.user
  const creds = data.credentials
  const employeeCode = emp?.employeeId || data.hire?.employeeId || 'EMP'
  const employeeName = emp?.name || data.hire?.name || 'New Employee'
  const email = creds?.email || emp?.email || data.hire?.email || ''
  const password = creds?.password || ''

  const handleCopyCredentials = () => {
    const text = `HRMS Login Credentials\nEmployee: ${employeeName} (${employeeCode})\nEmail: ${email}\nPassword: ${password}\nRole: ${creds?.role || user?.role || 'EMPLOYEE'}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl p-6 md:p-8 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-lg text-ds-neutral-400 hover:text-ds-neutral-700 hover:bg-ds-neutral-100 transition-colors"
        >
          <X className="size-5" />
        </button>

        {/* Celebration Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <GraduationCap className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Sparkles className="size-3" /> 1-Click Graduation Complete
              </span>
            </div>
            <h2 className="text-xl font-bold text-ds-brand-navy mt-1">
              {employeeName} Graduated!
            </h2>
            <p className="text-ds-body-sm text-ds-neutral-500 mt-0.5">
              Candidate transitioned to permanent Employee and User login account provisioned.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Card 1: Employee Record */}
          <div className="rounded-xl border border-ds-neutral-200 bg-ds-neutral-50/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-ds-brand-navy/10 flex items-center justify-center text-ds-brand-navy">
                  <User className="size-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-ds-brand-navy">Permanent Employee Record</span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-ds-brand-navy text-white">
                {employeeCode}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-ds-neutral-500">Designation:</span>
                <p className="font-semibold text-ds-brand-navy truncate">{emp?.designation || data.hire?.role || 'Staff'}</p>
              </div>
              <div>
                <span className="text-ds-neutral-500">Department:</span>
                <p className="font-semibold text-ds-brand-navy truncate">{emp?.department || data.hire?.department || 'General'}</p>
              </div>
            </div>
            {onViewEmployee && (
              <div className="mt-3 pt-3 border-t border-ds-neutral-200/80 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewEmployee(employeeCode)}
                  className="text-xs h-8"
                >
                  <ExternalLink className="size-3.5 mr-1.5" />
                  View Employee Profile
                </Button>
              </div>
            )}
          </div>

          {/* Card 2: User Login Credentials */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-emerald-600/10 flex items-center justify-center text-emerald-700">
                  <Key className="size-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">User Login Credentials</span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                {creds?.role || user?.role || 'EMPLOYEE'}
              </span>
            </div>

            <div className="space-y-2 mt-3">
              <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-emerald-200/80 text-xs">
                <span className="text-ds-neutral-500 font-medium">Login Email:</span>
                <span className="font-mono font-semibold text-ds-brand-navy select-all">{email}</span>
              </div>

              {password ? (
                <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-emerald-200/80 text-xs">
                  <span className="text-ds-neutral-500 font-medium">Temporary Password:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-ds-brand-navy select-all">
                      {showPassword ? password : '••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-ds-neutral-400 hover:text-ds-neutral-700 p-0.5"
                    >
                      {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-2.5 border border-emerald-200/80 text-xs text-ds-neutral-600">
                  {creds?.message || 'Existing user account linked successfully.'}
                </div>
              )}
            </div>

            {/* Email dispatch alert */}
            <div className="mt-3 flex items-center justify-between text-xs text-emerald-800 bg-emerald-100/60 rounded-lg p-2">
              <div className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-emerald-700" />
                <span>
                  {creds?.emailSent
                    ? 'Welcome email with login instructions dispatched via Resend.'
                    : 'Credentials generated and ready to share with candidate.'}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-emerald-200/80 flex items-center justify-between">
              {onViewUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewUser}
                  className="text-xs h-8 text-emerald-800 hover:text-emerald-900"
                >
                  <ExternalLink className="size-3.5 mr-1" />
                  Users Console
                </Button>
              )}
              {password && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCopyCredentials}
                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 ml-auto"
                >
                  {copied ? <Check className="size-3.5 mr-1.5" /> : <Copy className="size-3.5 mr-1.5" />}
                  {copied ? 'Copied to Clipboard!' : 'Copy Credentials'}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="default" onClick={onClose} className="px-6">
            <CheckCircle2 className="size-4 mr-1.5" />
            Done
          </Button>
        </div>
      </div>
    </>
  )
}
