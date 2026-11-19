'use client'

import * as React from 'react'
import { Button } from '@hryantra/ui'
import { AlertTriangle, Info } from 'lucide-react'
import { TAB_LABELS, TabKey } from '@/shared/permissions'
import {
  TENANT_MODULE_KEYS,
  getModuleWarnings,
  labelList,
  relatedTabsFor,
  type ModuleWarning,
} from '../module-connections'

type Props = {
  selected: TabKey[]
  onChange: (next: TabKey[]) => void
  onApplyPackageDefaults?: () => void
  packageLabel?: string
}

export function ModuleChipPicker({ selected, onChange, onApplyPackageDefaults, packageLabel }: Props) {
  const selectedSet = React.useMemo(() => new Set(selected), [selected])
  const warnings = React.useMemo(() => getModuleWarnings(selected), [selected])
  const required = warnings.filter((w) => w.severity === 'required')
  const recommended = warnings.filter((w) => w.severity === 'recommended')

  const toggle = (tab: TabKey) => {
    if (tab === 'dashboard') return
    if (selectedSet.has(tab)) {
      onChange(selected.filter((t) => t !== tab))
      return
    }
    onChange([...selected, tab])
  }

  const enableMissing = (warning: ModuleWarning) => {
    const next = new Set(selected)
    warning.missing.forEach((t) => next.add(t))
    onChange([...next])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ds-neutral-500">
          Chip-select modules this client can use. Dashboard stays on. Related tabs show a warning if a needed module is off.
        </p>
        {onApplyPackageDefaults && (
          <Button variant="outline" size="sm" type="button" onClick={onApplyPackageDefaults}>
            Reset to {packageLabel || 'package'} defaults
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TENANT_MODULE_KEYS.map((tab) => {
          const on = selectedSet.has(tab)
          const locked = tab === 'dashboard'
          const related = relatedTabsFor(tab)
          const hasWarn = warnings.some((w) => w.tab === tab)
          return (
            <button
              key={tab}
              type="button"
              disabled={locked}
              title={
                related.length
                  ? `Works with: ${labelList(related)}`
                  : TAB_LABELS[tab]
              }
              onClick={() => toggle(tab)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                on
                  ? hasWarn
                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                    : 'border-ds-brand-navy bg-ds-brand-navy text-white'
                  : 'border-ds-neutral-200 bg-white text-ds-neutral-600 hover:border-ds-neutral-400'
              } ${locked ? 'opacity-80 cursor-default' : ''}`}
            >
              {TAB_LABELS[tab]}
              {locked ? ' • always on' : ''}
            </button>
          )
        })}
      </div>

      {required.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Required connections
          </p>
          {required.map((w, i) => (
            <div key={`${w.tab}-req-${i}`} className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-amber-900">
              <p className="flex-1">
                <strong>{TAB_LABELS[w.tab]}</strong> needs {labelList(w.missing)}. {w.reason}
              </p>
              <Button variant="outline" size="sm" type="button" onClick={() => enableMissing(w)}>
                Enable {labelList(w.missing)}
              </Button>
            </div>
          ))}
        </div>
      )}

      {recommended.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold text-sky-900 flex items-center gap-1.5">
            <Info className="size-3.5" />
            Recommended connections
          </p>
          {recommended.map((w, i) => (
            <div key={`${w.tab}-rec-${i}`} className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-sky-900">
              <p className="flex-1">
                <strong>{TAB_LABELS[w.tab]}</strong> works best with {labelList(w.missing)}. {w.reason}
              </p>
              <Button variant="outline" size="sm" type="button" onClick={() => enableMissing(w)}>
                Add {labelList(w.missing)}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
