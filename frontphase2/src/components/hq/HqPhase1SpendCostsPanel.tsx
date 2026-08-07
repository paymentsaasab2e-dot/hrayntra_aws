'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Gift, Lock, RefreshCcw, Save, Sparkles } from 'lucide-react';
import {
  apiHqGetPhase1TokenConfig,
  apiHqSavePhase1TokenCosts,
  apiHqSavePhase1TokenEarns,
  type HqPhase1EarnTask,
  type HqPhase1TokenService,
} from '@/lib/api';
import { HqPanel, HqPanelTitle, HqPrimaryButton, HqSecondaryButton } from './hqUi';

const inputClass =
  'w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100';

type SpendSubTab = 'premium' | 'free';

const FALLBACK_FREE_EARNS: HqPhase1EarnTask[] = [
  { id: 'welcome', name: 'First login bonus', description: 'Automatic when candidates open the dashboard after signup', tokens: 20, category: 'Onboarding', order: 1 },
  { id: 'earn.cv_upload', name: 'Upload your CV', description: 'Upload a resume once (also credited if CV was added during signup)', tokens: 20, category: 'Onboarding', order: 2 },
  { id: 'earn.profile.basicInformation', name: 'Complete basic details', description: 'Fill personal profile basics', tokens: 10, category: 'Profile', order: 3 },
  { id: 'earn.profile.summary', name: 'Add professional summary', description: 'Write your profile summary', tokens: 5, category: 'Profile', order: 4 },
  { id: 'earn.profile.education', name: 'Add education', description: 'Complete education section', tokens: 10, category: 'Profile', order: 5 },
  { id: 'earn.profile.skills', name: 'Add skills', description: 'Complete skills section', tokens: 10, category: 'Profile', order: 6 },
  { id: 'earn.profile.languages', name: 'Add languages', description: 'Complete languages section', tokens: 5, category: 'Profile', order: 7 },
  { id: 'earn.profile.projects', name: 'Add a project', description: 'Complete projects section', tokens: 5, category: 'Profile', order: 8 },
  { id: 'earn.profile.careerPreferences', name: 'Set career preferences', description: 'Complete career preferences', tokens: 5, category: 'Profile', order: 9 },
];

