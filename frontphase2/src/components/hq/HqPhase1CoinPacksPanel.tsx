'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Coins, Pencil, Plus, RefreshCcw, Save, Star, Trash2, X } from 'lucide-react';
import {
  apiHqGetPhase1TokenConfig,
  apiHqSavePhase1TokenPacks,
  type HqPhase1TokenPack,
} from '@/lib/api';
import { requestConfirm } from '@/lib/appDialog';
import { HqPanel, HqPanelTitle, HqPrimaryButton, HqSecondaryButton } from './hqUi';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100';

type PackDraft = {
  id: string;
  name: string;
  tokens: string;
  priceAmount: string;
  priceLabel: string;
  description: string;
  popular: boolean;
  active: boolean;
};

function formatPriceLabel(amount: number) {
  if (!Number.isFinite(amount)) return '$0';
  if (Number.isInteger(amount)) return `$${amount}`;
  return `$${amount.toFixed(2)}`;
}

function toDraft(pack: HqPhase1TokenPack): PackDraft {
  const priceAmount = Math.max(0, Number(pack.priceAmount) || 0);
  return {
    id: pack.id || '',
    name: pack.name || '',
    tokens: String(Math.max(0, Math.floor(Number(pack.tokens) || 0))),
    priceAmount: String(priceAmount),
    priceLabel: String(pack.priceLabel || '').trim() || formatPriceLabel(priceAmount),
    description: String(pack.description || ''),
    popular: Boolean(pack.popular),
    active: pack.active !== false,
  };
}

function emptyDraft(): PackDraft {
  return {
    id: '',
    name: '',
    tokens: '50',
    priceAmount: '5',
    priceLabel: '$5',
    description: '',
    popular: false,
    active: true,
  };
}

function normalizeDrafts(list: PackDraft[]): PackDraft[] {
  return list.map((p) => {
    const tokens = Math.max(0, Math.floor(Number(p.tokens) || 0));
    const priceAmount = Math.max(0, Number(p.priceAmount) || 0);
    return {
      id: p.id || '',
      name: p.name.trim(),
      tokens: String(tokens),
      priceAmount: String(priceAmount),
      priceLabel: formatPriceLabel(priceAmount),
      description: String(p.description || '').trim(),
      popular: Boolean(p.popular),
      active: p.active !== false,
    };
  });
}

function draftsEqual(a: PackDraft[], b: PackDraft[]) {
  return JSON.stringify(normalizeDrafts(a)) === JSON.stringify(normalizeDrafts(b));
}

function toPayload(list: PackDraft[]): HqPhase1TokenPack[] {
  return normalizeDrafts(list).map((p, index) => ({
    ...(p.id ? { id: p.id } : {}),
    name: p.name,
    tokens: Math.max(0, Math.floor(Number(p.tokens) || 0)),
    priceAmount: Math.max(0, Number(p.priceAmount) || 0),
    priceLabel: p.priceLabel,
    description: p.description,
    popular: Boolean(p.popular),
    active: p.active !== false,
    sortOrder: index,
    currency: 'USD',
  }));
}

