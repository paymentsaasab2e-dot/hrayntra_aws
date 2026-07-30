'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Coins, Lock } from 'lucide-react';
import { apiGetTenantCoins, type AiCoinPack, type HqAiFeature, TENANT_COINS_REFRESH_EVENT } from '@/lib/api';
import { ApiRequestError } from '@/lib/apiNetworkErrors';
import {
  AiCoinPurchaseModal,
  openAiCoinPurchaseModal,
  type AiCoinPurchaseOpenDetail,
} from './AiCoinPurchaseModal';

type TenantCoinsContextValue = {
  coins: number;
  planName: string | null;
  features: HqAiFeature[];
  packs: AiCoinPack[];
  loading: boolean;
  refresh: () => Promise<void>;
  isFeatureLocked: (featureId: string) => boolean;
  getFeatureCost: (featureId: string) => number;
  formatInsufficientMessage: (error: unknown) => string | null;
  openPurchase: (detail?: AiCoinPurchaseOpenDetail) => void;
};

const TenantCoinsContext = createContext<TenantCoinsContextValue | null>(null);

export function isInsufficientCoinsError(error: unknown): boolean {
  if (error instanceof ApiRequestError && error.status === 402) return true;
  const data = (error as { data?: { code?: string } })?.data;
  if (data?.code === 'INSUFFICIENT_COINS') return true;
  const msg = String((error as Error)?.message || '').toLowerCase();
  return msg.includes('insufficient') && msg.includes('coin');
}

export function TenantCoinsProvider({ children }: { children: React.ReactNode }) {
  const [coins, setCoins] = useState(0);
  const [planName, setPlanName] = useState<string | null>(null);
  const [features, setFeatures] = useState<HqAiFeature[]>([]);
  const [packs, setPacks] = useState<AiCoinPack[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiGetTenantCoins();
      setCoins(res.coins);
      setPlanName(res.planName);
      setFeatures(res.features || []);
      setPacks(res.packs || []);
    } catch {
      /* keep last known */
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void refresh();
    }, 80);
  }, [refresh]);

  const applyCoins = useCallback((next: number) => {
    const safe = Math.max(0, next);
    setCoins(safe);
    setFeatures((prev) =>
      prev.map((f) => ({
        ...f,
        locked: safe < (Number(f.coins) || 0),
        affordable: safe >= (Number(f.coins) || 0),
      }))
    );
  }, []);

  const openPurchase = useCallback((detail?: AiCoinPurchaseOpenDetail) => {
    openAiCoinPurchaseModal({
      balance: coins,
      ...detail,
    });
  }, [coins]);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const onCoins = (event: Event) => {
      const detail = (event as CustomEvent<{ coins?: number; spent?: number }>).detail || {};
      if (detail.coins != null && Number.isFinite(Number(detail.coins))) {
        applyCoins(Number(detail.coins));
      } else if (detail.spent != null && Number.isFinite(Number(detail.spent)) && Number(detail.spent) > 0) {
        setCoins((prev) => {
          const next = Math.max(0, prev - Number(detail.spent));
          setFeatures((featuresPrev) =>
            featuresPrev.map((f) => ({
              ...f,
              locked: next < (Number(f.coins) || 0),
              affordable: next >= (Number(f.coins) || 0),
            }))
          );
          return next;
        });
      }
      scheduleRefresh();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener(TENANT_COINS_REFRESH_EVENT, onCoins);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(TENANT_COINS_REFRESH_EVENT, onCoins);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [refresh, scheduleRefresh, applyCoins]);

  const value = useMemo<TenantCoinsContextValue>(
    () => ({
      coins,
      planName,
      features,
      packs,
      loading,
      refresh,
      openPurchase,
      isFeatureLocked: (featureId: string) => {
        const feature = features.find((f) => f.id === featureId);
        if (feature) return Boolean(feature.locked);
        return coins <= 0;
      },
      getFeatureCost: (featureId: string) => {
        const feature = features.find((f) => f.id === featureId);
        return feature ? Number(feature.coins) || 0 : 0;
      },
      formatInsufficientMessage: (error: unknown) => {
        if (!isInsufficientCoinsError(error)) return null;
        const data = (error as ApiRequestError)?.data as
          | { required?: number; balance?: number; feature?: string }
          | undefined;
        if (data?.required != null) {
          return `Not enough AI coins (need ${data.required}, have ${data.balance ?? coins}). Purchase more coins to continue.`;
        }
        return String((error as Error)?.message || 'Not enough AI coins. Purchase more to continue.');
      },
    }),
    [coins, planName, features, packs, loading, refresh, openPurchase]
  );

  return (
    <TenantCoinsContext.Provider value={value}>
      {children}
      <AiCoinPurchaseModal
        onPurchased={(nextCoins) => {
          if (nextCoins != null && Number.isFinite(Number(nextCoins))) {
            applyCoins(Number(nextCoins));
          }
          void refresh();
        }}
      />
    </TenantCoinsContext.Provider>
  );
}

export function useTenantCoins() {
  const ctx = useContext(TenantCoinsContext);
  if (!ctx) {
    return {
      coins: 0,
      planName: null,
      features: [] as HqAiFeature[],
      packs: [] as AiCoinPack[],
      loading: false,
      refresh: async () => undefined,
      openPurchase: (detail?: AiCoinPurchaseOpenDetail) => openAiCoinPurchaseModal(detail),
      isFeatureLocked: () => false,
      getFeatureCost: () => 0,
      formatInsufficientMessage: () => null,
    } satisfies TenantCoinsContextValue;
  }
  return ctx;
}

/** Overlay / banner when an AI action is locked due to zero/low coins. */
export function AiCoinLockBanner({
  featureId,
  className = '',
}: {
  featureId?: string;
  className?: string;
}) {
  const { coins, isFeatureLocked, getFeatureCost, openPurchase } = useTenantCoins();
  const locked = featureId ? isFeatureLocked(featureId) : coins <= 0;
  if (!locked) return null;
  const cost = featureId ? getFeatureCost(featureId) : 0;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ${className}`}
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">AI feature locked</p>
        <p className="text-xs text-amber-800/90">
          {coins <= 0
            ? 'Your workspace has no AI coins left. Purchase a pack to continue.'
            : `This action needs ${cost} coin${cost === 1 ? '' : 's'}; you have ${coins}. Purchase more coins to unlock.`}
        </p>
        <button
          type="button"
          onClick={() =>
            openPurchase({
              featureId,
              required: cost,
              balance: coins,
            })
          }
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
        >
          <Coins className="h-3.5 w-3.5" />
          Purchase coins
        </button>
      </div>
    </div>
  );
}

export function AiCoinCostHint({ featureId }: { featureId: string }) {
  const { getFeatureCost, coins } = useTenantCoins();
  const cost = getFeatureCost(featureId);
  if (!cost) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
      <Coins className="h-3 w-3" />
      {cost} coin{cost === 1 ? '' : 's'}
      {coins < cost ? ' · locked' : ''}
    </span>
  );
}