export function HqPhase1SpendCostsPanel() {
  const [subTab, setSubTab] = useState<SpendSubTab>('premium');
  const [services, setServices] = useState<HqPhase1TokenService[]>([]);
  const [earns, setEarns] = useState<HqPhase1EarnTask[]>(FALLBACK_FREE_EARNS);
  const [spendDraft, setSpendDraft] = useState<Record<string, string>>({});
  const [earnDraft, setEarnDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiHqGetPhase1TokenConfig();
      const list = res.data?.services || [];
      setServices(list);
      const nextSpend: Record<string, string> = {};
      for (const s of list) nextSpend[s.id] = String(s.cost ?? 0);
      setSpendDraft(nextSpend);

      const earnList =
        Array.isArray(res.data?.earns) && res.data.earns.length
          ? [...res.data.earns].sort((a, b) => (a.order || 0) - (b.order || 0))
          : FALLBACK_FREE_EARNS.map((t) => ({
              ...t,
              tokens: res.data?.earnRewards?.[t.id] ?? t.tokens,
              defaultTokens: t.tokens,
            }));
      setEarns(earnList);
      const nextEarn: Record<string, string> = {};
      for (const e of earnList) nextEarn[e.id] = String(e.tokens ?? 0);
      setEarnDraft(nextEarn);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spend / earn config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const spendDirty = useMemo(() => {
    return services.some((s) => {
      const current = Math.max(0, Math.floor(Number(spendDraft[s.id]) || 0));
      return current !== Math.max(0, Number(s.cost) || 0);
    });
  }, [services, spendDraft]);

  const earnDirty = useMemo(() => {
    return earns.some((e) => {
      const current = Math.max(0, Math.floor(Number(earnDraft[e.id]) || 0));
      return current !== Math.max(0, Number(e.tokens) || 0);
    });
  }, [earns, earnDraft]);

  const spendEditedCount = useMemo(
    () =>
      services.filter((s) => {
        const current = Math.max(0, Math.floor(Number(spendDraft[s.id]) || 0));
        return current !== Math.max(0, Number(s.cost) || 0);
      }).length,
    [services, spendDraft]
  );

  const earnEditedCount = useMemo(
    () =>
      earns.filter((e) => {
        const current = Math.max(0, Math.floor(Number(earnDraft[e.id]) || 0));
        return current !== Math.max(0, Number(e.tokens) || 0);
      }).length,
    [earns, earnDraft]
  );

  const byCategory = useMemo(() => {
    return services.reduce<Record<string, HqPhase1TokenService[]>>((acc, s) => {
      const key = s.category || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});
  }, [services]);

  const earnsByCategory = useMemo(() => {
    return earns.reduce<Record<string, HqPhase1EarnTask[]>>((acc, e) => {
      const key = e.category || 'Onboarding';
      if (!acc[key]) acc[key] = [];
      acc[key].push(e);
      return acc;
    }, {});
  }, [earns]);

  const dirty = subTab === 'premium' ? spendDirty : earnDirty;
  const editedCount = subTab === 'premium' ? spendEditedCount : earnEditedCount;

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (subTab === 'premium') {
        const payload = services.map((s) => ({
          id: s.id,
          cost: Math.max(0, Math.floor(Number(spendDraft[s.id]) || 0)),
        }));
        const res = await apiHqSavePhase1TokenCosts({ services: payload });
        const list = res.data?.services || [];
        setServices(list);
        const next: Record<string, string> = {};
        for (const s of list) next[s.id] = String(s.cost ?? 0);
        setSpendDraft(next);
        const changed = res.data?.changed || [];
        setSuccess(
          changed.length
            ? `Saved premium spend costs. ${changed
                .slice(0, 3)
                .map((c) => `${c.name}: ${c.previous} → ${c.cost}`)
                .join(' · ')}`
            : 'Premium spend costs saved.'
        );
      } else {
        const payload = earns.map((e) => ({
          id: e.id,
          tokens: Math.max(0, Math.floor(Number(earnDraft[e.id]) || 0)),
        }));
        const res = await apiHqSavePhase1TokenEarns({ earns: payload });
        const list =
          Array.isArray(res.data?.earns) && res.data.earns.length
            ? [...res.data.earns].sort((a, b) => (a.order || 0) - (b.order || 0))
            : earns.map((e) => ({
                ...e,
                tokens: Math.max(0, Math.floor(Number(earnDraft[e.id]) || 0)),
              }));
        setEarns(list);
        const next: Record<string, string> = {};
        for (const e of list) next[e.id] = String(e.tokens ?? 0);
        setEarnDraft(next);
        const changed = res.data?.changed || [];
        setSuccess(
          changed.length
            ? `Saved free earn rewards. Candidates will receive: ${changed
                .slice(0, 3)
                .map((c) => `${c.name}: ${c.previous} → ${c.tokens}`)
                .join(' · ')}`
            : 'Free onboarding earn rewards saved.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Spend points</h2>
          <p className="mt-1 text-sm text-slate-500">
            Premium sets what features cost. Free sets how many tokens employees earn for onboarding &amp; profile steps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HqSecondaryButton type="button" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </HqSecondaryButton>
          <HqPrimaryButton type="button" onClick={() => void handleSave()} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving
              ? 'Saving…'
              : dirty
                ? `Save ${subTab === 'premium' ? 'spend' : 'earn'} (${editedCount})`
                : subTab === 'premium'
                  ? 'Save spend costs'
                  : 'Save earn rewards'}
          </HqPrimaryButton>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setSubTab('premium');
            setSuccess(null);
            setError(null);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
            subTab === 'premium' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Premium
        </button>
        <button
          type="button"
          onClick={() => {
            setSubTab('free');
            setSuccess(null);
            setError(null);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
            subTab === 'free' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Gift className="h-4 w-4" />
          Free
        </button>
      </div>

      {dirty ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have <strong>{editedCount}</strong> unsaved change{editedCount === 1 ? '' : 's'}. Click Save to update Phase 1.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      {subTab === 'premium' ? (
        <HqPanel>
          <HqPanelTitle title="Premium feature point prices" />
          {loading && services.length === 0 ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(byCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{category}</h3>
                  <div className="hq-table-wrap overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr>
                          <th>Feature</th>
                          <th>Default</th>
                          <th>Point cost</th>
                          <th>Status</th>
                          <th className="text-right">Reset</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((s) => {
                          const draftVal = spendDraft[s.id] ?? String(s.cost);
                          const changed =
                            Math.max(0, Math.floor(Number(draftVal) || 0)) !==
                            Math.max(0, Number(s.cost) || 0);
                          return (
                            <tr key={s.id} className="border-b border-slate-50 last:border-0">
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{s.name}</p>
                                <p className="text-xs text-slate-500">{s.description}</p>
                                <p className="mt-0.5 font-mono text-[10px] text-slate-400">{s.id}</p>
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-500">
                                {s.defaultCost ?? s.cost} pts
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <Coins className="h-4 w-4 text-amber-500" />
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    className={inputClass}
                                    value={draftVal}
                                    onChange={(e) =>
                                      setSpendDraft((prev) => ({ ...prev, [s.id]: e.target.value }))
                                    }
                                  />
                                  {changed ? (
                                    <span className="text-[10px] font-bold uppercase text-amber-600">Edited</span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                  <Lock className="h-3 w-3" />
                                  Spends on use
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSpendDraft((prev) => ({
                                      ...prev,
                                      [s.id]: String(s.defaultCost ?? s.cost ?? 0),
                                    }))
                                  }
                                  className="text-xs font-semibold text-sky-700 hover:underline"
                                >
                                  Default
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </HqPanel>
      ) : (
        <HqPanel>
          <HqPanelTitle
            title="Free · Onboarding earn rewards"
            meta={
              <span className="text-[11px] font-semibold text-slate-400">
                Tokens credited when employees complete each step
              </span>
            }
          />
          <p className="mb-4 text-sm text-slate-500">
            Set how many free tokens a candidate receives for each onboarding / profile task. Changes apply on Phase 1
            immediately after save.
          </p>
          {loading && earns.length === 0 ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(earnsByCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{category}</h3>
                  <div className="hq-table-wrap overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Task</th>
                          <th>Default</th>
                          <th>Tokens awarded</th>
                          <th>Type</th>
                          <th className="text-right">Reset</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((e) => {
                          const draftVal = earnDraft[e.id] ?? String(e.tokens);
                          const changed =
                            Math.max(0, Math.floor(Number(draftVal) || 0)) !==
                            Math.max(0, Number(e.tokens) || 0);
                          return (
                            <tr key={e.id} className="border-b border-slate-50 last:border-0">
                              <td className="px-4 py-3 text-sm font-semibold text-slate-400">
                                {e.order ?? '—'}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{e.name}</p>
                                <p className="text-xs text-slate-500">{e.description}</p>
                                <p className="mt-0.5 font-mono text-[10px] text-slate-400">{e.id}</p>
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-500">
                                {e.defaultTokens ?? e.tokens} pts
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <Gift className="h-4 w-4 text-emerald-500" />
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    className={inputClass}
                                    value={draftVal}
                                    onChange={(ev) =>
                                      setEarnDraft((prev) => ({ ...prev, [e.id]: ev.target.value }))
                                    }
                                  />
                                  {changed ? (
                                    <span className="text-[10px] font-bold uppercase text-amber-600">Edited</span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                                  Free earn
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEarnDraft((prev) => ({
                                      ...prev,
                                      [e.id]: String(e.defaultTokens ?? e.tokens ?? 0),
                                    }))
                                  }
                                  className="text-xs font-semibold text-sky-700 hover:underline"
                                >
                                  Default
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </HqPanel>
      )}
    </div>
  );
}
