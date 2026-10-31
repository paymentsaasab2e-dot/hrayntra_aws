'use client';

import React, { useEffect, useState } from 'react';
import { apiGetJobPublishQuota, type JobPublishQuota } from '@/lib/api/jobs';

function toInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeQuota(raw: unknown): JobPublishQuota | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const used = toInt(row.used ?? row.publishedThisMonth ?? row.published);
  const limit = toInt(row.limit ?? row.maxJobs ?? row.quota);
  if (used == null || limit == null || limit <= 0) return null;
  const remaining = toInt(row.remaining) ?? Math.max(0, limit - used);
  const blocked = typeof row.blocked === 'boolean' ? row.blocked : remaining <= 0;
  return {
    used,
    limit,
    remaining,
    blocked,
    plan: typeof row.plan === 'string' ? row.plan : undefined,
    period: typeof row.period === 'string' ? row.period : 'calendar_month',
  };
}

export function useJobPublishQuota() {
  const [quota, setQuota] = useState<JobPublishQuota | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void apiGetJobPublishQuota(ac.signal)
      .then((res) => {
        const next = normalizeQuota(res?.data ?? res);
        if (next) setQuota(next);
      })
      .catch(() => {
        setQuota(null);
      });
    return () => ac.abort();
  }, []);

  return quota;
}

/** Hidden until GET /jobs/publish-quota exists. Always-on meter after Devin lands. */
export function JobPublishQuotaMeter({ className = '' }: { className?: string }) {
  const quota = useJobPublishQuota();
  if (!quota) return null;

  const full = quota.blocked || quota.remaining <= 0;
  const warn = !full && quota.used >= Math.max(1, quota.limit - 2);
  const label = full
    ? `${quota.limit} / ${quota.limit} — Upgrade to post more`
    : `Job posts this month: ${quota.used} / ${quota.limit}`;

  return (
    <div
      className={`inline-flex h-9 max-w-full items-center rounded-full border px-3 text-xs font-semibold tabular-nums ${
        full
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : warn
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-white/70 bg-white/80 text-slate-700'
      } ${className}`}
      title={
        full
          ? 'Free monthly job posts are used. You can still save drafts. Upgrade to publish more.'
          : 'Successfully published jobs in this calendar month. Drafts do not count.'
      }
      aria-label={label}
    >
      <span className="truncate">{label}</span>
    </div>
  );
}
