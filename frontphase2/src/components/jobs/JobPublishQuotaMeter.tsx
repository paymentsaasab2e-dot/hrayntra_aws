'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiGetJobPublishQuota } from '@/lib/api/jobs';
import {
  JOB_PUBLISH_QUOTA_EVENT,
  normalizeJobPublishQuota,
  openJobPublishQuotaModal,
} from '@/lib/jobPublishQuota';
import type { JobPublishQuota } from '@/lib/api/jobs';

export function useJobPublishQuota() {
  const [quota, setQuota] = useState<JobPublishQuota | null>(null);

  const refresh = useCallback((signal?: AbortSignal) => {
    void apiGetJobPublishQuota(signal)
      .then((res) => {
        const next = normalizeJobPublishQuota(res?.data ?? res);
        setQuota(next);
      })
      .catch(() => {
        setQuota(null);
      });
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    refresh(ac.signal);
    const onRefresh = () => refresh();
    window.addEventListener(JOB_PUBLISH_QUOTA_EVENT, onRefresh);
    window.addEventListener('jobportal:jobs-changed', onRefresh);
    return () => {
      ac.abort();
      window.removeEventListener(JOB_PUBLISH_QUOTA_EVENT, onRefresh);
      window.removeEventListener('jobportal:jobs-changed', onRefresh);
    };
  }, [refresh]);

  return quota;
}

export function JobPublishQuotaMeter({ className = '' }: { className?: string }) {
  const quota = useJobPublishQuota();
  if (!quota) return null;

  const full = quota.blocked || quota.remaining <= 0;
  const warnAt = quota.warnAt ?? Math.max(1, quota.limit - 2);
  const warn = !full && (quota.warning || quota.used >= warnAt);
  const label = full
    ? `${quota.limit} / ${quota.limit} — Upgrade to post more`
    : `Job posts this month: ${quota.used} / ${quota.limit}`;

  return (
    <button
      type="button"
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
      disabled={!full}
      onClick={() => {
        if (!full) return;
        openJobPublishQuotaModal({
          draftSaved: false,
          quota,
          message: label,
        });
      }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
