'use client';

import React from 'react';
import {
  SUPPORTED_CURRENCIES,
  convertAmount,
  formatCurrencyAmount,
} from '../../utils/currency';

type Props = {
  amount: number;
  /** Currency amounts on the invoice are stored in (invoice currency). */
  baseCurrency: string;
  displayCurrency: string;
  onDisplayCurrencyChange?: (next: string) => void;
  showSelector?: boolean;
  className?: string;
};

/** Same display pattern as the Billing table monetary cells. */
export function BillingCurrencyAmount({
  amount,
  baseCurrency,
  displayCurrency,
  onDisplayCurrencyChange,
  showSelector = true,
  className = '',
}: Props) {
  const safeBase = (baseCurrency || 'USD').toUpperCase();
  const safeDisplay = (displayCurrency || safeBase).toUpperCase();
  const converted = convertAmount(amount, safeBase, safeDisplay);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="font-semibold text-slate-900 tabular-nums">
        {formatCurrencyAmount(converted, safeDisplay)}
      </span>
      {showSelector && onDisplayCurrencyChange ? (
        <select
          value={safeDisplay}
          onChange={(event) => onDisplayCurrencyChange(event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-blue-500"
          title="Preview amounts in another currency (does not change saved values)"
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      ) : null}
      {safeDisplay !== safeBase ? (
        <span className="text-[10px] text-slate-400">
          Invoice: {formatCurrencyAmount(amount, safeBase)}
        </span>
      ) : null}
    </div>
  );
}
