export type CommissionSlab = {
  id: string;
  minSalary: number;
  maxSalary: number | null;
  percent: number;
};

export type CommissionSlabSettings = {
  enabled: boolean;
  basis: 'offer_salary' | 'job_salary';
  salaryCurrency: string;
  commissionCurrency: string;
  fxRate?: number | null;
  fallbackPercent: number;
  slabs: CommissionSlab[];
};

export const DEFAULT_COMMISSION_SLAB_SETTINGS: CommissionSlabSettings = {
  enabled: false,
  basis: 'offer_salary',
  salaryCurrency: 'USD',
  commissionCurrency: 'USD',
  fxRate: null,
  fallbackPercent: 20,
  slabs: [],
};

const USD_RATES: Record<string, number> = {
  USD: 1,
  INR: 83.2,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.52,
  CAD: 1.37,
  SGD: 1.34,
  AED: 3.67,
  JPY: 156,
  CNY: 7.2,
};

export function convertViaUsd(amount: number, from: string, to: string) {
  const safe = Number(amount || 0);
  if (!safe) return 0;
  const fromC = String(from || 'USD').toUpperCase();
  const toC = String(to || 'USD').toUpperCase();
  if (fromC === toC) return safe;
  const fromRate = USD_RATES[fromC] ?? 1;
  const toRate = USD_RATES[toC] ?? 1;
  if (!fromRate) return safe;
  return (safe / fromRate) * toRate;
}

export function convertCommissionAmount(
  amount: number,
  from: string,
  to: string,
  settings?: Pick<CommissionSlabSettings, 'fxRate' | 'salaryCurrency' | 'commissionCurrency'> | null,
) {
  const safe = Number(amount || 0);
  if (!safe) return 0;
  const fromC = String(from || settings?.salaryCurrency || 'USD').toUpperCase();
  const toC = String(to || settings?.commissionCurrency || 'USD').toUpperCase();
  if (fromC === toC) return safe;
  const fx = Number(settings?.fxRate);
  const salaryC = String(settings?.salaryCurrency || '').toUpperCase();
  const commissionC = String(settings?.commissionCurrency || '').toUpperCase();
  if (Number.isFinite(fx) && fx > 0 && salaryC && commissionC) {
    if (fromC === salaryC && toC === commissionC) return safe * fx;
    if (fromC === commissionC && toC === salaryC) return safe / fx;
  }
  return convertViaUsd(safe, fromC, toC);
}

export function suggestedFxRate(salaryCurrency: string, commissionCurrency: string) {
  return Number(
    convertViaUsd(1, salaryCurrency || 'USD', commissionCurrency || 'USD').toFixed(6),
  );
}

export function jobSalaryAnchor(salary?: {
  min?: number | null;
  max?: number | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  amount?: number | null;
  currency?: string | null;
} | null) {
  if (!salary) return null;
  const min = Number(salary.min ?? salary.minSalary);
  const max = Number(salary.max ?? salary.maxSalary);
  const amount = Number(salary.amount);
  const finiteMin = Number.isFinite(min) && min > 0;
  const finiteMax = Number.isFinite(max) && max > 0;
  if (finiteMin && finiteMax) return (min + max) / 2;
  if (finiteMin) return min;
  if (finiteMax) return max;
  if (Number.isFinite(amount) && amount > 0) return amount;
  return null;
}

export function matchCommissionSlab(settings: CommissionSlabSettings, salary?: number | null) {
  const amount = Number(salary);
  if (!Number.isFinite(amount) || amount < 0) {
    return { percent: settings.fallbackPercent, slab: null as CommissionSlab | null, salary: null as number | null };
  }
  const matches = (settings.slabs || []).filter((slab) => {
    if (amount < Number(slab.minSalary || 0)) return false;
    if (slab.maxSalary == null) return true;
    return amount <= Number(slab.maxSalary);
  });
  const slab = matches.sort((a, b) => Number(b.minSalary) - Number(a.minSalary))[0] || null;
  return {
    percent: slab ? Number(slab.percent) : settings.fallbackPercent,
    slab,
    salary: amount,
  };
}

export function resolveCommissionPercent(
  settings: CommissionSlabSettings | null | undefined,
  opts: {
    offerSalary?: number | string | null;
    offerCurrency?: string | null;
    jobSalary?: Parameters<typeof jobSalaryAnchor>[0];
  } = {},
) {
  const config = {
    ...DEFAULT_COMMISSION_SLAB_SETTINGS,
    ...(settings || {}),
  };
  const offer = Number(opts.offerSalary);
  const hasOffer = Number.isFinite(offer) && offer > 0;
  const jobAnchor = jobSalaryAnchor(opts.jobSalary);
  const jobCurrency = String(opts.jobSalary?.currency || config.salaryCurrency).toUpperCase();
  const offerCcy = String(opts.offerCurrency || config.salaryCurrency).toUpperCase();

  const matchNative =
    config.basis === 'job_salary' ? jobAnchor ?? (hasOffer ? offer : null) : hasOffer ? offer : jobAnchor;
  const matchCurrency =
    config.basis === 'job_salary' ? (jobAnchor ? jobCurrency : offerCcy) : hasOffer ? offerCcy : jobCurrency;
  const chargeNative = hasOffer ? offer : jobAnchor;
  const chargeCurrency = hasOffer ? offerCcy : jobCurrency;

  const salaryForMatch =
    matchNative == null
      ? null
      : convertCommissionAmount(Number(matchNative), matchCurrency, config.salaryCurrency, config);
  const matched = matchCommissionSlab(config, salaryForMatch);
  const feeNative =
    chargeNative != null && matched.percent > 0 ? (Number(chargeNative) * matched.percent) / 100 : 0;
  const fee = convertCommissionAmount(
    feeNative,
    chargeCurrency || config.salaryCurrency,
    config.commissionCurrency,
    config,
  );

  return {
    enabled: Boolean(config.enabled),
    percent: matched.percent,
    salary: matched.salary,
    slab: matched.slab,
    fee: Math.round(fee * 100) / 100,
    salaryCurrency: config.salaryCurrency,
    commissionCurrency: config.commissionCurrency,
  };
}
