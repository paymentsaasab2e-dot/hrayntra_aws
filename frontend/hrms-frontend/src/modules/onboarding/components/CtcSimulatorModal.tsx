"use client"

import * as React from 'react'
import { Button, Input } from '@hryantra/ui'
import { X, Calculator, Sparkles, ArrowRight, Building2, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { CtcCalculator } from '@/modules/compensation/components/CtcCalculator'

type Props = {
  open: boolean
  profile: any | null
  onClose: () => void
  onApply?: (profileId: string, anchorValue: number) => void
}

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function CtcSimulatorModal({ open, profile, onClose, onApply }: Props) {
  const [anchorValue, setAnchorValue] = React.useState<number>(1200000)
  const [overrides, setOverrides] = React.useState<Record<string, number>>({})
  const [snapshot, setSnapshot] = React.useState<any | null>(null)

  React.useEffect(() => {
    if (open && profile) {
      if (profile.currencyCode === 'AED') setAnchorValue(180000)
      else if (profile.currencyCode === 'USD') setAnchorValue(120000)
      else setAnchorValue(1200000)
      setOverrides({})
    }
  }, [open, profile])

  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open || !profile) return null

  const currency = profile.currencyCode || 'INR'

  const presets = currency === 'AED'
    ? [90000, 150000, 240000, 360000]
    : currency === 'USD'
    ? [60000, 100000, 150000, 220000]
    : [600000, 1200000, 2400000, 4000000]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.3)] border border-slate-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/70 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
              <Calculator className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  CTC Breakdown Simulator
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100/70 text-indigo-800 border border-indigo-200/60">
                  {profile.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate statutory component breakdown, employer contributions, and net take-home pay.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/40">
          {/* Annual Anchor Quick Presets */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-800">
                  Target Annual Compensation ({currency})
                </label>
                <p className="text-[11px] text-slate-500">Enter custom CTC or choose a standard benchmark.</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {presets.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAnchorValue(val)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                      anchorValue === val
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {formatCurrency(val, currency)}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <Input
                type="number"
                value={anchorValue}
                onChange={(e) => setAnchorValue(Number(e.target.value) || 0)}
                className="font-mono text-base font-bold text-slate-900 rounded-lg"
              />
            </div>
          </div>

          {/* CtcCalculator Engine */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <CtcCalculator
              profile={profile}
              anchorValue={anchorValue}
              componentOverrides={overrides}
              onAnchorChange={setAnchorValue}
              onOverrideChange={(code, val) => setOverrides((prev) => ({ ...prev, [code]: val }))}
              onSnapshot={setSnapshot}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/70 px-6 py-3.5 shrink-0">
          <div className="text-xs text-slate-500">
            Calculated via <span className="font-semibold text-slate-800">{profile.country} Statutory Rules</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">
              Close Simulator
            </Button>
            {onApply && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onApply(profile.id, anchorValue)
                  onClose()
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 font-semibold shadow-xs"
              >
                Apply to Candidate
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
