'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Lock, RefreshCcw, Save } from 'lucide-react';
import { apiHqListAiFeatures, apiHqUpdateAiFeatures, type HqAiFeature } from '@/lib/api';
import { HqPanel, HqPanelTitle, HqPrimaryButton, HqSecondaryButton } from './hqUi';

const inputClass =
  'w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100';

export function HqAiPlansPanel({
  onRefreshExtra,
}: {
  onRefreshExtra?: () => void;
} = {}) {
  const [features, setFeatures] = useState<HqAiFeature[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiHqListAiFeatures();
      const list = res.data?.features || [];
      setFeatures(list);
      const next: Record<string, string> = {};
      for (const f of list) next[f.id] = String(f.coins ?? 0);
      setDraft(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI features');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    return features.some((f) => {
      const current = Math.max(0, Math.floor(Number(draft[f.id]) || 0));
      return current !== Math.max(0, Number(f.coins) || 0);
    });
  }, [features, draft]);

  const byCategory = useMemo(() => {
    return features.reduce<Record<string, HqAiFeature[]>>((acc, f) => {
      const key = f.category || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    }, {});
  }, [features]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = features.map((f) => ({
        id: f.id,
        coins: Math.max(0, Math.floor(Number(draft[f.id]) || 0)),
      }));
      const res = await apiHqUpdateAiFeatures({ features: payload });
      const list = res.data?.features || [];
      setFeatures(list);
      const next: Record<string, string> = {};
      for (const f of list) next[f.id] = String(f.coins ?? 0);
      setDraft(next);
      setSuccess('AI coin costs saved. Phase 2 will spend these amounts on each AI action.');
      onRefreshExtra?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI feature costs');
    } finally {
      setSaving(false);
    }
  };

  const resetRow = (feature: HqAiFeature) => {
    const fallback = feature.defaultCoins ?? feature.coins ?? 0;
    setDraft((prev) => ({ ...prev, [feature.id]: String(fallback) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">AI Plans</h2>
          <p className="mt-1 text-sm text-slate-500">
            Set how many coins each Phase 2 AI feature spends. Tenants are charged these amounts when they use AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HqSecondaryButton type="button" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </HqSecondaryButton>
          <HqPrimaryButton type="button" onClick={() => void handleSave()} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save coin costs'}
          </HqPrimaryButton>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <HqPanel>
        <HqPanelTitle title="Phase 2 AI feature coin prices" />
        <p className="mb-4 text-sm text-slate-500">
          Example: set &quot;AI job from prompt&quot; to <strong>10</strong> coins — creating a job with AI in Phase 2 will
          spend 10 coins from that tenant&apos;s balance.
        </p>

        {loading && features.length === 0 ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(byCategory).map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{category}</h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-2.5 font-semibold">Feature</th>
                        <th className="px-3 py-2.5 font-semibold">Default</th>
                        <th className="px-3 py-2.5 font-semibold">Coin cost</th>
                        <th className="px-3 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Reset</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((f) => {
                        const draftVal = draft[f.id] ?? String(f.coins);
                        const changed =
                          Math.max(0, Math.floor(Number(draftVal) || 0)) !==
                          Math.max(0, Number(f.coins) || 0);
                        return (
                          <tr key={f.id} className="border-b border-slate-50 last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900">{f.name}</p>
                              <p className="text-xs text-slate-500">{f.description}</p>
                              <p className="mt-0.5 font-mono text-[10px] text-slate-400">{f.id}</p>
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-500">
                              {f.defaultCoins ?? f.coins} coins
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
                                    setDraft((prev) => ({ ...prev, [f.id]: e.target.value }))
                                  }
                                />
                                {changed ? (
                                  <span className="text-[10px] font-bold uppercase text-amber-600">Edited</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                <Lock className="h-3 w-3" />
                                Spends on use
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => resetRow(f)}
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
    </div>
  );
}
