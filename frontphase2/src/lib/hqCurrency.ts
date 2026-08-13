import {
  SUPPORTED_CURRENCIES,
  formatCurrencyAmount,
  type SupportedCurrency,
} from '@/utils/currency';
import { HQ_FALLBACK_RATES, getHqFxRate } from '@/lib/hqFxRates';

export const HQ_DISPLAY_CURRENCY_KEY = 'hrayntra:hq-display-currency';

export const HQ_BASE_CURRENCY: SupportedCurrency = 'USD';

export { SUPPORTED_CURRENCIES, type SupportedCurrency };

export function readHqDisplayCurrency(): string {
  if (typeof window === 'undefined') return HQ_BASE_CURRENCY;
  try {
    const raw = localStorage.getItem(HQ_DISPLAY_CURRENCY_KEY);
    const code = String(raw || HQ_BASE_CURRENCY).toUpperCase().trim();
    return code.length === 3 ? code : HQ_BASE_CURRENCY;
  } catch {
    return HQ_BASE_CURRENCY;
  }
}

export function writeHqDisplayCurrency(currency: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HQ_DISPLAY_CURRENCY_KEY, currency.toUpperCase());
}

/** Convert a USD-denominated HQ amount into the selected display currency. */
export function convertHqUsdAmount(
  amountUsd: number,
  currency: string,
  rates: Record<string, number> = HQ_FALLBACK_RATES,
): number {
  const safeAmount = Number(amountUsd || 0);
  if (!safeAmount) return 0;
  const fromRate = getHqFxRate(HQ_BASE_CURRENCY, rates);
  const toRate = getHqFxRate(currency, rates);
  if (!fromRate) return safeAmount;
  const usd = safeAmount / fromRate;
  return usd * toRate;
}

function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Compact KPI-style money label (matches legacy HQ `$` formatting). */
export function formatHqMoneyCompact(
  amountUsd: number,
  currency: string = HQ_BASE_CURRENCY,
  rates: Record<string, number> = HQ_FALLBACK_RATES,
): string {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return '—';
  const converted = convertHqUsdAmount(amountUsd, currency, rates);
  const abs = Math.abs(converted);
  const sign = converted < 0 ? '-' : '';
  const symbol = currencySymbol(currency);

  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${Math.round(abs).toLocaleString('en-US')}`;
  return `${sign}${symbol}${Math.round(abs)}`;
}

/** Full currency label for tables and detail views. */
export function formatHqMoneyFull(
  amountUsd: number,
  currency: string = HQ_BASE_CURRENCY,
  rates: Record<string, number> = HQ_FALLBACK_RATES,
  options: { maximumFractionDigits?: number } = {},
): string {
  if (!Number.isFinite(amountUsd)) return '—';
  const converted = convertHqUsdAmount(amountUsd, currency, rates);
  return formatCurrencyAmount(converted, currency, {
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  });
}

export const HQ_CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  USD: 'US Dollar',
  INR: 'Indian Rupee',
  EUR: 'Euro',
  GBP: 'British Pound',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
  SGD: 'Singapore Dollar',
  AED: 'UAE Dirham',
  JPY: 'Japanese Yen',
};

export const HQ_CURRENCY_FLAGS: Record<SupportedCurrency, string> = {
  USD: '🇺🇸',
  INR: '🇮🇳',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  AUD: '🇦🇺',
  CAD: '🇨🇦',
  SGD: '🇸🇬',
  AED: '🇦🇪',
  JPY: '🇯🇵',
};

export function formatHqFxRate(
  currency: string,
  rates: Record<string, number> = HQ_FALLBACK_RATES,
): string {
  const rate = getHqFxRate(currency, rates);
  if (currency === HQ_BASE_CURRENCY) return '1.00';
  if (rate >= 100) return rate.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (rate >= 1) return rate.toFixed(4).replace(/\.?0+$/, '');
  return rate.toFixed(6).replace(/\.?0+$/, '');
}
