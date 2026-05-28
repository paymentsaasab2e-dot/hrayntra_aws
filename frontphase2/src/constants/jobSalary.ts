import { SUPPORTED_CURRENCIES } from '../utils/currency';

function buildCurrencyOptions(): string[] {
  const fallback = [...SUPPORTED_CURRENCIES];
  try {
    const intl = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (!intl) return fallback;
    const all = intl('currency')
      .map((code) => String(code || '').toUpperCase())
      .filter((code) => /^[A-Z]{3}$/.test(code));
    if (!all.length) return fallback;
    const seeded = [...fallback, ...all];
    return Array.from(new Set(seeded)).sort((a, b) => a.localeCompare(b));
  } catch {
    return fallback;
  }
}

/** ISO codes shown in create/edit job salary range. */
export const JOB_SALARY_CURRENCY_OPTIONS: string[] = buildCurrencyOptions();

const LEGACY_CURRENCY_MAP: Record<string, string> = {
  'rupees (₹ - india)': 'INR',
  rupees: 'INR',
  '₹': 'INR',
  inr: 'INR',
  'us dollars': 'USD',
  dollars: 'USD',
  usd: 'USD',
  '$': 'USD',
  eur: 'EUR',
  euro: 'EUR',
  '€': 'EUR',
  gbp: 'GBP',
  '£': 'GBP',
  aed: 'AED',
  sgd: 'SGD',
  aud: 'AUD',
  cad: 'CAD',
  jpy: 'JPY',
};

/** Normalize stored salary currency labels to a 3-letter ISO code. */
export function normalizeJobSalaryCurrency(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return 'INR';
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper) && JOB_SALARY_CURRENCY_OPTIONS.includes(upper)) {
    return upper;
  }
  const legacy = LEGACY_CURRENCY_MAP[trimmed.toLowerCase()];
  if (legacy) return legacy;
  for (const [key, code] of Object.entries(LEGACY_CURRENCY_MAP)) {
    if (trimmed.toLowerCase().includes(key)) return code;
  }
  return 'INR';
}
