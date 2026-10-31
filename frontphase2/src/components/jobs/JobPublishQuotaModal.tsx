'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  JOB_PUBLISH_QUOTA_EVENT,
  JOB_PUBLISH_QUOTA_UPGRADE_HREF,
  type JobPublishQuotaExceededDetail,
} from '@/lib/jobPublishQuota';

export function JobPublishQuotaHost() {
  const router = useRouter();
  const [detail, setDetail] = useState<JobPublishQuotaExceededDetail | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const next = (event as CustomEvent<JobPublishQuotaExceededDetail>).detail;
      if (!next?.quota) return;
      setDetail(next);
    };
    window.addEventListener(JOB_PUBLISH_QUOTA_EVENT, onOpen);
    return () => window.removeEventListener(JOB_PUBLISH_QUOTA_EVENT, onOpen);
  }, []);

  if (!detail) return null;
  if (typeof document === 'undefined') return null;

  const { quota, draftSaved } = detail;
  const period = quota.monthLabel || quota.period || 'this month';

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-publish-quota-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_80px_-24px_rgba(16,27,53,0.55)]">
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-[#101b35] to-[#1b3a6b] px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8770E]">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 id="job-publish-quota-title" className="text-lg font-bold tracking-tight">
                Monthly job posts used
              </h2>
              <p className="mt-0.5 text-sm text-white/80">
                {quota.used} of {quota.limit} free posts in {period}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-6 text-slate-700">
            You have used this month’s free job posts. Drafts stay free, live edits do not
            take another slot, and applicants can still write to you. Premium unlocks more
            posts — inbox stays free.
          </p>
          {draftSaved ? (
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              Your job is saved as a <span className="font-semibold">draft</span> in Jobs.
              After you upgrade, open it and publish.
            </div>
          ) : (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              You can still save drafts. Upgrade when you are ready to publish another live
              job this month.
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={() => {
                setDetail(null);
                router.push(JOB_PUBLISH_QUOTA_UPGRADE_HREF);
              }}
              className="rounded-xl bg-gradient-to-r from-[#E8770E] to-[#FC9620] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
