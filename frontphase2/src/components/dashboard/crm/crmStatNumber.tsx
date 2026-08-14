'use client';

import React from 'react';
import { dashFontVars, dashNumFont, dashTextFont } from '@/lib/dashTypeFonts';

/** Inter — digits / numeric figures only (unchanged from current setup). */
export const crmNumFont = dashNumFont;

/** Plus Jakarta Sans — letters + signs/symbols ($ % + · etc.), matched to reference UI. */
export const crmTextFont = dashTextFont;

export { dashFontVars };

/** Render mixed figures: digits stay Inter, letters/signs use the CRM text font. */
export function CrmFigureText({ value }: { value: React.ReactNode }) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return <>{value}</>;
  const s = String(value);
  return (
    <>
      {s.split(/(\d[\d,.]*)/g).map((part, i) => {
        if (!part) return null;
        if (/^\d/.test(part)) {
          return (
            <span key={i} className={`${crmNumFont} tabular-nums tracking-tight`}>
              {part}
            </span>
          );
        }
        return (
          <span key={i} className={crmTextFont}>
            {part}
          </span>
        );
      })}
    </>
  );
}

/** Period change (first → last). Used for card stock arrows. */
export function sparkDelta(
  series?: Array<{ value?: number } | number> | null,
): number | null {
  if (!series || series.length < 2) return null;
  const nums = series.map((s) => (typeof s === 'number' ? s : Number(s?.value || 0)));
  const prev = nums[0];
  const curr = nums[nums.length - 1];
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return null;
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return curr > 0 ? 100 : curr < 0 ? -100 : null;
  const pct = Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
  return pct === 0 ? null : pct;
}

export function sparkValues(series?: Array<{ value?: number } | number> | null): number[] {
  if (!series?.length) return [];
  return series.map((s) => (typeof s === 'number' ? s : Number(s?.value || 0)));
}

/** Stock-style caret: green ▲ growth / red ▼ drop. `invert` for overdue-style metrics. */
export function CrmStockDelta({
  pct,
  invert,
  light,
}: {
  pct?: number | null;
  invert?: boolean;
  light?: boolean;
}) {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return null;
  const up = pct > 0;
  const good = invert ? !up : up;
  const tone = light
    ? good
      ? 'bg-emerald-400/25 text-emerald-100 ring-emerald-200/30'
      : 'bg-rose-400/25 text-rose-100 ring-rose-200/30'
    : good
      ? 'bg-emerald-50 text-emerald-600 ring-emerald-100'
      : 'bg-rose-50 text-rose-600 ring-rose-100';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}
      title={up ? 'Up vs start of period' : 'Down vs start of period'}
    >
      <svg width="9" height="9" viewBox="0 0 8 8" className="shrink-0" aria-hidden>
        {up ? (
          <path d="M4 1.1 L7.5 6.9 H0.5 Z" fill="currentColor" />
        ) : (
          <path d="M4 6.9 L7.5 1.1 H0.5 Z" fill="currentColor" />
        )}
      </svg>
      <CrmFigureText value={`${Math.abs(pct) >= 10 ? Math.abs(pct).toFixed(0) : Math.abs(pct).toFixed(1)}%`} />
    </span>
  );
}

export function CrmMiniSpark({
  values,
  invert,
  className = '',
}: {
  values: number[];
  invert?: boolean;
  className?: string;
}) {
  if (values.length < 2) return null;
  const w = 72;
  const h = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const up = values[values.length - 1] >= values[0];
  const good = invert ? !up : up;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`h-5 w-[72px] ${className}`} aria-hidden>
      <polyline fill="none" stroke={good ? '#10B981' : '#F43F5E'} strokeWidth="1.6" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

type Size = 'sm' | 'md' | 'lg';

/** Card figure: Inter digits + Jakarta labels/signs + optional stock delta / spark. */
export function CrmStatNumber({
  value,
  label,
  deltaPct,
  invertDelta,
  spark,
  size = 'md',
  light,
  align = 'start',
  variant = 'inline',
  className = '',
}: {
  value: React.ReactNode;
  label?: string;
  deltaPct?: number | null;
  invertDelta?: boolean;
  spark?: number[];
  size?: Size;
  light?: boolean;
  align?: 'start' | 'center';
  /** `gauge` = number (+ delta) centered, label on the next line (half-circle cards). */
  variant?: 'inline' | 'gauge';
  className?: string;
}) {
  const numSize =
    size === 'lg' ? 'text-[2rem]' : size === 'sm' ? 'text-[1.2rem]' : 'text-[1.55rem]';
  const numCls = `${numSize} font-semibold leading-none ${light ? 'text-white' : 'text-[#0F172A]'}`;
  const labelCls = `${crmTextFont} text-[13px] font-medium ${light ? 'text-white/75' : 'text-slate-600'}`;

  if (variant === 'gauge') {
    return (
      <div className={`${crmTextFont} text-center ${className}`}>
        <div className="flex items-baseline justify-center gap-1.5">
          <span className={numCls}>
            <CrmFigureText value={value} />
          </span>
          <CrmStockDelta pct={deltaPct} invert={invertDelta} light={light} />
        </div>
        {label ? <p className={`mt-1.5 ${labelCls}`}>{label}</p> : null}
      </div>
    );
  }

  return (
    <div className={`${crmTextFont} ${align === 'center' ? 'text-center' : ''} ${className}`}>
      <div
        className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${align === 'center' ? 'justify-center' : ''}`}
      >
        <span className={numCls}>
          <CrmFigureText value={value} />
        </span>
        {label ? (
          <span className={`text-[12px] font-medium ${light ? 'text-white/70' : 'text-slate-400'}`}>
            {label}
          </span>
        ) : null}
        <CrmStockDelta pct={deltaPct} invert={invertDelta} light={light} />
      </div>
      {spark && spark.length > 1 ? (
        <CrmMiniSpark values={spark} invert={invertDelta} className={`mt-1.5 ${align === 'center' ? 'mx-auto' : ''}`} />
      ) : null}
    </div>
  );
}
