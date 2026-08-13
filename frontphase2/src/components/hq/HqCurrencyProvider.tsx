'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  HQ_DISPLAY_CURRENCY_KEY,
  HQ_BASE_CURRENCY,
  formatHqMoneyCompact,
  formatHqMoneyFull,
  readHqDisplayCurrency,
  writeHqDisplayCurrency,
} from '@/lib/hqCurrency';
import {
  HQ_FX_CACHE_KEY,
  HQ_FALLBACK_RATES,
  fallbackHqFxSnapshot,
  getHqFxRate,
  getHqFxRates,
  readCachedHqFxRates,
  type HqFxSnapshot,
  type HqFxSource,
} from '@/lib/hqFxRates';

type HqCurrencyContextValue = {
  currency: string;
  baseCurrency: string;
  rates: Record<string, number>;
  fxDate: string | null;
  fxFetchedAt: string | null;
  fxSource: HqFxSource;
  fxLoading: boolean;
  refreshRates: () => Promise<void>;
  getRate: (code: string) => number;
  setCurrency: (currency: string) => void;
  formatMoney: (amountUsd: number) => string;
  formatMoneyFull: (amountUsd: number) => string;
};

const HqCurrencyContext = createContext<HqCurrencyContextValue | null>(null);

function initialFxSnapshot(): HqFxSnapshot {
  return readCachedHqFxRates() ?? fallbackHqFxSnapshot();
}

export function HqCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(HQ_BASE_CURRENCY);
  const [fx, setFx] = useState<HqFxSnapshot>(initialFxSnapshot);
  const [fxLoading, setFxLoading] = useState(false);

  useEffect(() => {
    setCurrencyState(readHqDisplayCurrency());
    const cached = readCachedHqFxRates();
    if (cached) setFx(cached);

    const onStorage = (event: StorageEvent) => {
      if (event.key === HQ_DISPLAY_CURRENCY_KEY) {
        setCurrencyState(readHqDisplayCurrency());
      }
      if (event.key === HQ_FX_CACHE_KEY) {
        setFx(readCachedHqFxRates() ?? fallbackHqFxSnapshot());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const refreshRates = useCallback(async (force = true) => {
    // Only show spinner on manual refresh — silent background loads stay snappy.
    if (force) setFxLoading(true);
    try {
      const snapshot = await getHqFxRates(force);
      setFx(snapshot);
    } finally {
      if (force) setFxLoading(false);
    }
  }, []);

  useEffect(() => {
    // Warm rates ASAP in background (uses localStorage cache first).
    void refreshRates(false);
    const timer = window.setInterval(() => {
      void refreshRates(false);
    }, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refreshRates]);

  const setCurrency = useCallback((next: string) => {
    writeHqDisplayCurrency(next);
    setCurrencyState(next.toUpperCase());
  }, []);

  const rates = fx.rates;

  const formatMoney = useCallback(
    (amountUsd: number) => formatHqMoneyCompact(amountUsd, currency, rates),
    [currency, rates],
  );

  const formatMoneyFull = useCallback(
    (amountUsd: number) => formatHqMoneyFull(amountUsd, currency, rates),
    [currency, rates],
  );

  const getRate = useCallback((code: string) => getHqFxRate(code, rates), [rates]);

  const value = useMemo(
    () => ({
      currency,
      baseCurrency: HQ_BASE_CURRENCY,
      rates,
      fxDate: fx.date,
      fxFetchedAt: fx.fetchedAt,
      fxSource: fx.source,
      fxLoading,
      refreshRates: () => refreshRates(true),
      getRate,
      setCurrency,
      formatMoney,
      formatMoneyFull,
    }),
    [
      currency,
      rates,
      fx.date,
      fx.fetchedAt,
      fx.source,
      fxLoading,
      refreshRates,
      getRate,
      setCurrency,
      formatMoney,
      formatMoneyFull,
    ],
  );

  return <HqCurrencyContext.Provider value={value}>{children}</HqCurrencyContext.Provider>;
}

export function useHqMoney() {
  const ctx = useContext(HqCurrencyContext);
  if (!ctx) {
    return {
      currency: HQ_BASE_CURRENCY as string,
      baseCurrency: HQ_BASE_CURRENCY,
      rates: HQ_FALLBACK_RATES,
      fxDate: null as string | null,
      fxFetchedAt: null as string | null,
      fxSource: 'fallback' as HqFxSource,
      fxLoading: false,
      refreshRates: async () => {},
      getRate: (code: string) => getHqFxRate(code, HQ_FALLBACK_RATES),
      setCurrency: (_currency: string) => {},
      formatMoney: (amountUsd: number) => formatHqMoneyCompact(amountUsd, HQ_BASE_CURRENCY, HQ_FALLBACK_RATES),
      formatMoneyFull: (amountUsd: number) => formatHqMoneyFull(amountUsd, HQ_BASE_CURRENCY, HQ_FALLBACK_RATES),
    };
  }
  return ctx;
}
