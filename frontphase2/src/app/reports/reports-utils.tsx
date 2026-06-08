'use client';

import React from 'react';
import type { LeaderboardRow } from './types';
import { formatDateTimeDMY } from '../../utils/dateDisplay';

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function buildDownloadHref(fileUrl: string, filename: string) {
  const params = new URLSearchParams({ path: fileUrl, filename });
  return `/api/download-file?${params.toString()}`;
}

export function funnelConversion(from: number, to: number) {
  if (!from) return '0.0';
  return ((to / from) * 100).toFixed(1);
}

export function computeProductivityScores(rows: Array<LeaderboardRow & { productivityScore?: number }>) {
  if (!rows.length) return [];

  const maxPlacements = Math.max(...rows.map((r) => r.placements || 0), 1);
  const maxInterviews = Math.max(...rows.map((r) => r.interviews || 0), 1);
  const maxCandidates = Math.max(...rows.map((r) => r.candidatesAdded ?? r.submissions ?? 0), 1);
  const maxJobs = Math.max(...rows.map((r) => r.jobs ?? 0), 1);

  return rows.map((row) => {
    const placementScore = ((row.placements || 0) / maxPlacements) * 100;
    const interviewScore = ((row.interviews || 0) / maxInterviews) * 100;
    const candidateScore = ((row.candidatesAdded ?? row.submissions ?? 0) / maxCandidates) * 100;
    const activityScore = ((row.tasksCompleted ?? row.jobs ?? 0) / Math.max(maxJobs, maxCandidates)) * 100;
    const total = Math.round(
      placementScore * 0.4 + interviewScore * 0.25 + candidateScore * 0.2 + activityScore * 0.15,
    );
    return { ...row, productivityScore: total };
  });
}

export function clientHealthBadge(healthOrVolume: string | number): { label: string; className: string } {
  if (typeof healthOrVolume === 'string') {
    if (healthOrVolume === 'active') return { label: 'Active', className: 'bg-emerald-100 text-emerald-800 ring-emerald-200' };
    if (healthOrVolume === 'slow') return { label: 'Slow', className: 'bg-amber-100 text-amber-800 ring-amber-200' };
    return { label: 'No activity', className: 'bg-rose-100 text-rose-800 ring-rose-200' };
  }
  if (healthOrVolume >= 5) return { label: 'Active', className: 'bg-emerald-100 text-emerald-800 ring-emerald-200' };
  if (healthOrVolume >= 2) return { label: 'Slow', className: 'bg-amber-100 text-amber-800 ring-amber-200' };
  return { label: 'No activity', className: 'bg-rose-100 text-rose-800 ring-rose-200' };
}

export function formatActivityTime(value: string) {
  return formatDateTimeDMY(value);
}

export function ReportCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm">
      {title ? (
        <div className="border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/20 to-violet-50/15 px-5 py-3">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
        </div>
      ) : null}
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-indigo-100/80 bg-indigo-50/20 text-sm text-slate-500">
      {text}
    </div>
  );
}

export function SimpleTable({
  columns,
  rows,
}: {
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  rows: Array<Record<string, string | number>>;
}) {
  if (!rows.length) return <EmptyState text="No data for the selected filters." />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-indigo-100/60 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-100/80 text-slate-700 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right font-medium' : ''}`}>
                  {row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HorizontalBarChart({ items, labelKey, valueKey }: { items: Array<Record<string, string | number>>; labelKey: string; valueKey: string }) {
  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const width = Math.max(4, (value / max) * 100);
        return (
          <div key={index} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-xs">
            <span className="truncate font-medium text-slate-700">{item[labelKey]}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${width}%` }} />
            </div>
            <span className="text-right font-semibold text-slate-600">{formatNumber(value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function VerticalFunnel({ stages }: { stages: Array<{ name: string; value: number }> }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-1 py-2">
      {stages.map((stage, index) => {
        const widthPct = Math.max(35, (stage.value / max) * 100);
        return (
          <React.Fragment key={stage.name}>
            <div
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-sm"
              style={{ width: `${widthPct}%`, minWidth: '8rem' }}
            >
              <div>{stage.name}</div>
              <div className="text-[10px] font-normal opacity-90">{formatNumber(stage.value)}</div>
            </div>
            {index < stages.length - 1 ? <div className="text-slate-300">↓</div> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
