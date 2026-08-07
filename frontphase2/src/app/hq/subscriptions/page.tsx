'use client';

/**
 * HQ · Employees · Subscriptions
 * Manage Phase 1 candidate coin packs and spend-point costs.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Coins,
  Crown,
  ExternalLink,
  Gift,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  HqPanel,
  HqPanelTitle,
  HqSecondaryButton,
  HqStatCard,
} from '@/components/hq/hqUi';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { HqPhase1ConnectionBar } from '@/components/hq/HqPhase1ConnectionBar';
import { HqPhase1CoinPacksPanel } from '@/components/hq/HqPhase1CoinPacksPanel';
import { HqPhase1SpendCostsPanel } from '@/components/hq/HqPhase1SpendCostsPanel';
import { getPhase1PortalUrl } from '@/components/hq/HqBrandLogo';
import { apiHqGetAnalytics, apiHqGetPhase1TokenConfig, type HqPhase1TokenPack } from '@/lib/api';

const PHASE1_PREMIUM_CATEGORIES = [
  {
    name: 'Resume & CV',
    items: ['AI CV editor', 'Premium resume positioning', 'ATS score boosts'],
    tone: 'sky' as const,
  },
  {
    name: 'Interview prep',
    items: ['Mock interview sessions', 'Unlock interviewer mode', 'Role request matching'],
    tone: 'violet' as const,
  },
  {
    name: 'LMS & courses',
    items: ['Course unlocks', 'Certified course access', 'Quizzes & notes'],
    tone: 'amber' as const,
  },
  {
    name: 'Earn coins',
    items: ['Profile completion rewards', 'Welcome bonus', 'Repeat earn tasks'],
    tone: 'emerald' as const,
  },
];

const TONE_STYLES = {
  sky: 'border-sky-200 bg-sky-50/70 text-sky-800',
  violet: 'border-violet-200 bg-violet-50/70 text-violet-800',
  amber: 'border-amber-200 bg-amber-50/70 text-amber-800',
  emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-800',
};

type SubTab = 'overview' | 'packs' | 'spend';

export default function HqEmployeeSubscriptionsPage() {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [packs, setPacks] = useState<HqPhase1TokenPack[]>([]);
  const [kpis, setKpis] = useState({
    candidates: 0,
    lmsEnrollments: 0,
    cvAnalyses: 0,
    interviewRequests: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsRes, tokensRes] = await Promise.all([
        apiHqGetAnalytics(),
        apiHqGetPhase1TokenConfig().catch(() => null),
      ]);
      const employee = analyticsRes.data?.employee;
      setLive(Boolean(employee?.live ?? employee?.available));
      setGeneratedAt(analyticsRes.data?.generatedAt || null);
      setKpis({
        candidates: Number(employee?.kpis?.totalCandidates) || 0,
        lmsEnrollments: Number(employee?.kpis?.lmsEnrollments) || 0,
        cvAnalyses: Number(employee?.kpis?.cvAnalyses) || 0,
        interviewRequests: Number(employee?.kpis?.interviewRequests) || 0,
      });
      if (tokensRes?.data?.packs) {
        setPacks(tokensRes.data.packs.filter((p) => p.active !== false));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Phase 1 subscription context');
      setLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const portalSubscriptionsUrl = useMemo(() => `${getPhase1PortalUrl()}/subscriptions`, []);

  return (
    <HqModulePageLayout
      title="Subscriptions"
      subtitle="Create employee coin packs and set how many points each Phase 1 feature spends."
      icon={<Coins className="h-5 w-5" />}
      locked={false}
      actions={
        <>
              <a
                href={portalSubscriptionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 text-sm font-semibold text-sky-700 hover:bg-sky-100"
              >
                Open Phase 1 page
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <HqSecondaryButton onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </HqSecondaryButton>
        </>
      }
    >

        <div className="mb-6 inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setSubTab('overview')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              subTab === 'overview' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setSubTab('packs')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
              subTab === 'packs' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Coins className="h-4 w-4" />
            Coin packs
          </button>
          <button
            type="button"
            onClick={() => setSubTab('spend')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
              subTab === 'spend' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Zap className="h-4 w-4" />
            Spend points
          </button>
        </div>

        {subTab === 'packs' ? <HqPhase1CoinPacksPanel /> : null}
        {subTab === 'spend' ? <HqPhase1SpendCostsPanel /> : null}

        {subTab === 'overview' ? (
          <>
            <HqPhase1ConnectionBar
              live={live && !error}
              generatedAt={generatedAt}
              candidateCount={kpis.candidates}
              onRefresh={() => void load()}
              loading={loading}
              compact
            />

            {error ? (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HqStatCard label="Phase 1 candidates" value={kpis.candidates} active />
              <HqStatCard label="LMS enrollments" value={kpis.lmsEnrollments} />
              <HqStatCard label="CV analyses" value={kpis.cvAnalyses} />
              <HqStatCard label="Interview requests" value={kpis.interviewRequests} />
            </div>

            {loading && !generatedAt ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Phase 1 subscription context…
              </div>
            ) : (
              <>
                <HqPanel className="mb-6">
                  <HqPanelTitle
                    title="Live coin packs"
                    meta={
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <Coins className="h-3.5 w-3.5" />
                        From HQ Coin packs tab
                      </span>
                    }
                  />
                  {packs.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No packs yet — open the <strong>Coin packs</strong> tab to create one.
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                      {packs.map((pack) => (
                        <div
                          key={pack.id}
                          className={`relative rounded-2xl border p-5 ${
                            pack.popular
                              ? 'border-sky-300 bg-gradient-to-br from-sky-50 to-white ring-2 ring-sky-100'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          {pack.popular ? (
                            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              <Crown className="h-3 w-3" />
                              Popular
                            </span>
                          ) : null}
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{pack.id}</p>
                          <h3 className="mt-1 text-xl font-bold text-slate-900">{pack.name}</h3>
                          <p className="mt-3 text-3xl font-black tracking-tight text-sky-700">
                            {pack.priceLabel}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            <Zap className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
                            {pack.tokens} points
                          </p>
                          {pack.description ? (
                            <p className="mt-3 text-sm leading-relaxed text-slate-500">{pack.description}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </HqPanel>

                <HqPanel className="mb-6">
                  <HqPanelTitle
                    title="Premium unlock categories"
                    meta={
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <Sparkles className="h-3.5 w-3.5" />
                        Candidate spend surfaces
                      </span>
                    }
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    {PHASE1_PREMIUM_CATEGORIES.map((cat) => (
                      <div key={cat.name} className={`rounded-2xl border p-4 ${TONE_STYLES[cat.tone]}`}>
                        <h3 className="text-sm font-bold">{cat.name}</h3>
                        <ul className="mt-3 space-y-1.5">
                          {cat.items.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm">
                              <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </HqPanel>

                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
                  <p className="font-semibold text-slate-800">How HQ manages this</p>
                  <p className="mt-1.5 leading-relaxed">
                    Use <strong>Coin packs</strong> to create purchase plans with points, and{' '}
                    <strong>Spend points</strong> → <strong>Premium</strong> for feature costs or{' '}
                    <strong>Free</strong> for onboarding earn rewards.
                    Candidates see and buy packs at{' '}
                    <span className="font-mono text-sky-700">/subscriptions</span> on Phase 1, and receive Free
                    tokens when they complete onboarding steps.
                  </p>
                </div>
              </>
            )}
          </>
        ) : null}
    </HqModulePageLayout>
  );
}
