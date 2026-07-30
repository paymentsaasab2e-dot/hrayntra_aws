'use client';

import React from 'react';
import { BriefcaseBusiness, Target, X } from 'lucide-react';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';

/** HQ multi-SaaS product lines — mirrors Phase 2 sidebar CRM vs Recruitment. */
export type HqProductLine = 'crm' | 'recruitment';

export const HQ_PRODUCT_LINE_OPTIONS: Array<{
  id: HqProductLine;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
}> = [
  {
    id: 'crm',
    label: 'CRM',
    description: 'Leads, clients, pipeline follow-ups — sales & account CRM workspace.',
    icon: Target,
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    description: 'Jobs, candidates, interviews & placements — hiring workspace.',
    icon: BriefcaseBusiness,
  },
];

export function hqProductLineLabel(line: HqProductLine | null | undefined): string {
  if (line === 'recruitment') return 'Recruitment';
  if (line === 'crm') return 'CRM';
  return '';
}

type PickerProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  value?: HqProductLine | null;
  onSelect: (line: HqProductLine) => void;
  onClose: () => void;
};

/**
 * HQ-only first step before Add Lead / Add Client.
 * Does not touch Phase 2 drawers.
 */
export function HqProductLinePickerModal({
  open,
  title = 'Choose workspace',
  subtitle = 'Select CRM or Recruitment — same Phase 2 modules your tenants use.',
  value = null,
  onSelect,
  onClose,
}: PickerProps) {
  const [selected, setSelected] = React.useState<HqProductLine | null>(value);

  React.useEffect(() => {
    if (open) setSelected(value ?? null);
  }, [open, value]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-indigo-100/70 bg-gradient-to-r from-blue-50/95 via-indigo-50/50 to-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product line</p>
          <div
            role="tablist"
            aria-label="HQ product line"
            className="grid grid-cols-2 gap-1 rounded-xl border border-indigo-100 bg-slate-50/80 p-1"
          >
            {HQ_PRODUCT_LINE_OPTIONS.map((opt) => {
              const active = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelected(opt.id)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {HQ_PRODUCT_LINE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelected(opt.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? 'border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-400/30'
                      : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/80'
                  }`}
                >
                  <div
                    className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                      active
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{opt.label}</p>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <HqSecondaryButton type="button" onClick={onClose}>
            Cancel
          </HqSecondaryButton>
          <HqPrimaryButton
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onSelect(selected);
            }}
          >
            Continue
          </HqPrimaryButton>
        </div>
      </div>
    </div>
  );
}

type BarProps = {
  value: HqProductLine;
  onChange: (line: HqProductLine) => void;
  entityLabel: 'lead' | 'client';
};

/**
 * HQ-only strip shown while the Phase 2 add drawer is open.
 * Lets operators switch CRM ↔ Recruitment without editing Phase 2 drawers.
 */
export function HqProductLineDrawerBar({ value, onChange, entityLabel }: BarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3 sm:justify-end sm:pr-[min(42vw,28rem)]">
      <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border border-indigo-200/80 bg-white/95 px-2.5 py-1.5 shadow-lg shadow-indigo-500/15 backdrop-blur">
        <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline">
          HQ {entityLabel}
        </span>
        <div
          role="tablist"
          aria-label="Switch CRM or Recruitment"
          className="inline-flex rounded-lg border border-indigo-100 bg-slate-50 p-0.5"
        >
          {HQ_PRODUCT_LINE_OPTIONS.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Merge product line into create payloads for HQ APIs. */
export function withHqProductLine<T extends Record<string, unknown>>(
  data: T,
  line: HqProductLine | null | undefined,
): T & { hqProductLine?: HqProductLine; interestedModules?: string[] } {
  if (!line) return { ...data };
  const label = hqProductLineLabel(line);
  const existing = Array.isArray(data.interestedModules)
    ? (data.interestedModules as string[]).map(String)
    : [];
  const withoutLines = existing.filter(
    (m) => m.toLowerCase() !== 'crm' && m.toLowerCase() !== 'recruitment',
  );
  return {
    ...data,
    hqProductLine: line,
    interestedModules: label ? [...withoutLines, label] : withoutLines,
  };
}
