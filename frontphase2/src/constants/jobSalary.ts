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

export type CustomJobSalaryCurrency = {
  code: string;
  symbol: string;
};

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

function normalizeCustomCurrencyEntry(raw: unknown): CustomJobSalaryCurrency | null {
  if (typeof raw === 'string') {
    const code = raw.trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(code)) return null;
    return { code, symbol: '' };
  }
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { code?: unknown; symbol?: unknown };
  const code = String(row.code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 5);
  if (!/^[A-Z]{2,5}$/.test(code)) return null;
  const symbol = String(row.symbol || '')
    .trim()
    .slice(0, 8);
  return { code, symbol };
}

export function listCustomJobSalaryCurrencyEntries(): CustomJobSalaryCurrency[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(customCurrencyStorageKey()) || '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const entries: CustomJobSalaryCurrency[] = [];
    for (const item of parsed) {
      const entry = normalizeCustomCurrencyEntry(item);
      if (!entry || seen.has(entry.code)) continue;
      seen.add(entry.code);
      entries.push(entry);
    }
    return entries;
  } catch {
    return [];
  }
}

/** @deprecated Prefer listCustomJobSalaryCurrencyEntries — returns codes only. */
export function listCustomJobSalaryCurrencies(): string[] {
  return listCustomJobSalaryCurrencyEntries().map((entry) => entry.code);
}

function persistCustomCurrencies(
  entries: CustomJobSalaryCurrency[],
): { ok: true } | { ok: false; message: string } {
  try {
    localStorage.setItem(customCurrencyStorageKey(), JSON.stringify(entries));
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not save this currency' };
  }
}

export function getCustomJobSalaryCurrencySymbol(code?: string | null): string {
  const key = String(code || '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return listCustomJobSalaryCurrencyEntries().find((entry) => entry.code === key)?.symbol || '';
}

const ISO_CURRENCY_SYMBOL_CACHE = new Map<string, string>();

/** Resolve display symbol: custom saved symbol first, then ISO narrow symbol. */
export function getJobSalaryCurrencySymbol(code?: string | null): string {
  const key = String(code || '')
    .trim()
    .toUpperCase();
  if (!key) return '';

  const custom = getCustomJobSalaryCurrencySymbol(key);
  if (custom) return custom;

  if (ISO_CURRENCY_SYMBOL_CACHE.has(key)) {
    return ISO_CURRENCY_SYMBOL_CACHE.get(key) || '';
  }

  let symbol = '';
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: key,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    symbol = parts.find((part) => part.type === 'currency')?.value?.trim() || '';
    // Avoid useless labels like "USD" when Intl falls back to the code itself.
    if (symbol.toUpperCase() === key) {
      const nameParts = new Intl.NumberFormat('en', {
        style: 'currency',
        currency: key,
        currencyDisplay: 'symbol',
      }).formatToParts(0);
      const alt = nameParts.find((part) => part.type === 'currency')?.value?.trim() || '';
      symbol = alt.toUpperCase() === key ? '' : alt;
    }
  } catch {
    symbol = '';
  }

  ISO_CURRENCY_SYMBOL_CACHE.set(key, symbol);
  return symbol;
}

export function formatJobSalaryCurrencyLabel(code: string, symbol?: string | null): string {
  const cleanCode = String(code || '')
    .trim()
    .toUpperCase();
  if (!cleanCode) return '';
  const cleanSymbol = String(
    symbol != null && String(symbol).trim()
      ? symbol
      : getJobSalaryCurrencySymbol(cleanCode),
  ).trim();
  if (cleanSymbol && cleanSymbol.toUpperCase() !== cleanCode) {
    return `${cleanSymbol} ${cleanCode}`;
  }
  return cleanCode;
}

/** Prefix for salary amounts in LinkedIn / job lists (Fr / ₹ / USD). */
export function formatJobSalaryAmountPrefix(
  code?: string | null,
  storedSymbol?: string | null,
): string {
  const cleanCode = String(code || '')
    .trim()
    .toUpperCase();
  const cleanSymbol = String(
    storedSymbol != null && String(storedSymbol).trim()
      ? storedSymbol
      : getJobSalaryCurrencySymbol(cleanCode),
  ).trim();
  if (cleanSymbol && cleanSymbol.toUpperCase() !== cleanCode) {
    return cleanSymbol.length > 1 ? `${cleanSymbol} ` : cleanSymbol;
  }
  return cleanCode ? `${cleanCode} ` : '';
}

