'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import {
  apiGetJobPostingPlan,
  type JobPostingQuotaSnapshot,
} from '@/lib/api';
import { JobPostingPremiumModal } from '@/components/jobs/JobPostingPremiumModal';
import { JOB_POSTING_QUOTA_REFRESH_EVENT } from '@/lib/jobPostingQuotaEvents';
import { SettingsPanel } from '@/components/settings/SettingsPageHero';

function formatInrFromPaise(paise: number) {
  const rupees = Math.round(Number(paise || 0) / 100);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function JobPostingPlanSection() {
  const [snapshot, setSnapshot] = useState<JobPostingQuotaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [premiumOpen, setPremiumOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGetJobPostingPlan();
      setSnapshot(res.data?.snapshot || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load job posting plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener(JOB_POSTING_QUOTA_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(JOB_POSTING_QUOTA_REFRESH_EVENT, onRefresh);
  }, [load]);

  const used = snapshot?.used ?? 0;
  const limit = snapshot?.limit ?? 10;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <>
      <SettingsPanel
        title="Job posting plan"
        description="Monthly publish quota for freemium job posts (separate from your HQ package job cap)."
      >
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : snapshot ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 capitalize">
                  {snapshot.tier === 'premium' ? 'Premium' : 'Free'} plan
                </p>
                <p className="text-xs text-slate-500">
                  Calendar month {snapshot.monthKey}
                  {snapshot.premiumUntil
                    ? ` · Premium until ${new Date(snapshot.premiumUntil).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
              {snapshot.tier !== 'premium' || !snapshot.canPublish ? (
                <button
                  type="button"
                  onClick={() => setPremiumOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Upgrade to Premium
                </button>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Published this month</span>
                <span className="font-semibold text-slate-900">
                  {used} / {limit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 100 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Premium: {snapshot.premiumLimit} posts / month · from{' '}
                {formatInrFromPaise(snapshot.pricing?.monthlyPaise || 99900)} / month
              </p>
            </div>
          </div>
        ) : null}
      </SettingsPanel>

      <JobPostingPremiumModal
        open={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        initialSnapshot={snapshot}
        onActivated={(next) => setSnapshot(next)}
      />
    </>
  );
}
