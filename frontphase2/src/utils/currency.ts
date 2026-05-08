// Approximate FX rates relative to USD. Used purely for UI display so a recruiter
// can preview an amount in another currency without changing what's stored in the
// database. Update these whenever you want a fresher snapshot, or wire to a live
// FX endpoint later (just swap `RATES` with a fetched table that has the same shape).
export const SUPPORTED_CURRENCIES = [
  'USD',
  'INR',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'SGD',
  'AED',
  'JPY',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const RATES: Record<string, number> = {
  USD: 1,
  INR: 83.2,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.52,
  CAD: 1.37,
  SGD: 1.34,
  AED: 3.67,
  JPY: 156,
};

export function convertAmount(amount: number, from: string, to: string): number {
  const safeAmount = Number(amount || 0);
  if (!safeAmount) return 0;
  const fromRate = RATES[from] ?? 1;
  const toRate = RATES[to] ?? 1;
  if (!fromRate) return safeAmount;
  const usd = safeAmount / fromRate;
  return usd * toRate;
}

export function formatCurrencyAmount(
  amount: number,
  currency: string,
  options: { maximumFractionDigits?: number } = {},
): string {
  const safeAmount = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: options.maximumFractionDigits ?? 0,
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toFixed(options.maximumFractionDigits ?? 0)}`;
  }
}

export function isKnownCurrency(currency?: string | null): boolean {
  if (!currency) return false;
  return Boolean(RATES[String(currency).toUpperCase()]);
}
