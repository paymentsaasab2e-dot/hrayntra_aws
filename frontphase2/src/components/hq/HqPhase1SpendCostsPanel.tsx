'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Lock, RefreshCcw, Save } from 'lucide-react';
import {
  apiHqGetPhase1TokenConfig,
  apiHqSavePhase1TokenCosts,
  type HqPhase1TokenService,
} from '@/lib/api';
import { HqPanel, HqPanelTitle, HqPrimaryButton, HqSecondaryButton } from './hqUi';

const inputClass =
  'w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100';

export function HqPhase1SpendCostsPanel() {
  const [services, setServices] = useState<HqPhase1TokenService[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
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
      const next: Record<string, string> = {};
      for (const s of list) next[s.id] = String(s.cost ?? 0);
      setDraft(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spend costs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    return services.some((s) => {
      const current = Math.max(0, Math.floor(Number(draft[s.id]) || 0));
      return current !== Math.max(0, Number(s.cost) || 0);
    });
  }, [services, draft]);

  const editedCount = useMemo(
    () =>
      services.filter((s) => {
        const current = Math.max(0, Math.floor(Number(draft[s.id]) || 0));
        return current !== Math.max(0, Number(s.cost) || 0);
      }).length,
    [services, draft]
  );

  const byCategory = useMemo(() => {
    return services.reduce<Record<string, HqPhase1TokenService[]>>((acc, s) => {
      const key = s.category || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});
  }, [services]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = services.map((s) => ({
        id: s.id,
        cost: Math.max(0, Math.floor(Number(draft[s.id]) || 0)),
      }));
      const res = await apiHqSavePhase1TokenCosts({ services: payload });
      const list = res.data?.services || [];
      setServices(list);
      const next: Record<string, string> = {};
      for (const s of list) next[s.id] = String(s.cost ?? 0);
      setDraft(next);
      const changed = res.data?.changed || [];
      setSuccess(
        changed.length
          ? `Saved. Phase 1 will spend new amounts. ${changed
              .slice(0, 3)
              .map((c) => `${c.name}: ${c.previous} → ${c.cost}`)
              .join(' · ')}`
          : 'Spend costs saved.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save spend costs');
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
            Set how many points each Phase 1 employee feature costs. Candidates are charged these when they use AI / LMS unlocks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HqSecondaryButton type="button" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </HqSecondaryButton>
          <HqPrimaryButton type="button" onClick={() => void handleSave()} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : dirty ? `Save spend costs (${editedCount})` : 'Save spend costs'}
          </HqPrimaryButton>
        </div>
      </div>

      {dirty ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have <strong>{editedCount}</strong> unsaved change{editedCount === 1 ? '' : 's'}. Click Save to update Phase 1 spending.
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

      <HqPanel>
        <HqPanelTitle title="Phase 1 feature point prices" />
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
                        const draftVal = draft[s.id] ?? String(s.cost);
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
                                    setDraft((prev) => ({ ...prev, [s.id]: e.target.value }))
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
                                  setDraft((prev) => ({
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
    </div>
  );
}
