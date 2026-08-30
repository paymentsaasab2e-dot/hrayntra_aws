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

const CUSTOM_CURRENCY_STORAGE_KEY = 'jobSalaryCustomCurrencies';

function customCurrencyStorageKey(): string {
  if (typeof window === 'undefined') return CUSTOM_CURRENCY_STORAGE_KEY;
  try {
    const tenant = String(localStorage.getItem('tenantDbName') || '').trim();
    return tenant ? `${CUSTOM_CURRENCY_STORAGE_KEY}:${tenant}` : CUSTOM_CURRENCY_STORAGE_KEY;
  } catch {
    return CUSTOM_CURRENCY_STORAGE_KEY;
  }
}

export function listCustomJobSalaryCurrencies(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(customCurrencyStorageKey()) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((code) => String(code || '').trim().toUpperCase())
      .filter((code) => /^[A-Z]{3}$/.test(code));
  } catch {
    return [];
  }
}

export function saveCustomJobSalaryCurrency(
  raw: string,
): { ok: true; code: string } | { ok: false; message: string } {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return { ok: false, message: 'Enter a 3-letter currency code (e.g. UGX)' };
  }
  const next = [code, ...listCustomJobSalaryCurrencies().filter((item) => item !== code)];
  try {
    localStorage.setItem(customCurrencyStorageKey(), JSON.stringify(next));
  } catch {
    return { ok: false, message: 'Could not save this currency' };
  }
  return { ok: true, code };
}

export function mergeJobSalaryCurrencyOptions(
  customCodes: string[] = listCustomJobSalaryCurrencies(),
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  const push = (value: string) => {
    const code = String(value || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || seen.has(code)) return;
    seen.add(code);
    merged.push(code);
  };
  customCodes.forEach(push);
  JOB_SALARY_CURRENCY_OPTIONS.forEach(push);
  return merged;
}

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
  if (/^[A-Z]{3}$/.test(upper)) {
    return upper;
  }
  const legacy = LEGACY_CURRENCY_MAP[trimmed.toLowerCase()];
  if (legacy) return legacy;
  for (const [key, code] of Object.entries(LEGACY_CURRENCY_MAP)) {
    if (trimmed.toLowerCase().includes(key)) return code;
  }
  return 'INR';
}
