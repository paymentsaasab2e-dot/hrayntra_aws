'use client';

import React from 'react';

type SettingsPageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: React.ReactNode;
};

/** Shared Phase-2 hero for Settings section pages (indigo / violet). */
export function SettingsPageHero({
  eyebrow,
  title,
  description,
  icon,
  actions,
  stats,
}: SettingsPageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/80 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/30"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-7">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-md shadow-indigo-500/25">
            {icon}
            {eyebrow}
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {(actions || stats) && (
          <div className="flex flex-wrap items-center gap-3">
            {stats}
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}

type SettingsPanelProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function SettingsPanel({
  title,
  description,
  icon,
  actions,
  children,
  className = '',
}: SettingsPanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-indigo-100/60 bg-white/80 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.16)] backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-base font-bold tracking-tight text-slate-900">{title}</h3>
          </div>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
