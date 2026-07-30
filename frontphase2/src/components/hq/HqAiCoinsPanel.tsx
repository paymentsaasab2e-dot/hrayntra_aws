'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Lock, Pencil, X } from 'lucide-react';
import {
  apiHqListAiFeatures,
  apiHqSetTenantCoins,
  type HqAiFeature,
  type HqTenantRow,
} from '@/lib/api';
import {
  HqPanel,
  HqPanelTitle,
  HqPrimaryButton,
  HqSecondaryButton,
} from './hqUi';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100';

export function HqAiFeaturesCatalogPanel() {
  const [features, setFeatures] = useState<HqAiFeature[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiHqListAiFeatures()
      .then((res) => {
        if (!cancelled) setFeatures(res.data?.features || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load AI features');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byCategory = features.reduce<Record<string, HqAiFeature[]>>((acc, f) => {
    const key = f.category || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  return (
    <HqPanel>
      <HqPanelTitle title="Phase 2 AI features (coin-locked)" />
      <p className="mb-4 text-sm text-slate-500">
        These employer AI actions spend coins. When a tenant balance is too low, the feature stays locked until HQ
        tops up coins.
      </p>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : loading ? (
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
                      <th className="px-3 py-2 font-semibold">Feature</th>
                      <th className="px-3 py-2 font-semibold">Cost</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((f) => (
                      <tr key={f.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-900">{f.name}</p>
                          <p className="text-xs text-slate-500">{f.description}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <Coins className="h-3.5 w-3.5" />
                            {f.coins}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            <Lock className="h-3 w-3" />
                            Locked without coins
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </HqPanel>
  );
}

export function AssignCoinsModal({
  open,
  tenant,
  onClose,
  onSaved,
}: {
  open: boolean;
  tenant: HqTenantRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [coins, setCoins] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !tenant) return;
    setCoins(String(tenant.subscriptionPlan?.coins ?? 0));
    setError(null);
  }, [open, tenant]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const handleSave = useCallback(async () => {
    if (!tenant) return;
    setSubmitting(true);
    setError(null);
    try {
      const n = Math.max(0, Math.floor(Number(coins) || 0));
      await apiHqSetTenantCoins({ email: tenant.email, coins: n });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update coins');
    } finally {
      setSubmitting(false);
    }
  }, [tenant, coins, onClose, onSaved]);

  if (!open || !tenant) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assign AI coins</h2>
            <p className="mt-1 text-sm text-slate-500">
              {tenant.name} · {tenant.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
          ) : null}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Coin balance
            </label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={coins}
              onChange={(e) => setCoins(e.target.value)}
              placeholder="e.g. 500"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Tenant users spend these coins on Phase 2 AI features. At 0, AI actions stay locked.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <HqSecondaryButton type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </HqSecondaryButton>
          <HqPrimaryButton type="button" onClick={() => void handleSave()} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save coins'}
          </HqPrimaryButton>
        </div>
      </div>
    </div>
  );
}

export function TenantCoinsCell({
  tenant,
  onEdit,
}: {
  tenant: HqTenantRow;
  onEdit: (tenant: HqTenantRow) => void;
}) {
  const coins = Number(tenant.subscriptionPlan?.coins ?? 0);
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
          coins > 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'
        }`}
      >
        <Coins className="h-3.5 w-3.5" />
        {coins.toLocaleString()}
      </span>
      <button
        type="button"
        onClick={() => onEdit(tenant)}
        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        title="Assign coins"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
