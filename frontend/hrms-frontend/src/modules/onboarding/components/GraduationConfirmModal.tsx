"use client"

import * as React from 'react'
import { Button, Input, Select } from '@hryantra/ui'
import { GraduationCap, CheckCircle2, User, Key, Mail, Sparkles, X, RefreshCw } from 'lucide-react'

type Props = {
  open: boolean
  hire: any | null
  onClose: () => void
  onConfirm: (options: {
    createLogin: boolean
    password: string
    role: string
    sendWelcomeEmail: boolean
  }) => Promise<void>
}

function generateRandomPassword() {
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `Welcome@${rand}`
}

export function GraduationConfirmModal({ open, hire, onClose, onConfirm }: Props) {
  const [createLogin, setCreateLogin] = React.useState(true)
  const [role, setRole] = React.useState('EMPLOYEE')
  const [password, setPassword] = React.useState('')
  const [sendWelcomeEmail, setSendWelcomeEmail] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setPassword(generateRandomPassword())
      setCreateLogin(true)
      setRole('EMPLOYEE')
      setSendWelcomeEmail(true)
      setError('')
      setLoading(false)
    }
  }, [open, hire])

  if (!open || !hire) return null

  const handleGraduate = async () => {
    setLoading(true)
    setError('')
    try {
      await onConfirm({
        createLogin,
        password: password.trim(),
        role,
        sendWelcomeEmail,
      })
    } catch (err: any) {
      setError(err?.message || 'Graduation failed. Please check details.')
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl p-6 md:p-7 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-lg text-ds-neutral-400 hover:text-ds-neutral-700 hover:bg-ds-neutral-100 transition-colors"
        >
          <X className="size-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="size-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1">
              <Sparkles className="size-3" /> 1-Click Graduation
            </div>
            <h2 className="text-lg font-bold text-ds-brand-navy">
              Graduate to Employee + User
            </h2>
            <p className="text-xs text-ds-neutral-500">
              Transform <span className="font-semibold text-ds-brand-navy">{hire.name}</span> into a permanent employee with login credentials.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Candidate Info Pill */}
        <div className="rounded-xl border border-ds-neutral-200 bg-ds-neutral-50 p-3.5 mb-4 text-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-ds-brand-navy text-sm">{hire.name}</span>
            <span className="text-ds-neutral-500 font-mono text-[11px]">{hire.email || 'No email provided'}</span>
          </div>
          <div className="text-ds-neutral-600 flex items-center gap-2">
            <span>{hire.role}</span>
            <span>•</span>
            <span>{hire.department}</span>
            {hire.compensation?.anchorValue && (
              <>
                <span>•</span>
                <span className="font-semibold text-emerald-700">
                  CTC {hire.compensation.currencyCode || 'INR'} {Number(hire.compensation.anchorValue).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* What happens automated checklist */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 mb-4 text-xs space-y-1.5">
          <div className="font-bold text-emerald-900 mb-1">Automated in this graduation:</div>
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
            <span>Generates permanent Employee Code and registers official profile</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
            <span>Creates User login account and attaches role & permissions</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
            <span>Binds attached CTC salary breakdown to employee record</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
            <span>Marks all onboarding tasks complete (100% progress)</span>
          </div>
        </div>

        {/* Login Account Options */}
        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-ds-brand-navy select-none">
            <input
              type="checkbox"
              checked={createLogin}
              onChange={(e) => setCreateLogin(e.target.checked)}
              className="size-4 rounded border-ds-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span>Create system User login account for this employee</span>
          </label>

          {createLogin && (
            <div className="rounded-xl border border-ds-neutral-200 bg-white p-3 space-y-3 animate-in fade-in duration-100">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-ds-neutral-500 font-medium mb-1">User Role</label>
                  <Select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full text-xs h-9"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="HR">HR</option>
                    <option value="MANAGER">Manager</option>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-ds-neutral-500 font-medium">Temporary Password</label>
                    <button
                      type="button"
                      onClick={() => setPassword(generateRandomPassword())}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <RefreshCw className="size-2.5" /> New
                    </button>
                  </div>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-ds-neutral-600 select-none pt-1">
                <input
                  type="checkbox"
                  checked={sendWelcomeEmail}
                  onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                  className="size-3.5 rounded border-ds-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-ds-neutral-400" />
                  Email welcome note and login credentials to candidate
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-50">
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleGraduate}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 shadow-xs"
          >
            <GraduationCap className="size-3.5 mr-1.5" />
            {loading ? 'Graduating…' : 'Graduate Now (1-Click)'}
          </Button>
        </div>
      </div>
    </>
  )
}
