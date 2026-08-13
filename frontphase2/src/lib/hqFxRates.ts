export const HQ_FX_CACHE_KEY = 'hrayntra:hq-fx-rates';
export const HQ_FX_CACHE_TTL_MS = 30 * 60 * 1000;

export const HQ_FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  INR: 83.2,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.52,
  CAD: 1.37,
  SGD: 1.34,
  AED: 3.67,
  JPY: 156,
  ZAR: 18.5,
  XAF: 600,
  XOF: 600,
  CHF: 0.88,
  CNY: 7.2,
  BRL: 5.1,
  NGN: 1550,
  KES: 129,
  SAR: 3.75,
  MYR: 4.7,
  THB: 36,
  KRW: 1350,
  MXN: 17,
  TRY: 34,
  PHP: 58,
  IDR: 16000,
  PKR: 278,
  EGP: 48,
  BDT: 110,
};

export type HqFxSource = 'live' | 'cached' | 'fallback';

export type HqFxSnapshot = {
  base: 'USD';
  date: string;
  fetchedAt: string;
  source: HqFxSource;
  rates: Record<string, number>;
};

/** Keep every valid positive rate from the API (not just the 9 defaults). */
function normalizeRates(raw: Record<string, number>): Record<string, number> {
  const rates: Record<string, number> = { ...HQ_FALLBACK_RATES, USD: 1 };
  for (const [code, value] of Object.entries(raw || {})) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      rates[String(code).toUpperCase()] = n;
    }
  }
  rates.USD = 1;
  return rates;
}

export function readCachedHqFxRates(): HqFxSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(HQ_FX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HqFxSnapshot;
    if (!parsed?.rates || typeof parsed.rates !== 'object') return null;
    return {
      ...parsed,
      base: 'USD',
      rates: normalizeRates(parsed.rates),
    };
  } catch {
    return null;
  }
}

export function writeCachedHqFxRates(snapshot: HqFxSnapshot): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HQ_FX_CACHE_KEY, JSON.stringify(snapshot));
}

export async function fetchLiveHqFxRates(signal?: AbortSignal): Promise<HqFxSnapshot> {
  const res = await fetch('/api/hq/fx-rates', {
    // Browser can reuse recent responses; server also keeps a 5-min memory cache.
    cache: 'default',
    signal,
  });
  if (!res.ok) throw new Error('Unable to fetch live exchange rates');
  const data = (await res.json()) as {
    date?: string;
    fetchedAt?: string;
    rates?: Record<string, number>;
  };
  return {
    base: 'USD',
    date: String(data.date || new Date().toISOString().slice(0, 10)),
    fetchedAt: String(data.fetchedAt || new Date().toISOString()),
    source: 'live',
    rates: normalizeRates(data.rates || {}),
  };
}

export function fallbackHqFxSnapshot(): HqFxSnapshot {
  return {
    base: 'USD',
    date: new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    source: 'fallback',
    rates: normalizeRates(HQ_FALLBACK_RATES),
  };
}

export async function getHqFxRates(forceRefresh = false, signal?: AbortSignal): Promise<HqFxSnapshot> {
  if (!forceRefresh) {
    const cached = readCachedHqFxRates();
    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < HQ_FX_CACHE_TTL_MS) {
      return { ...cached, source: cached.source === 'live' ? 'cached' : cached.source };
    }
  }

  try {
    const live = await fetchLiveHqFxRates(signal);
    writeCachedHqFxRates(live);
    return live;
  } catch {
    const cached = readCachedHqFxRates();
    if (cached) return { ...cached, source: 'cached' };
    return fallbackHqFxSnapshot();
  }
}

export function getHqFxRate(
  currency: string,
  rates: Record<string, number> = HQ_FALLBACK_RATES,
): number {
  const code = String(currency || 'USD').toUpperCase();
  return rates[code] ?? HQ_FALLBACK_RATES[code] ?? 1;
}
