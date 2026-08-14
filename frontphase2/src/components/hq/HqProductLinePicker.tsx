'use client';

import React from 'react';
import { BriefcaseBusiness, Check, Target, X } from 'lucide-react';
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
    description: 'Sales pipeline, follow-ups, convert to client',
    icon: Target,
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    description: 'Jobs, candidates, interviews & placements',
    icon: BriefcaseBusiness,
  },
];

const PRODUCT_LINE_SELECT_CLASS =
  'w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white bg-[length:1rem] bg-[right_0.85rem_center] bg-no-repeat py-2.5 pl-10 pr-10 text-sm font-semibold text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 [background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%2364748b%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.6%27 d=%27m6 8 4 4 4-4%27/%3E%3C/svg%3E")]';

type SelectProps = {
  value: HqProductLine | '' | null;
  onChange: (line: HqProductLine) => void;
  id?: string;
  allowEmpty?: boolean;
  placeholder?: string;
  showHint?: boolean;
  className?: string;
};

export function HqProductLineSelect({
  value,
  onChange,
  id,
  allowEmpty = false,
  placeholder = 'Select product line',
  showHint = true,
  className,
}: SelectProps) {
  const selected = HQ_PRODUCT_LINE_OPTIONS.find((opt) => opt.id === value) ?? null;
  const Icon = selected?.icon ?? Target;

  return (
    <div className={className}>
      <div className="relative">
        <Icon
          size={16}
          strokeWidth={2.2}
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${
            selected?.id === 'recruitment' ? 'text-violet-500' : 'text-indigo-500'
          }`}
        />
        <select
          id={id}
          aria-label="Product line"
          value={value || ''}
          onChange={(e) => {
            const next = e.target.value;
            if (next === 'crm' || next === 'recruitment') onChange(next);
          }}
          className={PRODUCT_LINE_SELECT_CLASS}
        >
          {allowEmpty ? <option value="">{placeholder}</option> : null}
          {HQ_PRODUCT_LINE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {showHint && selected ? (
        <p className="mt-2 text-xs leading-snug text-slate-500">{selected.description}</p>
      ) : null}
    </div>
  );
}

export function normalizeHqProductLines(value: unknown): HqProductLine[] {
  const raw = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[,|]/)
        .map((item) => item.trim());
  const lines = raw
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item): item is HqProductLine => item === 'crm' || item === 'recruitment');
  return [...new Set(lines)];
}

export function hqProductLineLabels(lines: HqProductLine[] | null | undefined): string[] {
  return (lines || []).map((line) => hqProductLineLabel(line)).filter(Boolean);
}

export function HqProductLineSelectBoxes({
  value,
  onChange,
  className,
}: {
  value: HqProductLine[];
  onChange: (lines: HqProductLine[]) => void;
  className?: string;
}) {
  const selected = normalizeHqProductLines(value);
  const toggle = (line: HqProductLine) => {
    if (selected.includes(line)) {
      onChange(selected.filter((item) => item !== line));
      return;
    }
    onChange([...selected, line]);
  };

  return (
    <div
      className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className || ''}`}
      role="group"
      aria-label="Product line"
    >
      {HQ_PRODUCT_LINE_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const checked = selected.includes(opt.id);
        const recruitment = opt.id === 'recruitment';
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={checked}
            onClick={() => toggle(opt.id)}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-sm transition ${
              checked
                ? recruitment
                  ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-200'
                  : 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                checked
                  ? recruitment
                    ? 'border-violet-500 bg-violet-600 text-white'
                    : 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-transparent'
              }`}
              aria-hidden
            >
              <Check size={12} strokeWidth={3} />
            </span>
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                checked
                  ? recruitment
                    ? 'bg-white text-violet-600 ring-1 ring-violet-100'
                    : 'bg-white text-indigo-600 ring-1 ring-indigo-100'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Icon size={18} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{opt.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">{opt.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
          <label htmlFor="hq-product-line-modal" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Product line
          </label>
          <HqProductLineSelect
            id="hq-product-line-modal"
            value={selected}
            allowEmpty={!selected}
            placeholder="Select CRM or Recruitment"
            onChange={setSelected}
          />
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
        <HqProductLineSelect
          value={value}
          onChange={onChange}
          showHint={false}
          className="min-w-[10rem]"
        />
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
