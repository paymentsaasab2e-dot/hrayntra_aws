"use client"

import * as React from 'react'
import { Button } from '@hryantra/ui'
import {
  X,
  FileEdit,
  Building2,
  UserRound,
  MapPin,
  Calendar,
  Send,
  CheckCircle2,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
} from 'lucide-react'
import { Employee, ChangeRequestCategory, CustomFieldDefinitionItem } from '../types'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import { notifyDataChanged } from '@/shared/events'

interface EmployeeChangeRequestDrawerProps {
  employee: Employee
  isOpen: boolean
  onClose: () => void
  onSubmitted?: () => void
}

export function EmployeeChangeRequestDrawer({
  employee,
  isOpen,
  onClose,
  onSubmitted,
}: EmployeeChangeRequestDrawerProps) {
  const { currentUserRole } = useStore()
  const isHROrAdmin = currentUserRole === 'HR' || currentUserRole === 'Superadmin' || currentUserRole === 'Manager'

  const [category, setCategory] = React.useState<ChangeRequestCategory>('JOB_ROLE')
  const [effectiveDate, setEffectiveDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Field Values
  const [jobForm, setJobForm] = React.useState({
    designation: employee.designation || '',
    department: employee.department || '',
  })

  const [personalForm, setPersonalForm] = React.useState({
    name: employee.name || '',
    phone: '',
  })

  // Custom Fields Schema & Form State
  const [customFieldDefs, setCustomFieldDefs] = React.useState<CustomFieldDefinitionItem[]>([])
  const [customForm, setCustomForm] = React.useState<Record<string, any>>({})

  // Synchronize when employee changes or drawer opens
  React.useEffect(() => {
    if (employee) {
      setJobForm({
        designation: employee.designation || '',
        department: employee.department || '',
      })
      setPersonalForm({
        name: employee.name || '',
        phone: '',
      })
      const currentCustoms = (employee.customFields as Record<string, any>) || {}
      setCustomForm({ ...currentCustoms })
    }
  }, [employee])

  React.useEffect(() => {
    if (isOpen) {
      api.customFields.list(false)
        .then((res: any) => {
          if (Array.isArray(res?.data)) {
            setCustomFieldDefs(res.data)
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const changes: Record<string, { oldValue: any; newValue: any }> = {}

      if (category === 'JOB_ROLE') {
        if (jobForm.designation !== employee.designation) {
          changes.designation = { oldValue: employee.designation, newValue: jobForm.designation }
        }
        if (jobForm.department !== employee.department) {
          changes.department = { oldValue: employee.department, newValue: jobForm.department }
        }
      } else if (category === 'PERSONAL_INFO') {
        if (personalForm.name && personalForm.name !== employee.name) {
          const parts = personalForm.name.trim().split(' ')
          const fName = parts[0]
          const lName = parts.slice(1).join(' ') || ''
          changes.firstName = { oldValue: employee.name.split(' ')[0], newValue: fName }
          if (lName) {
            changes.lastName = { oldValue: employee.name.split(' ').slice(1).join(' '), newValue: lName }
          }
        }
        if (personalForm.phone) {
          changes.phone = { oldValue: '', newValue: personalForm.phone }
        }
      } else if (category === 'CUSTOM_FIELDS') {
        const currentCustoms = (employee.customFields as Record<string, any>) || {}
        for (const def of customFieldDefs) {
          const oldVal = currentCustoms[def.key] ?? ''
          const newVal = customForm[def.key] ?? ''
          if (String(newVal).trim() !== String(oldVal).trim()) {
            changes[def.key] = {
              oldValue: oldVal === '' ? null : oldVal,
              newValue: newVal === '' ? null : newVal,
            }
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        throw new Error('Please modify at least one field to submit a change request.')
      }

      const empDbId = employee.recordId || employee.id
      await api.employees.submitChangeRequest(empDbId, {
        category,
        effectiveDate,
        reason: reason.trim(),
        changes,
      })

      setSuccessMsg('Change request submitted successfully for HR approval!')
      notifyDataChanged('employees', { employeeId: empDbId, action: 'CHANGE_REQUESTED' })
      notifyDataChanged('approvals', { action: 'NEW_REQUEST' })

      setTimeout(() => {
        onSubmitted?.()
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err?.message || 'Failed to submit change request')
    } finally {
      setSubmitting(false)
    }
  }

  const currentCustoms = (employee.customFields as Record<string, any>) || {}

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileEdit className="size-5 text-purple-600" />
              Request Profile Change
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Target: <strong className="text-slate-800">{employee.name}</strong> ({employee.id})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/30 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategory('JOB_ROLE')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              category === 'JOB_ROLE'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="size-4" />
            Job & Role
          </button>
          <button
            type="button"
            onClick={() => setCategory('PERSONAL_INFO')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              category === 'PERSONAL_INFO'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserRound className="size-4" />
            Personal Info
          </button>
          <button
            type="button"
            onClick={() => setCategory('CUSTOM_FIELDS')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              category === 'CUSTOM_FIELDS'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SlidersHorizontal className="size-4" />
            Custom Attributes
          </button>
        </div>

        {/* Drawer Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-100 flex items-start gap-2.5 text-xs text-purple-900">
            <ShieldCheck className="size-4 text-purple-600 shrink-0 mt-0.5" />
            <span>
              All requested changes undergo HR / SuperAdmin verification. Approved updates will immediately apply to
              the employee record.
            </span>
          </div>

          {/* Effective Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="size-3.5 text-purple-600" />
              Proposed Effective Date
            </label>
            <input
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Specify when this transition or update takes effect.</p>
          </div>

          {/* Job & Role Fields */}
          {category === 'JOB_ROLE' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Designation</span>
                <p className="text-xs font-bold text-slate-700 mt-0.5">{employee.designation}</p>

                <label className="block text-xs font-bold text-slate-900 mt-3 mb-1">Proposed Designation</label>
                <input
                  type="text"
                  required
                  value={jobForm.designation}
                  onChange={(e) => setJobForm({ ...jobForm, designation: e.target.value })}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Department</span>
                <p className="text-xs font-bold text-slate-700 mt-0.5">{employee.department}</p>

                <label className="block text-xs font-bold text-slate-900 mt-3 mb-1">Proposed Department</label>
                <input
                  type="text"
                  required
                  value={jobForm.department}
                  onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                  placeholder="e.g. Platform Engineering"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* Personal Info Fields */}
          {category === 'PERSONAL_INFO' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Full Name</span>
                <p className="text-xs font-bold text-slate-700 mt-0.5">{employee.name}</p>

                <label className="block text-xs font-bold text-slate-900 mt-3 mb-1">Updated Name (if legal change)</label>
                <input
                  type="text"
                  value={personalForm.name}
                  onChange={(e) => setPersonalForm({ ...personalForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone Number</span>
                <label className="block text-xs font-bold text-slate-900 mt-1 mb-1">Updated Contact Phone</label>
                <input
                  type="tel"
                  value={personalForm.phone}
                  onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {category === 'CUSTOM_FIELDS' && (
            <div className="flex flex-col gap-4">
              {customFieldDefs.length === 0 ? (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                  No active custom fields configured yet in Settings.
                </div>
              ) : (
                customFieldDefs.map((def) => {
                  const currentVal = currentCustoms[def.key] ?? 'Not specified'

                  return (
                    <div key={def.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {def.label}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Current: <strong className="text-slate-700">{String(currentVal)}</strong>
                        </span>
                      </div>

                      <label className="block text-xs font-bold text-slate-900 mt-2 mb-1">
                        Proposed Value
                      </label>

                      {def.type === 'SELECT' ? (
                        <select
                          value={customForm[def.key] ?? ''}
                          onChange={(e) => setCustomForm({ ...customForm, [def.key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Select an option</option>
                          {def.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : def.type === 'DATE' ? (
                        <input
                          type="date"
                          value={customForm[def.key] ?? ''}
                          onChange={(e) => setCustomForm({ ...customForm, [def.key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                        />
                      ) : def.type === 'NUMBER' ? (
                        <input
                          type="number"
                          value={customForm[def.key] ?? ''}
                          onChange={(e) => setCustomForm({ ...customForm, [def.key]: e.target.value })}
                          placeholder={def.placeholder || `Enter ${def.label}`}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                        />
                      ) : def.type === 'TEXTAREA' ? (
                        <textarea
                          rows={2}
                          value={customForm[def.key] ?? ''}
                          onChange={(e) => setCustomForm({ ...customForm, [def.key]: e.target.value })}
                          placeholder={def.placeholder || `Enter ${def.label}`}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={customForm[def.key] ?? ''}
                          onChange={(e) => setCustomForm({ ...customForm, [def.key]: e.target.value })}
                          placeholder={def.placeholder || `Enter ${def.label}`}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                        />
                      )}

                      {def.description && (
                        <p className="text-[11px] text-slate-400 mt-1">{def.description}</p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Justification Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Request (Mandatory)</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the background for this change (e.g. Promotion appraisal, transfer to new office, legal update)..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 mt-auto pt-6 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2"
            >
              <Send className="size-3.5" />
              {submitting ? 'Submitting...' : 'Send for HR Approval'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
