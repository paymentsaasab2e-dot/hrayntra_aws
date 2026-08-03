'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  HQ_PRIMARY_BUTTON_CLASS,
  HQ_SECONDARY_BUTTON_CLASS,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from './HqModulePageLayout';

/**
 * Legacy wrappers — prefer `HqModulePageLayout` for new / refactored HQ pages.
 * Kept so existing dashboard panels keep working during the Phase 2 structure migration.
 */
export function HqPageMain({ children }: { children: React.ReactNode }) {
  return <div className="ph2-main-surface min-h-0 flex-1">{children}</div>;
}

export function HqPageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
      {children}
    </div>
  );
}

export function HqPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex shrink-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-[1.35rem]">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function HqStatCard({
  label,
  value,
  delta,
  active,
}: {
  label: string;
  value: string | number;
  delta?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/20 px-4 py-3 shadow-[0_8px_24px_-12px_rgba(59,130,246,0.18)] transition ${
        active
          ? 'border-indigo-200 ring-2 ring-indigo-400/30'
          : 'border-indigo-100/70 hover:border-indigo-200/90'
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">{value}</p>
        {delta ? (
          <span className="mb-0.5 inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/80">
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function HqPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 p-5 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function HqPanelTitle({
  title,
  meta,
}: {
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold tracking-tight text-slate-800">{title}</h3>
      {meta}
    </div>
  );
}

/** Phase 2–style table card shell for HQ lists. */
export function HqTableShell({
  children,
  toolbar,
  className = '',
}: {
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${HQ_TABLE_CARD_CLASS} ${className}`.trim()}>
      {toolbar ? <div className={HQ_TOOLBAR_ROW_CLASS}>{toolbar}</div> : null}
      <div className={HQ_TABLE_BODY_SCROLL_CLASS}>{children}</div>
    </section>
  );
}

export function HqSecondaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${HQ_SECONDARY_BUTTON_CLASS} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export function HqPrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  type = 'button',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${HQ_PRIMARY_BUTTON_CLASS} ${className}`.trim()}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

export function HqAlert({
  type,
  message,
}: {
  type: 'success' | 'error';
  message: string;
}) {
  return (
    <div
      className={`mt-4 flex items-start gap-3 rounded-xl border p-4 text-[13px] font-semibold leading-relaxed ${
        type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
    >
      <span>{message}</span>
    </div>
  );
}

export const HQ_SELECT_CLASS =
  'rounded-lg border border-indigo-100/90 bg-white/95 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-50';

export function HqFieldText({
  label,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  minLength,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <div className="space-y-2">
      <label className="ml-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</label>
      <div className="group/input relative">
        <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within/input:text-indigo-600" />
        <input
          type={type}
          required
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-indigo-100/90 bg-slate-50/80 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/25"
        />
      </div>
    </div>
  );
}
