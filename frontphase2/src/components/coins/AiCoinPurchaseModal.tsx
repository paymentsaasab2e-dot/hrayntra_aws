'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import {
  apiGetAiCoinPacks,
  apiPurchaseAiCoinPack,
  notifyTenantCoinsChanged,
  type AiCoinPack,
} from '@/lib/api';
import { TokenCoinIcon } from './TokenCoinIcon';
import { BrandPngIcon } from './BrandPngIcon';

export const AI_COIN_PURCHASE_EVENT = 'hrayntra:ai-coin-purchase-open';

export type AiCoinPurchaseOpenDetail = {
  featureId?: string;
  required?: number;
  balance?: number;
};

export function openAiCoinPurchaseModal(detail?: AiCoinPurchaseOpenDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AI_COIN_PURCHASE_EVENT, { detail: detail || {} }));
}

const FALLBACK_PACKS: AiCoinPack[] = [
  {
    id: 'ai_pack_starter',
    name: 'Starter',
    coins: 100,
    priceUsd: 9,
    priceLabel: '$9',
    description: 'Enough for light AI job and lead assist.',
    popular: false,
  },
  {
    id: 'ai_pack_growth',
    name: 'Growth',
    coins: 500,
    priceUsd: 39,
    priceLabel: '$39',
    description: 'Best for daily AI hiring workflows.',
    popular: true,
  },
  {
    id: 'ai_pack_scale',
    name: 'Scale',
    coins: 2000,
    priceUsd: 99,
    priceLabel: '$99',
    description: 'High-volume AI usage across the team.',
    popular: false,
  },
];

export function AiCoinPurchaseModal({
  onPurchased,
}: {
  onPurchased?: (coins: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<AiCoinPurchaseOpenDetail>({});
  const [packs, setPacks] = useState<AiCoinPack[]>(FALLBACK_PACKS);
  const [selectedId, setSelectedId] = useState('ai_pack_growth');
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const close = useCallback(() => {
    if (buying) return;
    setOpen(false);
    setError(null);
    setSuccess(null);
  }, [buying]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<AiCoinPurchaseOpenDetail>).detail || {};
      setContext(detail);
      setError(null);
      setSuccess(null);
      setOpen(true);
    };
    window.addEventListener(AI_COIN_PURCHASE_EVENT, onOpen);
    return () => window.removeEventListener(AI_COIN_PURCHASE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    apiGetAiCoinPacks()
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.packs || [];
        if (list.length) {
          setPacks(list);
          const popular = list.find((p) => p.popular) || list[0];
          setSelectedId(popular.id);
        }
      })
      .catch(() => {
        /* keep fallback packs */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const handlePurchase = async () => {
    if (!selectedId || buying) return;
    setBuying(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiPurchaseAiCoinPack(selectedId);
      const coins = Number(res.data?.coins ?? 0);
      const added = Number(res.data?.added ?? 0);
      setSuccess(
        res.data?.message ||
          `Demo purchase complete. ${added} AI coins credited. New balance: ${coins}.`
      );
      onPurchased?.(coins);
      notifyTenantCoinsChanged({ coins });
      window.setTimeout(() => {
        setOpen(false);
        setSuccess(null);
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setBuying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close purchase modal"
        className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/25 to-slate-900/55 backdrop-blur-[3px]"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-coin-purchase-title"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-emerald-50 shadow-[0_28px_80px_rgba(15,23,42,0.35)]"
      >
        <div className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full bg-amber-300/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 rounded-full bg-emerald-300/35 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3 px-5 py-4">
          <div>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-500/30 ring-4 ring-white">
              <TokenCoinIcon className="h-7 w-7" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Buy coins</p>
            <h2 id="ai-coin-purchase-title" className="mt-1 text-xl font-bold text-slate-900">
              Top up AI coins
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {context.required != null
                ? `You need ${context.required} (balance ${context.balance ?? 0}). Pick a pack — coins credit instantly.`
                : 'Your AI coins are low. Choose a pack to top up this tenant.'}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={buying}
            className="rounded-full p-2 text-amber-800/55 hover:bg-amber-100 hover:text-amber-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading packs…
            </div>
          ) : (
            packs.map((pack) => {
              const selected = selectedId === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedId(pack.id)}
                  disabled={buying}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">{pack.name}</span>
                        {pack.popular ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            <Sparkles className="h-3 w-3" />
                            Popular
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{pack.description}</p>
                      <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-800">
                        <TokenCoinIcon className="h-4 w-4" />
                        {pack.coins.toLocaleString()} AI coins
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">{pack.priceLabel}</p>
                      {selected ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <BrandPngIcon name="correct" className="h-3.5 w-3.5" />
                          Selected
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}

          <p className="text-[11px] text-slate-400">
            Demo mode — no real payment is charged. Coins are credited to this tenant immediately.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={close}
            disabled={buying}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handlePurchase()}
            disabled={buying || !selectedId || Boolean(success)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-60"
          >
            {buying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Purchasing…
              </>
            ) : (
              <>
                <TokenCoinIcon className="h-4 w-4" />
                Purchase (demo)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
