'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Coins, Pencil, Plus, RefreshCcw, Save, Star, Trash2, X } from 'lucide-react';
import {
  apiHqListAiCoinPacks,
  apiHqSaveAiCoinPacks,
  type HqAiCoinPack,
} from '@/lib/api';
import { requestConfirm } from '@/lib/appDialog';
import { HqPanel, HqPanelTitle, HqPrimaryButton, HqSecondaryButton } from './hqUi';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100';

type PackDraft = {
  id: string;
  name: string;
  coins: string;
  priceUsd: string;
  priceLabel: string;
  description: string;
  popular: boolean;
  active: boolean;
};

function toDraft(pack: HqAiCoinPack): PackDraft {
  return {
    id: pack.id,
    name: pack.name || '',
    coins: String(pack.coins ?? ''),
    priceUsd: String(pack.priceUsd ?? ''),
    priceLabel: pack.priceLabel || '',
    description: pack.description || '',
    popular: Boolean(pack.popular),
    active: pack.active !== false,
  };
}

function emptyDraft(): PackDraft {
  return {
    id: '',
    name: '',
    coins: '100',
    priceUsd: '9',
    priceLabel: '',
    description: '',
    popular: false,
    active: true,
  };
}

function draftsEqual(a: PackDraft[], b: PackDraft[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function HqAiCoinPacksPanel() {
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
      const res = await apiHqListAiCoinPacks();
      const list = (res.data?.packs || []).map(toDraft);
      setPacks(list);
      setBaseline(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coin packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => !draftsEqual(packs, baseline), [packs, baseline]);

  const openCreate = () => {
    setEditingIndex(null);
    setForm(emptyDraft());
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setForm({ ...packs[index] });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingIndex(null);
  };

  const upsertFromModal = () => {
    const name = form.name.trim();
    const coins = Math.max(0, Math.floor(Number(form.coins) || 0));
    const priceUsd = Math.max(0, Number(form.priceUsd) || 0);
    if (!name) {
      setError('Pack name is required');
      return;
    }
    if (coins <= 0) {
      setError('Coins must be greater than zero');
      return;
    }

    const nextRow: PackDraft = {
      ...form,
      name,
      coins: String(coins),
      priceUsd: String(priceUsd),
      priceLabel: form.priceLabel.trim() || (Number.isInteger(priceUsd) ? `$${priceUsd}` : `$${priceUsd.toFixed(2)}`),
      description: form.description.trim(),
    };

    setPacks((prev) => {
      let list = [...prev];
      if (editingIndex != null) {
        list[editingIndex] = nextRow;
      } else {
        list = [...list, nextRow];
      }
      if (nextRow.popular) {
        list = list.map((p, i) => ({
          ...p,
          popular: editingIndex != null ? i === editingIndex : i === list.length - 1,
        }));
      }
      return list;
    });
    setError(null);
    setModalOpen(false);
    setEditingIndex(null);
  };

  const removePack = async (index: number) => {
    const pack = packs[index];
    const ok = await requestConfirm(
      `Remove pack “${pack.name}”? Phase 2 tenants will no longer see it.`,
      {
        tone: 'warning',
        title: 'Remove pack',
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
      },
    );
    if (!ok) return;
    setPacks((prev) => prev.filter((_, i) => i !== index));
  };

  const setPopular = (index: number) => {
    setPacks((prev) => prev.map((p, i) => ({ ...p, popular: i === index })));
  };

  const toggleActive = (index: number) => {
    setPacks((prev) =>
      prev.map((p, i) => (i === index ? { ...p, active: !p.active } : p))
    );
  };

  const handleSave = async () => {
    if (packs.length === 0) {
      setError('Add at least one coin pack before saving');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = packs.map((p, index) => ({
        id: p.id || undefined,
        name: p.name.trim(),
        coins: Math.max(0, Math.floor(Number(p.coins) || 0)),
        priceUsd: Math.max(0, Number(p.priceUsd) || 0),
        priceLabel: p.priceLabel.trim(),
        description: p.description.trim(),
        popular: Boolean(p.popular),
        active: p.active !== false,
        sortOrder: index,
      }));
      const res = await apiHqSaveAiCoinPacks({ packs: payload as HqAiCoinPack[] });
      const list = (res.data?.packs || []).map(toDraft);
      setPacks(list);
      setBaseline(list);
      setSuccess('Coin packs saved. Phase 2 purchase modal will show these packs.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save coin packs');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">AI coin packs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create purchase packs (name, coins, price). Tenants see them in the Buy AI coins modal.
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
          <HqPrimaryButton type="button" onClick={() => void handleSave()} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save packs'}
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
        <HqPanelTitle title="Packs shown at purchase" />
        {loading ? (
          <p className="px-1 py-6 text-sm text-slate-500">Loading packs…</p>
        ) : packs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <Coins className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-2 text-sm font-medium text-slate-700">No packs yet</p>
            <p className="mt-1 text-xs text-slate-500">Create a pack to offer tenants a way to buy AI coins.</p>
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
                  <th>Coins</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((pack, index) => (
                  <tr key={pack.id || `new-${index}`} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <div>
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
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                        <Coins className="h-3.5 w-3.5" />
                        {Number(pack.coins || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-800">
                      {pack.priceLabel || `$${pack.priceUsd}`}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(index)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          pack.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {pack.active ? 'Active' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!pack.popular ? (
                          <button
                            type="button"
                            title="Mark popular"
                            onClick={() => setPopular(index)}
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
                          title="Edit"
                          onClick={() => openEdit(index)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Remove"
                          onClick={() => void removePack(index)}
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
            Unsaved changes — click Save packs to publish to Phase 2.
          </p>
        ) : null}
      </HqPanel>

      {modalOpen ? (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={closeModal} aria-label="Close" />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingIndex != null ? 'Edit coin pack' : 'Create coin pack'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">Shown in the tenant Buy AI coins modal.</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50">
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
                  placeholder="e.g. Growth"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Coins
                  <input
                    type="number"
                    min={1}
                    className={`${inputClass} mt-1`}
                    value={form.coins}
                    onChange={(e) => setForm((f) => ({ ...f, coins: e.target.value }))}
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Price (USD)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`${inputClass} mt-1`}
                    value={form.priceUsd}
                    onChange={(e) => setForm((f) => ({ ...f, priceUsd: e.target.value }))}
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-600">
                Price label (optional)
                <input
                  className={`${inputClass} mt-1`}
                  value={form.priceLabel}
                  onChange={(e) => setForm((f) => ({ ...f, priceLabel: e.target.value }))}
                  placeholder="Auto from price if empty, e.g. $39"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Description
                <textarea
                  rows={2}
                  className={`${inputClass} mt-1 resize-none`}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short line shown under the pack name"
                />
              </label>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.popular}
                    onChange={(e) => setForm((f) => ({ ...f, popular: e.target.checked }))}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-200"
                  />
                  Mark as popular
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-200"
                  />
                  Active (visible to tenants)
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <HqSecondaryButton type="button" onClick={closeModal}>
                Cancel
              </HqSecondaryButton>
              <HqPrimaryButton type="button" onClick={upsertFromModal}>
                {editingIndex != null ? 'Update pack' : 'Add pack'}
              </HqPrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