/** Persistable symbol for the selected currency (custom or ISO). */
export function resolveJobSalaryCurrencySymbolForSave(code?: string | null): string | undefined {
  const symbol = getJobSalaryCurrencySymbol(code);
  const cleanCode = String(code || '')
    .trim()
    .toUpperCase();
  if (!symbol || symbol.toUpperCase() === cleanCode) return undefined;
  return symbol;
}

export function saveCustomJobSalaryCurrency(
  rawCode: string,
  rawSymbol = '',
): { ok: true; code: string; symbol: string } | { ok: false; message: string } {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 5);
  if (!/^[A-Z]{2,5}$/.test(code)) {
    return { ok: false, message: 'Enter a currency code (e.g. CFA or UGX)' };
  }
  const symbol = String(rawSymbol || '').trim().slice(0, 8);
  if (!symbol) {
    return { ok: false, message: 'Enter a currency symbol (e.g. Fr or ₣)' };
  }

  const next = [
    { code, symbol },
    ...listCustomJobSalaryCurrencyEntries().filter((entry) => entry.code !== code),
  ];
  const saved = persistCustomCurrencies(next);
  if (!saved.ok) return saved;
  return { ok: true, code, symbol };
}

export function updateCustomJobSalaryCurrency(
  previousCode: string,
  rawCode: string,
  rawSymbol = '',
): { ok: true; code: string; symbol: string } | { ok: false; message: string } {
  const prev = String(previousCode || '')
    .trim()
    .toUpperCase();
  const code = String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 5);
  if (!/^[A-Z]{2,5}$/.test(code)) {
    return { ok: false, message: 'Enter a currency code (e.g. CFA or UGX)' };
  }
  const symbol = String(rawSymbol || '').trim().slice(0, 8);
  if (!symbol) {
    return { ok: false, message: 'Enter a currency symbol (e.g. Fr or ₣)' };
  }

  const existing = listCustomJobSalaryCurrencyEntries();
  if (!existing.some((entry) => entry.code === prev)) {
    return { ok: false, message: 'Currency not found' };
  }
  if (code !== prev && existing.some((entry) => entry.code === code)) {
    return { ok: false, message: `${code} is already saved` };
  }

  const next = existing.map((entry) =>
    entry.code === prev ? { code, symbol } : entry,
  );
  const saved = persistCustomCurrencies(next);
  if (!saved.ok) return saved;
  return { ok: true, code, symbol };
}

export function mergeJobSalaryCurrencyOptions(
  customCodes: string[] = listCustomJobSalaryCurrencies(),
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  const push = (value: string) => {
    const code = String(value || '').trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(code) || seen.has(code)) return;
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
  'cfa franc': 'XAF',
  'franc cfa': 'XAF',
};

/**
 * Parse salary range inputs for job create/edit.
 * Handles `100,000`, `100000`, `100k`, `1.5L`, `18 LPA` (→ lakhs for INR-style).
 */
export function parseJobSalaryMoneyNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const text = String(value || '').trim();
  if (!text) return NaN;

  const normalized = text.replace(/\s+/g, ' ').replace(/,/g, '');
  const lpa = normalized.match(/^([\d.]+)\s*(?:lpa|lakh|lakhs|lacs|lac)\b/i);
  if (lpa) {
    const n = Number(lpa[1]);
    return Number.isFinite(n) ? Math.round(n * 100_000) : NaN;
  }
  const lakhSuffix = normalized.match(/^([\d.]+)\s*l\b/i);
  if (lakhSuffix) {
    const n = Number(lakhSuffix[1]);
    return Number.isFinite(n) ? Math.round(n * 100_000) : NaN;
  }
  const thousand = normalized.match(/^([\d.]+)\s*k\b/i);
  if (thousand) {
    const n = Number(thousand[1]);
    return Number.isFinite(n) ? Math.round(n * 1000) : NaN;
  }
  const million = normalized.match(/^([\d.]+)\s*m\b/i);
  if (million) {
    const n = Number(million[1]);
    return Number.isFinite(n) ? Math.round(n * 1_000_000) : NaN;
  }

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

/** Normalize stored salary currency labels to a short currency code. */
export function normalizeJobSalaryCurrency(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return 'INR';
  const upper = trimmed.toUpperCase();
  // Allow informal custom codes such as CFA (2–5 letters).
  if (/^[A-Z]{2,5}$/.test(upper)) {
    return upper;
  }
  const legacy = LEGACY_CURRENCY_MAP[trimmed.toLowerCase()];
  if (legacy) return legacy;
  for (const [key, code] of Object.entries(LEGACY_CURRENCY_MAP)) {
    if (trimmed.toLowerCase().includes(key)) return code;
  }
  return 'INR';
}
