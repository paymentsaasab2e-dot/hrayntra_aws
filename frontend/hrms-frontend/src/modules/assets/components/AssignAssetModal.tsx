'use client'
import * as React from 'react'
import { Asset, AssetCondition } from '../types'
import { useStore, CURRENT_USER_ID } from '@/store/StoreProvider'
import { Button } from '@hryantra/ui'
import { X } from 'lucide-react'

interface Props {
  asset: Asset
  onClose: () => void
}

export function AssignAssetModal({ asset, onClose }: Props) {
  const { employees, assignAsset } = useStore()

  const [employeeId, setEmployeeId] = React.useState('')
  const [condition, setCondition] = React.useState<AssetCondition>('Good')
  const [expectedReturn, setExpectedReturn] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)

  const activeEmployees = employees.filter(e => e.status === 'Active')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeId) return
    assignAsset(asset.id, employeeId, { conditionOnIssue: condition, expectedReturn: expectedReturn || undefined, notes: notes || undefined })
    setSubmitted(true)
    setTimeout(onClose, 1500)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ds-brand-navy/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-ds-neutral-200">
          <div>
            <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">Assign Asset</h3>
            <p className="text-ds-caption text-ds-neutral-500">{asset.name} · {asset.serialNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-ds-neutral-100 text-ds-neutral-400 hover:text-ds-brand-navy transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
            <div className="size-14 rounded-full bg-ds-success-light flex items-center justify-center">
              <svg className="size-7 text-ds-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-ds-body font-semibold text-ds-brand-navy">Asset Assigned Successfully</p>
            <p className="text-ds-body-sm text-ds-neutral-500 text-center">The asset record has been updated.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-ds-label text-ds-neutral-700">Employee <span className="text-ds-danger">*</span></label>
              <select
                required
                className="text-ds-body-sm border border-ds-neutral-300 rounded-lg px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-ds-brand-green/30"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
              >
                <option value="">Select employee…</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} — {emp.designation}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-ds-label text-ds-neutral-700">Condition at Issue</label>
              <select
                className="text-ds-body-sm border border-ds-neutral-300 rounded-lg px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-ds-brand-green/30"
                value={condition}
                onChange={e => setCondition(e.target.value as AssetCondition)}
              >
                {(['New', 'Good', 'Fair'] as AssetCondition[]).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-ds-label text-ds-neutral-700">Expected Return Date <span className="text-ds-neutral-400">(optional)</span></label>
              <input
                type="date"
                className="text-ds-body-sm border border-ds-neutral-300 rounded-lg px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-ds-brand-green/30"
                value={expectedReturn}
                onChange={e => setExpectedReturn(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-ds-label text-ds-neutral-700">Notes <span className="text-ds-neutral-400">(optional)</span></label>
              <textarea
                rows={2}
                className="text-ds-body-sm border border-ds-neutral-300 rounded-lg px-3 py-2.5 bg-white outline-none resize-none focus:ring-2 focus:ring-ds-brand-green/30"
                placeholder="Any handover notes…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3 mt-2">
              <Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button variant="default" type="submit" className="flex-1">Confirm Assignment</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
