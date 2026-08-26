'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiGetOrgCommissionSlabs, apiSetOrgCommissionSlabs } from '../../lib/api';
import {
  DEFAULT_COMMISSION_SLAB_SETTINGS,
  resolveCommissionPercent,
  suggestedFxRate,
  type CommissionSlab,
  type CommissionSlabSettings,
} from '../../lib/commissionSlabs';
import { SUPPORTED_CURRENCIES, formatCurrencyAmount } from '../../utils/currency';
import { usePermissions } from '../../hooks/usePermissions';

function emptySlab(): CommissionSlab {
  return {
    id: `slab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    minSalary: 0,
    maxSalary: null,
    percent: 8.33,
  };
}

function formatRange(slab: CommissionSlab, currency?: string) {
  const code = currency || '';
  const min = `${code ? `${code} ` : ''}${Number(slab.minSalary || 0).toLocaleString()}`;
  if (slab.maxSalary == null || slab.maxSalary === undefined) return `${min} and above`;
  return `${min} – ${code ? `${code} ` : ''}${Number(slab.maxSalary).toLocaleString()}`;
}

export function CommissionSlabSettings() {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canManage = hasPermission('manage_settings') || isSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CommissionSlabSettings>(DEFAULT_COMMISSION_SLAB_SETTINGS);
  const [sampleSalary, setSampleSalary] = useState('800000');

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiGetOrgCommissionSlabs();
      setDraft({
        ...DEFAULT_COMMISSION_SLAB_SETTINGS,
        ...(res.data?.commissionSlabs || {}),
      });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load commission slabs');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = useMemo(
    () =>
      resolveCommissionPercent(draft, {
        offerSalary: sampleSalary,
        offerCurrency: draft.salaryCurrency,
      }),
    [draft, sampleSalary],
  );

  const currencies = Array.from(new Set([...SUPPORTED_CURRENCIES, 'CNY']));

  const updateSlab = (id: string, patch: Partial<CommissionSlab>) => {
    setDraft((current) => ({
      ...current,
      slabs: current.slabs.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiSetOrgCommissionSlabs(draft);
      setDraft(res.data?.commissionSlabs || draft);
      toast.success('Commission slabs saved');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save commission slabs');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Only the tenant super admin, or a person with organization settings permission, can create or change commission slabs.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading commission slabs…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Charge commission from salary slabs</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Set salary bands in one currency, and charge commission in another if you bill clients that way.
              When a candidate on a job gets an offer or is placed, the matching slab is applied automatically
              to the placement fee and draft invoice.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((c) => ({ ...c, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Use slabs
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-600">Salary used to pick the slab</p>
            <div className="mt-2 space-y-2">
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <input
                  type="radio"
                  name="commission-basis"
                  checked={draft.basis === 'offer_salary'}
                  onChange={() => setDraft((c) => ({ ...c, basis: 'offer_salary' }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold text-slate-800">Offer salary</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Per candidate, from the offer / placement salary. Falls back to the job range if offer is empty.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <input
                  type="radio"
                  name="commission-basis"
                  checked={draft.basis === 'job_salary'}
                  onChange={() => setDraft((c) => ({ ...c, basis: 'job_salary' }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold text-slate-800">Job salary range</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Uses the midpoint of the job min–max (or the single amount on the job).
                  </span>
                </span>
              </label>
            </div>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Fallback % if salary matches no slab
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={draft.fallbackPercent}
              onChange={(e) => setDraft((c) => ({ ...c, fallbackPercent: Number(e.target.value) }))}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-600">
            Salary range currency
            <select
              value={draft.salaryCurrency}
              onChange={(e) => {
                const salaryCurrency = e.target.value;
                setDraft((c) => ({
                  ...c,
                  salaryCurrency,
                  fxRate:
                    salaryCurrency === c.commissionCurrency
                      ? null
                      : suggestedFxRate(salaryCurrency, c.commissionCurrency),
                }));
              }}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <span className="mt-1 block font-normal text-slate-500">Min/max bands are entered in this currency.</span>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Commission / invoice currency
            <select
              value={draft.commissionCurrency}
              onChange={(e) => {
                const commissionCurrency = e.target.value;
                setDraft((c) => ({
                  ...c,
                  commissionCurrency,
                  fxRate:
                    c.salaryCurrency === commissionCurrency
                      ? null
                      : suggestedFxRate(c.salaryCurrency, commissionCurrency),
                }));
              }}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <span className="mt-1 block font-normal text-slate-500">Placement fee and invoices are billed in this currency.</span>
          </label>
          {draft.salaryCurrency !== draft.commissionCurrency ? (
            <label className="block text-xs font-semibold text-slate-600">
              Rate: 1 {draft.salaryCurrency} =
              <input
                type="number"
                min={0}
                step="0.0001"
                value={draft.fxRate ?? ''}
                onChange={(e) =>
                  setDraft((c) => ({
                    ...c,
                    fxRate: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              />
              <span className="mt-1 block font-normal text-slate-500">
                {draft.commissionCurrency}. Used to convert salary into the charge currency.
              </span>
            </label>
          ) : (
            <p className="self-end text-xs text-slate-500">Salary and commission use the same currency — no conversion.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Slabs</h3>
            <p className="mt-1 text-xs text-slate-500">
              Leave max empty for an open-ended top band. Amounts are in {draft.salaryCurrency}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDraft((c) => ({ ...c, slabs: [...c.slabs, emptySlab()] }))}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add slab
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {draft.slabs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No slabs yet. Add bands such as 0–5L at 8.33%, 5–10L at 10%.</p>
          ) : (
            draft.slabs.map((slab) => (
              <div key={slab.id} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-12 sm:items-end">
                <label className="sm:col-span-3 text-xs font-semibold text-slate-600">
                  Min salary ({draft.salaryCurrency})
                  <input
                    type="number"
                    min={0}
                    value={slab.minSalary}
                    onChange={(e) => updateSlab(slab.id, { minSalary: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="sm:col-span-3 text-xs font-semibold text-slate-600">
                  Max salary ({draft.salaryCurrency})
                  <input
                    type="number"
                    min={0}
                    placeholder="Open ended"
                    value={slab.maxSalary ?? ''}
                    onChange={(e) =>
                      updateSlab(slab.id, {
                        maxSalary: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="sm:col-span-3 text-xs font-semibold text-slate-600">
                  Commission %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={slab.percent}
                    onChange={(e) => updateSlab(slab.id, { percent: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="sm:col-span-3 flex items-center justify-between gap-2 pb-0.5">
                  <p className="text-[11px] leading-4 text-slate-500">{formatRange(slab, draft.salaryCurrency)}</p>
                  <button
                    type="button"
                    onClick={() => setDraft((c) => ({ ...c, slabs: c.slabs.filter((row) => row.id !== slab.id) }))}
                    className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                    aria-label="Remove slab"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-semibold text-slate-600">Try a salary ({draft.salaryCurrency})</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <input
            type="number"
            min={0}
            value={sampleSalary}
            onChange={(e) => setSampleSalary(e.target.value)}
            className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <p className="text-sm text-slate-700">
            {preview.percent}% →{' '}
            <span className="font-bold">
              {formatCurrencyAmount(preview.fee || 0, preview.commissionCurrency || draft.commissionCurrency)}
            </span>
            {preview.slab ? ` · ${formatRange(preview.slab, draft.salaryCurrency)}` : ' · fallback'}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save commission slabs'}
        </button>
      </div>
    </div>
  );
}
