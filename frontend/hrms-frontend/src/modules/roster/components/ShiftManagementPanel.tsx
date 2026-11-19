"use client"

import * as React from 'react'
import {
  Button,
  Input,
  Select,
  Spinner,
} from '@hryantra/ui'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  X,
  Sparkles,
} from 'lucide-react'

export type ShiftCategory = 'GENERAL' | 'NIGHT' | 'ROTATIONAL' | 'SPLIT';

export interface ShiftItem {
  code: string
  name: string
  shortLabel?: string
  timings: string
  color: string
  badgeClass: string
  category?: ShiftCategory
  startTime?: string
  endTime?: string
  firstSlotStartTime?: string
  firstSlotEndTime?: string
  secondSlotStartTime?: string
  secondSlotEndTime?: string
  rotationCycleDays?: number
  gracePeriodMinutes?: number
  halfDayHours?: number
  isCustom?: boolean
}

const COLOR_PRESETS = [
  { label: 'Slate (Standard)', color: '#0f172a', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' },
  { label: 'Cyan / Split', color: '#0891b2', badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { label: 'Blue / Sky', color: '#0284c7', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300' },
  { label: 'Amber / Orange', color: '#d97706', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  { label: 'Purple / Violet', color: '#7c3aed', badgeClass: 'bg-purple-100 text-purple-800 border-purple-300' },
  { label: 'Emerald / Green', color: '#059669', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { label: 'Indigo / Navy', color: '#4338ca', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { label: 'Rose / Red', color: '#e11d48', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' },
]

export function ShiftManagementPanel() {
  const { currentUserRole, hasTab } = useStore()
  const canManage =
    currentUserRole === 'HR' ||
    currentUserRole === 'Superadmin' ||
    currentUserRole === 'PlatformOwner' ||
    hasTab('settings')

  const [shifts, setShifts] = React.useState<ShiftItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingShift, setEditingShift] = React.useState<ShiftItem | null>(null)

  // Form fields
  const [formCode, setFormCode] = React.useState('')
  const [formName, setFormName] = React.useState('')
  const [formCategory, setFormCategory] = React.useState<ShiftCategory>('GENERAL')
  const [formStartTime, setFormStartTime] = React.useState('09:30')
  const [formEndTime, setFormEndTime] = React.useState('18:30')
  const [formFirstSlotStart, setFormFirstSlotStart] = React.useState('10:00')
  const [formFirstSlotEnd, setFormFirstSlotEnd] = React.useState('14:00')
  const [formSecondSlotStart, setFormSecondSlotStart] = React.useState('17:00')
  const [formSecondSlotEnd, setFormSecondSlotEnd] = React.useState('21:00')
  const [formRotationCycleDays, setFormRotationCycleDays] = React.useState(7)
  const [formGrace, setFormGrace] = React.useState(15)
  const [formHalfDay, setFormHalfDay] = React.useState(4)
  const [formColorIdx, setFormColorIdx] = React.useState(0)

  const loadShifts = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.leaves.getShifts()
      if (res?.success && Array.isArray(res.data)) {
        setShifts(res.data)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load shifts')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadShifts()
  }, [loadShifts])

  const openCreateModal = () => {
    setEditingShift(null)
    setFormCode('')
    setFormName('')
    setFormCategory('GENERAL')
    setFormStartTime('09:30')
    setFormEndTime('18:30')
    setFormFirstSlotStart('10:00')
    setFormFirstSlotEnd('14:00')
    setFormSecondSlotStart('17:00')
    setFormSecondSlotEnd('21:00')
    setFormRotationCycleDays(7)
    setFormGrace(15)
    setFormHalfDay(4)
    setFormColorIdx(0)
    setIsModalOpen(true)
  }

  const openEditModal = (shift: ShiftItem) => {
    setEditingShift(shift)
    setFormCode(shift.code)
    setFormName(shift.name)
    setFormCategory(shift.category || (shift.code === 'NS' ? 'NIGHT' : shift.code === 'SS' ? 'SPLIT' : shift.code === 'MS' || shift.code === 'ES' ? 'ROTATIONAL' : 'GENERAL'))

    // Parse start and end time if not explicitly set
    let start = shift.startTime || '09:30'
    let end = shift.endTime || '18:30'
    if (!shift.startTime && shift.timings.includes('–')) {
      const parts = shift.timings.split('–').map((p) => p.trim())
      if (parts[0]) start = parts[0]
      if (parts[1]) end = parts[1]
    }

    setFormStartTime(start)
    setFormEndTime(end)
    setFormFirstSlotStart(shift.firstSlotStartTime || '10:00')
    setFormFirstSlotEnd(shift.firstSlotEndTime || '14:00')
    setFormSecondSlotStart(shift.secondSlotStartTime || '17:00')
    setFormSecondSlotEnd(shift.secondSlotEndTime || '21:00')
    setFormRotationCycleDays(shift.rotationCycleDays || 7)
    setFormGrace(shift.gracePeriodMinutes || 15)
    setFormHalfDay(shift.halfDayHours || 4)

    const colorMatch = COLOR_PRESETS.findIndex((c) => c.color === shift.color)
    setFormColorIdx(colorMatch >= 0 ? colorMatch : shift.category === 'SPLIT' ? 1 : 0)
    setIsModalOpen(true)
  }

  const handleSaveShift = async () => {
    if (!formCode.trim() || !formName.trim()) {
      setError('Please provide both Shift Code and Shift Name.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const preset = COLOR_PRESETS[formColorIdx] || COLOR_PRESETS[0]

      const payload: any = {
        code: formCode.toUpperCase().trim(),
        name: formName.trim(),
        category: formCategory,
        startTime: formCategory === 'SPLIT' ? formFirstSlotStart : formStartTime,
        endTime: formCategory === 'SPLIT' ? formSecondSlotEnd : formEndTime,
        firstSlotStartTime: formCategory === 'SPLIT' ? formFirstSlotStart : undefined,
        firstSlotEndTime: formCategory === 'SPLIT' ? formFirstSlotEnd : undefined,
        secondSlotStartTime: formCategory === 'SPLIT' ? formSecondSlotStart : undefined,
        secondSlotEndTime: formCategory === 'SPLIT' ? formSecondSlotEnd : undefined,
        rotationCycleDays: formCategory === 'ROTATIONAL' ? Number(formRotationCycleDays) : undefined,
        gracePeriodMinutes: Number(formGrace),
        halfDayHours: Number(formHalfDay),
        color: preset.color,
        badgeClass: preset.badgeClass,
      }

      const res = await api.leaves.createOrUpdateShift(payload)
      if (res?.success) {
        setSuccess(`Shift "${formName}" saved successfully!`)
        setIsModalOpen(false)
        await loadShifts()
      } else {
        throw new Error(res?.message || 'Failed to save shift')
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred while saving shift.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteShift = async (code: string) => {
    if (!confirm(`Are you sure you want to delete shift "${code}"?`)) return
    try {
      setLoading(true)
      const res = await api.leaves.deleteShift(code)
      if (res?.success) {
        setSuccess(`Shift "${code}" deleted successfully.`)
        await loadShifts()
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete shift')
    } finally {
      setLoading(false)
    }
  }

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

      {/* ── Top Header & Action Controls ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-ds-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ds-brand-navy flex items-center gap-2">
              <Clock className="size-5 text-indigo-600" />
              <span>Shift Timings & Work Schedules</span>
            </h2>
            <p className="text-xs text-ds-neutral-500 mt-0.5">
              Create and edit working shifts for your organization. Connected dynamically to the Roster Grid and Bulk Assign.
            </p>
          </div>

          {canManage && (
            <Button
              variant="default"
              size="sm"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="size-4" />
              <span>Create New Shift</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Shifts List Table ── */}
      <div className="rounded-2xl border border-ds-neutral-200 bg-white shadow-xs overflow-hidden">
        {loading && shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-ds-neutral-500">
            <Spinner className="size-6 text-indigo-600" />
            <span className="text-xs font-semibold">Loading shifts...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-ds-neutral-200 bg-ds-neutral-50/90 text-ds-neutral-700 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Shift Code</th>
                  <th className="py-3 px-4">Shift Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Working Timings</th>
                  <th className="py-3 px-4">Grace / Half-Day Policy</th>
                  <th className="py-3 px-4">Type</th>
                  {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-neutral-100">
                {shifts.map((s) => (
                  <tr key={s.code} className="hover:bg-ds-neutral-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-black border ${s.badgeClass}`}>
                        {s.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-ds-brand-navy">
                      {s.name}
                    </td>
                    <td className="py-3 px-4">
                      {s.code === 'WO' ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Scheduled Off
                        </span>
                      ) : s.category === 'SPLIT' || s.code === 'SS' ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">
                          Split Shift (2-Slot)
                        </span>
                      ) : s.category === 'NIGHT' || s.code === 'NS' ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                          Night (Overnight)
                        </span>
                      ) : s.category === 'ROTATIONAL' || s.code === 'MS' || s.code === 'ES' ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          Rotational {s.rotationCycleDays ? `(${s.rotationCycleDays}d)` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300">
                          General Standard
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-ds-neutral-600 font-semibold">
                      {s.timings}
                    </td>
                    <td className="py-3 px-4 text-ds-neutral-500">
                      <span>{s.gracePeriodMinutes || 15} mins grace</span>
                      <span className="mx-1.5">•</span>
                      <span>{s.halfDayHours || 4} hrs half-day</span>
                    </td>
                    <td className="py-3 px-4">
                      {s.code === 'WO' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Off Day
                        </span>
                      ) : s.isCustom ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          Custom Shift
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          Standard
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        {s.code !== 'WO' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(s)}
                              className="p-1.5 rounded-lg border border-ds-neutral-200 text-ds-neutral-600 hover:bg-ds-neutral-100 hover:text-ds-brand-navy"
                              title="Edit Shift"
                            >
                              <Edit2 className="size-3.5" />
                            </button>
                            {s.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleDeleteShift(s.code)}
                                className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                title="Delete Custom Shift"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Shift Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="relative flex flex-col w-full max-w-md max-h-[90vh] rounded-2xl border border-ds-neutral-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-ds-neutral-100 px-5 py-4 bg-white">
              <div>
                <h3 className="text-sm font-bold text-ds-brand-navy">
                  {editingShift ? `Edit Shift (${editingShift.code})` : 'Create New Working Shift'}
                </h3>
                <p className="text-[11px] text-ds-neutral-500 mt-0.5">
                  Configure timings, category (General, Night, Rotational, Split), and grace rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-ds-neutral-400 hover:bg-ds-neutral-100 hover:text-ds-neutral-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs text-ds-neutral-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ds-brand-navy block mb-1">Shift Code *</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. AF, SP"
                    value={formCode}
                    disabled={!!editingShift && !editingShift.isCustom}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-ds-neutral-200 bg-white p-2 text-xs font-bold uppercase focus:border-ds-brand-navy focus:outline-none"
                  />
                  <span className="text-[10px] text-ds-neutral-400 mt-0.5 block">2-4 characters</span>
                </div>

                <div>
                  <label className="font-bold text-ds-brand-navy block mb-1">Shift Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Afternoon Support"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-xl border border-ds-neutral-200 bg-white p-2 text-xs focus:border-ds-brand-navy focus:outline-none"
                  />
                </div>
              </div>

              {/* Shift Category Selector */}
              <div>
                <label className="font-bold text-ds-brand-navy block mb-1">Shift Category / Schedule Type *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as ShiftCategory)}
                  className="w-full rounded-xl border border-ds-neutral-200 bg-white p-2 text-xs font-semibold focus:border-ds-brand-navy focus:outline-none"
                >
                  <option value="GENERAL">General Shift (Standard Daytime Hours)</option>
                  <option value="NIGHT">Night Shift (Crosses Midnight e.g. 22:00 - 06:30)</option>
                  <option value="ROTATIONAL">Rotational Shift (Morning/Evening Cyclic Pool)</option>
                  <option value="SPLIT">Split Shift (Two discrete slots with break, e.g. 10:00-14:00 & 17:00-21:00)</option>
                </select>
                <span className="text-[10px] text-ds-neutral-400 mt-1 block">
                  {formCategory === 'SPLIT'
                    ? 'Split shifts allow employees to work two discrete sessions per day separated by an extended break.'
                    : formCategory === 'ROTATIONAL'
                    ? 'Rotational shifts rotate between day/evening/night pools across recurring cycles.'
                    : formCategory === 'NIGHT'
                    ? 'Night shifts cross over midnight into the following morning.'
                    : 'Standard continuous daytime working hours.'}
                </span>
              </div>

              {/* Split Shift Timing Slots vs Standard Shift Timings */}
              {formCategory === 'SPLIT' ? (
                <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3.5">
                  <span className="text-xs font-bold text-cyan-900 block">Split Shift Slots (Two Working Windows)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-cyan-900 block mb-1">Slot 1: Start</label>
                      <input
                        type="time"
                        value={formFirstSlotStart}
                        onChange={(e) => setFormFirstSlotStart(e.target.value)}
                        className="w-full rounded-lg border border-cyan-200 bg-white p-2 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-cyan-900 block mb-1">Slot 1: End</label>
                      <input
                        type="time"
                        value={formFirstSlotEnd}
                        onChange={(e) => setFormFirstSlotEnd(e.target.value)}
                        className="w-full rounded-lg border border-cyan-200 bg-white p-2 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-cyan-900 block mb-1">Slot 2: Start</label>
                      <input
                        type="time"
                        value={formSecondSlotStart}
                        onChange={(e) => setFormSecondSlotStart(e.target.value)}
                        className="w-full rounded-lg border border-cyan-200 bg-white p-2 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-cyan-900 block mb-1">Slot 2: End</label>
                      <input
                        type="time"
                        value={formSecondSlotEnd}
                        onChange={(e) => setFormSecondSlotEnd(e.target.value)}
                        className="w-full rounded-lg border border-cyan-200 bg-white p-2 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-ds-brand-navy block mb-1">Start Time (24h) *</label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full rounded-xl border border-ds-neutral-200 bg-white p-2 text-xs font-semibold focus:border-ds-brand-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-ds-brand-navy block mb-1">End Time (24h) *</label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full rounded-xl border border-ds-neutral-200 bg-white p-2 text-xs font-semibold focus:border-ds-brand-navy focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {formCategory === 'ROTATIONAL' && (
                <div>
                  <label className="font-bold text-ds-brand-navy block mb-1">Rotation Cycle (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={formRotationCycleDays}
                    onChange={(e) => setFormRotationCycleDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-ds-neutral-200 bg-white p-2 text-xs font-semibold focus:border-ds-brand-navy focus:outline-none"
                  />
                  <span className="text-[10px] text-ds-neutral-400 mt-0.5 block">e.g. rotates every 7 days (weekly) or 14 days</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ds-brand-navy block mb-1">Grace Period (mins)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={formGrace}
                    onChange={(e) => setFormGrace(Number(e.target.value))}
                    className="w-full rounded-xl border border-ds-neutral-200 bg-white p-2 text-xs focus:border-ds-brand-navy focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-ds-brand-navy block mb-1">Half-Day Threshold (hrs)</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={formHalfDay}
                    onChange={(e) => setFormHalfDay(Number(e.target.value))}
                    className="w-full rounded-xl border border-ds-neutral-200 bg-white p-2 text-xs focus:border-ds-brand-navy focus:outline-none"
                  />
                </div>
              </div>

              {/* Badge Color Selector */}
              <div>
                <label className="font-bold text-ds-brand-navy block mb-1">Badge Color Theme</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {COLOR_PRESETS.map((p, idx) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setFormColorIdx(idx)}
                      className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all ${
                        formColorIdx === idx
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-600'
                          : 'border-ds-neutral-200 bg-white text-ds-neutral-600 hover:bg-ds-neutral-50'
                      }`}
                    >
                      <span className={`inline-block px-1.5 py-0.2 rounded border ${p.badgeClass}`}>
                        {formCode || 'SH'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Callout */}
              <div className="rounded-xl border border-ds-neutral-200 bg-ds-neutral-50/70 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-ds-brand-navy">Grid Cell Preview:</span>
                  <p className="text-[10px] text-ds-neutral-500">{formName || 'New Shift'} ({formStartTime} – {formEndTime})</p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-black border ${COLOR_PRESETS[formColorIdx]?.badgeClass || ''}`}>
                  {formCode || 'SH'}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-ds-neutral-100 px-5 py-3.5 bg-white">
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleSaveShift} disabled={saving}>
                {saving ? 'Saving...' : 'Save Shift'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
