'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export function HqPageMain({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen overflow-y-auto bg-[#f4f5f7]">{children}</main>;
}

export function HqPageContainer({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1200px] px-6 py-8 lg:px-10">{children}</div>;
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
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>
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
      className={`rounded-2xl border bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md ${
        active ? 'border-sky-200 ring-2 ring-sky-100' : 'border-slate-200/80'
      }`}
    >
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        {delta ? (
          <span className="mb-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
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
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`.trim()}
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
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{title}</h3>
      {meta}
    </div>
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
      className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
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
      className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 text-[13px] font-semibold leading-relaxed ${
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
  'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:opacity-50';

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
      <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</label>
      <div className="group/input relative">
        <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within/input:text-slate-600" />
        <input
          type={type}
          required
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
        />
      </div>
    </div>
  );
}
