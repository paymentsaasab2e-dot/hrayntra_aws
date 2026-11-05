'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Pencil, Plus, RefreshCcw, Save, Star, Trash2, X } from 'lucide-react';
import {
  apiHqListFreeJobPacks,
  apiHqSaveFreeJobPacks,
  type HqFreeJobPack,
} from '@/lib/api';
import { requestConfirm } from '@/lib/appDialog';
import { HqPanel, HqPanelTitle, HqPrimaryButton, HqSecondaryButton } from './hqUi';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

type PackDraft = {
  id: string;
  name: string;
  monthlyLimit: string;
  durationDays: string;
  priceUsd: string;
  priceLabel: string;
  description: string;
  popular: boolean;
  active: boolean;
};

function toDraft(pack: HqFreeJobPack): PackDraft {
  return {
    id: pack.id,
    name: pack.name || '',
    monthlyLimit: String(pack.monthlyLimit ?? ''),
    durationDays: String(pack.durationDays ?? 30),
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
    monthlyLimit: '50',
    durationDays: '30',
    priceUsd: '19',
    priceLabel: '',
    description: '',
    popular: false,
    active: true,
  };
}

function draftsEqual(a: PackDraft[], b: PackDraft[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function HqFreeJobPacksPanel() {
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
      const res = await apiHqListFreeJobPacks();
      const list = (res.data?.packs || []).map(toDraft);
      setPacks(list);
      setBaseline(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Free Jobs packs');
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
    const monthlyLimit = Math.max(1, Math.floor(Number(form.monthlyLimit) || 0));
    const durationDays = Math.max(1, Math.floor(Number(form.durationDays) || 30));
    const priceUsd = Math.max(0, Number(form.priceUsd) || 0);
    if (!name) {
      setError('Pack name is required');
      return;
    }
    if (monthlyLimit <= 0) {
      setError('Monthly job limit must be greater than zero');
      return;
    }
    if (!(priceUsd > 0)) {
      setError('Price (USD) must be greater than zero');
      return;
    }

    const nextRow: PackDraft = {
      ...form,
      name,
      monthlyLimit: String(monthlyLimit),
      durationDays: String(durationDays),
      priceUsd: String(priceUsd),
      priceLabel:
        form.priceLabel.trim() ||
        (Number.isInteger(priceUsd) ? `$${priceUsd}` : `$${priceUsd.toFixed(2)}`),
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
      `Remove pack “${pack.name}”? Free Jobs tenants will no longer see it at checkout.`,
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
    setPacks((prev) => prev.map((p, i) => (i === index ? { ...p, active: !p.active } : p)));
  };

  const handleSave = async () => {
    if (packs.length === 0) {
      setError('Add at least one Free Jobs pack before saving');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = packs.map((p, index) => ({
        id: p.id || undefined,
        name: p.name.trim(),
        monthlyLimit: Math.max(1, Math.floor(Number(p.monthlyLimit) || 0)),
        durationDays: Math.max(1, Math.floor(Number(p.durationDays) || 30)),
        priceUsd: Math.max(0, Number(p.priceUsd) || 0),
        priceLabel: p.priceLabel.trim(),
        description: p.description.trim(),
        popular: Boolean(p.popular),
        active: p.active !== false,
        sortOrder: index,
      }));
      const res = await apiHqSaveFreeJobPacks({ packs: payload as HqFreeJobPack[] });
      const list = (res.data?.packs || []).map(toDraft);
      setPacks(list);
      setBaseline(list);
      setSuccess('Packs saved. Free Jobs tenants see these when their publish quota is exhausted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Free Jobs packs');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Upgrade packs (Razorpay)</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Create packs Free Jobs tenants buy when monthly posts run out.
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <HqPanel>
        <HqPanelTitle title="Packs shown in Free Jobs upgrade modal" />
        {loading ? (
          <p className="px-1 py-6 text-sm text-slate-500">Loading packs…</p>
        ) : packs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="mt-2 text-sm font-medium text-slate-700">No packs yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Create a pack so Free Jobs tenants can pay with Razorpay for more posts.
            </p>
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
                  <th>Jobs / mo</th>
                  <th>Days</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((pack, index) => (
                  <tr key={pack.id || `new-${index}`} className="border-b border-slate-50 last:border-0">
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
                    <td className="px-3 py-3 font-semibold text-slate-800">{pack.monthlyLimit}</td>
                    <td className="px-3 py-3 text-slate-700">{pack.durationDays}</td>
                    <td className="px-3 py-3 font-semibold text-slate-800">
                      {pack.priceLabel || `$${pack.priceUsd}`}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(index)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          pack.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
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
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEdit(index)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removePack(index)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
      </HqPanel>

      {modalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <h4 className="text-lg font-bold text-slate-900">
              {editingIndex != null ? 'Edit pack' : 'Create Free Jobs pack'}
            </h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs font-semibold text-slate-600">
                Name
                <input
                  className={`${inputClass} mt-1`}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Growth"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Jobs / month
                <input
                  type="number"
                  min={1}
                  className={`${inputClass} mt-1`}
                  value={form.monthlyLimit}
                  onChange={(e) => setForm((p) => ({ ...p, monthlyLimit: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Duration (days)
                <input
                  type="number"
                  min={1}
                  className={`${inputClass} mt-1`}
                  value={form.durationDays}
                  onChange={(e) => setForm((p) => ({ ...p, durationDays: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Price (USD)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`${inputClass} mt-1`}
                  value={form.priceUsd}
                  onChange={(e) => setForm((p) => ({ ...p, priceUsd: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Price label
                <input
                  className={`${inputClass} mt-1`}
                  value={form.priceLabel}
                  onChange={(e) => setForm((p) => ({ ...p, priceLabel: e.target.value }))}
                  placeholder="$19"
                />
              </label>
              <label className="sm:col-span-2 text-xs font-semibold text-slate-600">
                Description
                <textarea
                  rows={2}
                  className={`${inputClass} mt-1`}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.popular}
                  onChange={(e) => setForm((p) => ({ ...p, popular: e.target.checked }))}
                />
                Mark as popular
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                />
                Active (visible to tenants)
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <HqSecondaryButton type="button" onClick={closeModal}>
                Cancel
              </HqSecondaryButton>
              <HqPrimaryButton type="button" onClick={upsertFromModal}>
                {editingIndex != null ? 'Update' : 'Add pack'}
              </HqPrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