export function HqPhase1CoinPacksPanel() {
  const [packs, setPacks] = useState<PackDraft[]>([]);
  const [baseline, setBaseline] = useState<PackDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<PackDraft>(emptyDraft());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiHqGetPhase1TokenConfig();
      const list = normalizeDrafts((res.data?.packs || []).map(toDraft));
      setPacks(list);
      setBaseline(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Phase 1 coin packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => !draftsEqual(packs, baseline), [packs, baseline]);

  const persistPacks = useCallback(async (nextPacks: PackDraft[], successMsg?: string) => {
    if (nextPacks.length === 0) {
      setError('Add at least one pack before saving');
      return false;
    }
    for (const p of nextPacks) {
      if (!p.name.trim()) {
        setError('Every pack needs a name');
        return false;
      }
      if (Math.max(0, Math.floor(Number(p.tokens) || 0)) <= 0) {
        setError('Every pack needs points greater than zero');
        return false;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiHqSavePhase1TokenPacks({ packs: toPayload(nextPacks) });
      const list = normalizeDrafts((res.data?.packs || []).map(toDraft));
      if (!list.length) {
        throw new Error('Save succeeded but no packs were returned — try Refresh');
      }
      setPacks(list);
      setBaseline(list);
      setSuccess(
        successMsg ||
          'Coin packs saved. Phase 1 candidates will see the updated packs on /subscriptions.'
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save packs');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const openCreate = () => {
    setEditingIndex(null);
    setForm(emptyDraft());
    setModalOpen(true);
    setError(null);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setForm({ ...packs[index] });
    setModalOpen(true);
    setError(null);
  };

  const upsertFromModal = async () => {
    const name = form.name.trim();
    const tokens = Math.max(0, Math.floor(Number(form.tokens) || 0));
    const priceAmount = Math.max(0, Number(form.priceAmount) || 0);
    if (!name) {
      setError('Pack name is required');
      return;
    }
    if (tokens <= 0) {
      setError('Points must be greater than zero');
      return;
    }

    const nextRow: PackDraft = {
      ...form,
      name,
      tokens: String(tokens),
      priceAmount: String(priceAmount),
      // Always sync label to amount so price edits show correctly
      priceLabel: formatPriceLabel(priceAmount),
      description: form.description.trim(),
    };

    let nextList = [...packs];
    if (editingIndex != null) {
      nextList[editingIndex] = nextRow;
    } else {
      nextList = [...nextList, nextRow];
    }
    if (nextRow.popular) {
      nextList = nextList.map((p, i) => ({
        ...p,
        popular: editingIndex != null ? i === editingIndex : i === nextList.length - 1,
      }));
    }

    setPacks(nextList);
    setModalOpen(false);
    // Persist immediately so Phase 1 updates without a second Save click
    const ok = await persistPacks(
      nextList,
      editingIndex != null
        ? `Updated “${name}”. Phase 1 will show the new points/price.`
        : `Created “${name}”. Phase 1 will show this pack.`
    );
    if (!ok) {
      // Keep local edits so user can retry Save packs
      setPacks(nextList);
    }
  };

  const removePack = async (index: number) => {
    const pack = packs[index];
    const ok = await requestConfirm(
      `Remove pack “${pack.name}”? Candidates will no longer see it.`,
      {
        tone: 'warning',
        title: 'Remove pack',
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
      },
    );
    if (!ok) return;
    const nextList = packs.filter((_, i) => i !== index);
    setPacks(nextList);
    await persistPacks(nextList, `Removed “${pack.name}”. Phase 1 catalog updated.`);
  };

  const handleSave = async () => {
    await persistPacks(packs);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Employee coin packs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Edit a pack and click Update — changes save to HQ and Phase 1 immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HqSecondaryButton type="button" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </HqSecondaryButton>
          <HqSecondaryButton type="button" onClick={openCreate} disabled={saving}>
            <Plus className="h-4 w-4" />
            Create pack
          </HqSecondaryButton>
          <HqPrimaryButton
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            loading={saving}
          >
            <Save className="h-4 w-4" />
            {dirty ? 'Save packs' : 'Saved'}
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
        <HqPanelTitle title="Packs shown to candidates" />
        {loading ? (
          <p className="py-6 text-sm text-slate-500">Loading…</p>
        ) : packs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <Coins className="mx-auto h-8 w-8 text-sky-500" />
            <p className="mt-2 text-sm font-medium text-slate-700">No packs yet</p>
            <HqPrimaryButton type="button" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create pack
            </HqPrimaryButton>
          </div>
        ) : (
          <div className="hq-table-scroll -mx-1">
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Points</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((pack, index) => (
                  <tr key={pack.id || `row-${index}`} className="border-b border-slate-50">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{pack.name}</span>
                        {pack.popular ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">
                            <Star className="h-2.5 w-2.5" />
                            Popular
                          </span>
                        ) : null}
                      </div>
                      {pack.description ? (
                        <p className="mt-0.5 max-w-md text-xs text-slate-500">{pack.description}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-semibold text-amber-800">
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5" />
                        {Number(pack.tokens || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {pack.priceLabel || formatPriceLabel(Number(pack.priceAmount) || 0)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          const nextList = packs.map((p, i) =>
                            i === index ? { ...p, active: !p.active } : p
                          );
                          setPacks(nextList);
                          void persistPacks(
                            nextList,
                            nextList[index].active
                              ? `“${pack.name}” is active for Phase 1.`
                              : `“${pack.name}” is hidden from Phase 1.`
                          );
                        }}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          pack.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {pack.active ? 'Active' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        {!pack.popular ? (
                          <button
                            type="button"
                            title="Mark popular"
                            disabled={saving}
                            onClick={() => {
                              const nextList = packs.map((p, i) => ({ ...p, popular: i === index }));
                              setPacks(nextList);
                              void persistPacks(nextList, `“${pack.name}” marked popular.`);
                            }}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-sky-600"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="rounded-lg p-2 text-sky-600">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(index)}
                          disabled={saving}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removePack(index)}
                          disabled={saving}
                          className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dirty ? (
          <p className="mt-3 text-xs font-medium text-amber-700">
            Unsaved changes — click Save packs (edits from the modal already auto-save).
          </p>
        ) : null}
      </HqPanel>

      {modalOpen ? (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => !saving && setModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingIndex != null ? 'Edit pack' : 'Create pack'}
              </h3>
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                Name
                <input
                  className={`${inputClass} mt-1`}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Points
                  <input
                    type="number"
                    min={1}
                    className={`${inputClass} mt-1`}
                    value={form.tokens}
                    onChange={(e) => setForm((f) => ({ ...f, tokens: e.target.value }))}
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Price (USD)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`${inputClass} mt-1`}
                    value={form.priceAmount}
                    onChange={(e) => {
                      const priceAmount = e.target.value;
                      const n = Math.max(0, Number(priceAmount) || 0);
                      setForm((f) => ({
                        ...f,
                        priceAmount,
                        priceLabel: formatPriceLabel(n),
                      }));
                    }}
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-600">
                Description
                <textarea
                  rows={2}
                  className={`${inputClass} mt-1 resize-none`}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.popular}
                  onChange={(e) => setForm((f) => ({ ...f, popular: e.target.checked }))}
                />
                Mark as popular
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <HqSecondaryButton type="button" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </HqSecondaryButton>
              <HqPrimaryButton type="button" onClick={() => void upsertFromModal()} loading={saving}>
                {editingIndex != null ? 'Update & save' : 'Add & save'}
              </HqPrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
