"use client"

import * as React from 'react'
import { FormField, FormFieldInput, Input, SectionCard } from '@hryantra/ui'
import { api } from '@/shared/api'

type ComponentRule = {
  code: string
  name: string
  section: string
  calcType: string
  value: number
  baseRef?: string | null
  cap?: number | null
  order: number
}

type Profile = {
  id: string
  name: string
  country: string
  currencyCode: string
  anchorType: string
  components: ComponentRule[]
}

type Snapshot = {
  lines: { code: string; name: string; section: string; monthly: number; annual: number; value: number }[]
  totals: {
    monthlyGross: number
    annualGross: number
    monthlyDeductions: number
    monthlyNet: number
    monthlyCtc: number
    annualCtc: number
  }
  currencyCode: string
}

type Props = {
  profile: Profile | null
  anchorValue: number
  anchorType?: string
  componentOverrides?: Record<string, number>
  onAnchorChange: (value: number) => void
  onOverrideChange: (code: string, value: number) => void
  onSnapshot?: (snapshot: Snapshot | null) => void
  readOnly?: boolean
}

function formatPlain(amount: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)
}

export function CtcCalculator({
  profile,
  anchorValue,
  anchorType,
  componentOverrides = {},
  onAnchorChange,
  onOverrideChange,
  onSnapshot,
  readOnly = false,
}: Props) {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null)
  const [loading, setLoading] = React.useState(false)

  const effectiveAnchorType = anchorType || profile?.anchorType || 'ANNUAL_CTC'

  React.useEffect(() => {
    if (!profile || !anchorValue) {
      setSnapshot(null)
      onSnapshot?.(null)
      return
    }

    let cancelled = false
    setLoading(true)
    api.compensation
      .calculate({
        anchorType: effectiveAnchorType,
        anchorValue,
        currencyCode: profile.currencyCode,
        components: profile.components,
        componentOverrides,
      })
      .then((res) => {
        if (cancelled) return
        const data = res?.data || res
        setSnapshot(data)
        onSnapshot?.(data)
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshot(null)
          onSnapshot?.(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [profile, anchorValue, effectiveAnchorType, componentOverrides, onSnapshot])

  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed border-ds-neutral-200 p-6 text-center text-ds-caption text-ds-neutral-500">
        Select a salary template to configure CTC breakdown.
      </div>
    )
  }

  const editableComponents = profile.components.filter((c) => c.calcType !== 'BALANCE_OF_GROSS' && c.calcType !== 'FIXED')

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label={`Anchor (${effectiveAnchorType.replace(/_/g, ' ')})`}>
          <FormFieldInput>
            <Input
              type="number"
              value={anchorValue || ''}
              onChange={(e) => onAnchorChange(Number(e.target.value))}
              disabled={readOnly}
              placeholder="e.g. 1200000"
            />
          </FormFieldInput>
        </FormField>
        <FormField label="Currency">
          <FormFieldInput>
            <Input value={profile.currencyCode} disabled />
          </FormFieldInput>
        </FormField>
      </div>

      <SectionCard title="Editable Percentages">
        <div className="space-y-3">
          {editableComponents.map((comp) => (
            <div key={comp.code} className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-ds-body-sm font-semibold text-ds-brand-navy">{comp.name}</p>
                <p className="text-ds-caption text-ds-neutral-500">
                  {comp.calcType.replace(/_/g, ' ')}
                  {comp.baseRef ? ` of ${comp.baseRef}` : ''}
                </p>
              </div>
              <div className="w-28">
                <Input
                  type="number"
                  step="0.01"
                  value={componentOverrides[comp.code] ?? comp.value}
                  onChange={(e) => onOverrideChange(comp.code, Number(e.target.value))}
                  disabled={readOnly}
                />
              </div>
              <span className="w-4 text-ds-caption text-ds-neutral-500">%</span>
            </div>
          ))}
          {editableComponents.length === 0 && (
            <p className="text-ds-caption text-ds-neutral-500">No percentage-based components in this profile.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="CTC Breakdown Preview">
        {loading && <p className="text-ds-caption text-ds-neutral-500">Calculating...</p>}
        {!loading && snapshot && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(
                [
                  { key: 'gross', eyebrow: 'Monthly', label: 'Gross', value: snapshot.totals.monthlyGross, accent: 'border-[#a7f3d0] bg-[#f0fdf4]' },
                  { key: 'deductions', eyebrow: 'Monthly', label: 'Deductions', value: snapshot.totals.monthlyDeductions, accent: 'border-[#fecdd3] bg-[#fff1f2]' },
                  { key: 'net', eyebrow: 'Monthly', label: 'Net Pay', value: snapshot.totals.monthlyNet, accent: 'border-[#bfdbfe] bg-[#eff6ff]' },
                  { key: 'ctc', eyebrow: 'Monthly', label: 'CTC', value: snapshot.totals.monthlyCtc, accent: 'border-[#ddd6fe] bg-[#f5f3ff]' },
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className={`flex min-h-[92px] flex-col justify-between rounded-xl border p-3.5 shadow-sm ${item.accent}`}
                >
                  <div className="min-h-[36px]">
                    <p className="text-[10px] font-bold uppercase leading-none tracking-wider text-[#64748b]">
                      {item.eyebrow}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-tight text-[#111827]">{item.label}</p>
                  </div>
                  <p className="truncate text-base font-bold tabular-nums leading-tight text-[#111827]">
                    <span className="mr-1 text-[11px] font-semibold text-[#64748b]">{profile.currencyCode}</span>
                    {formatPlain(item.value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-ds-neutral-200">
              <table className="w-full min-w-[480px] text-ds-body-sm">
                <thead>
                  <tr className="border-b border-ds-neutral-200 bg-ds-neutral-50 text-left text-ds-caption text-ds-neutral-500">
                    <th className="px-4 py-3 font-semibold">Component</th>
                    <th className="px-4 py-3 font-semibold">Section</th>
                    <th className="px-4 py-3 text-right font-semibold">Monthly</th>
                    <th className="px-4 py-3 text-right font-semibold">Annual</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.lines.map((line) => (
                    <tr key={line.code} className="border-b border-ds-neutral-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-ds-brand-navy">{line.name}</td>
                      <td className="px-4 py-3 text-ds-neutral-500">{line.section.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPlain(line.monthly)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ds-neutral-600">{formatPlain(line.annual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
