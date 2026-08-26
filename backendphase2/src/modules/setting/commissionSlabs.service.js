import { prisma } from '../../config/prisma.js';
import { DEFAULT_ORG_CURRENCY, SUPPORTED_CURRENCIES, getDefaultCurrency } from './recruitmentMode.service.js';

const ORG_SCOPE = 'ORG';
const KEY_COMMISSION_SLABS = 'commissionSlabs';

/** Units of each currency per 1 USD — same approach as the employer UI preview table. */
const USD_RATES = {
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

export const DEFAULT_COMMISSION_SLABS = {
  enabled: false,
  basis: 'offer_salary',
  salaryCurrency: DEFAULT_ORG_CURRENCY,
  commissionCurrency: DEFAULT_ORG_CURRENCY,
  fxRate: null,
  fallbackPercent: 20,
  slabs: [],
};

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeCurrencyCode(raw, fallback = DEFAULT_ORG_CURRENCY) {
  const s = String(raw || '').trim().toUpperCase();
  if (s.length === 3) return s;
  return fallback;
}

export function convertViaUsd(amount, from, to) {
  const safe = Number(amount || 0);
  if (!safe) return 0;
  const fromC = normalizeCurrencyCode(from);
  const toC = normalizeCurrencyCode(to);
  if (fromC === toC) return safe;
  const fromRate = USD_RATES[fromC] ?? 1;
  const toRate = USD_RATES[toC] ?? 1;
  if (!fromRate) return safe;
  return (safe / fromRate) * toRate;
}

export function convertCommissionAmount(amount, from, to, settings) {
  const safe = Number(amount || 0);
  if (!safe) return 0;
  const fromC = normalizeCurrencyCode(from, settings?.salaryCurrency);
  const toC = normalizeCurrencyCode(to, settings?.commissionCurrency);
  if (fromC === toC) return safe;
  const fx = Number(settings?.fxRate);
  const salaryC = settings?.salaryCurrency;
  const commissionC = settings?.commissionCurrency;
  if (Number.isFinite(fx) && fx > 0 && salaryC && commissionC) {
    if (fromC === salaryC && toC === commissionC) return safe * fx;
    if (fromC === commissionC && toC === salaryC) return safe / fx;
  }
  return convertViaUsd(safe, fromC, toC);
}

export function jobSalaryAnchor(salary) {
  if (salary == null) return null;
  if (typeof salary === 'number' && Number.isFinite(salary) && salary > 0) return salary;
  if (typeof salary !== 'object') return null;
  const min = Number(salary.min ?? salary.minSalary);
  const max = Number(salary.max ?? salary.maxSalary);
  const amount = Number(salary.amount ?? salary.value ?? salary.ctc);
  const finiteMin = Number.isFinite(min) && min > 0;
  const finiteMax = Number.isFinite(max) && max > 0;
  if (finiteMin && finiteMax) return (min + max) / 2;
  if (finiteMin) return min;
  if (finiteMax) return max;
  if (Number.isFinite(amount) && amount > 0) return amount;
  return null;
}

export function jobSalaryCurrency(salary) {
  if (!salary || typeof salary !== 'object') return null;
  const c = String(salary.currency || salary.code || '').trim().toUpperCase();
  return c.length === 3 ? c : null;
}

export function normalizeCommissionSlabs(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const basis = String(input.basis || '').trim() === 'job_salary' ? 'job_salary' : 'offer_salary';
  const salaryCurrency = normalizeCurrencyCode(input.salaryCurrency, DEFAULT_ORG_CURRENCY);
  const commissionCurrency = normalizeCurrencyCode(input.commissionCurrency, salaryCurrency);
  const fxRaw = input.fxRate;
  const fxRate =
    fxRaw === '' || fxRaw == null
      ? null
      : clampNum(fxRaw, 0.000001, 1e12, null);
  const list = Array.isArray(input.slabs) ? input.slabs : [];
  const slabs = list
    .map((row, index) => {
      const minSalary = clampNum(row?.minSalary ?? row?.min, 0, Number.MAX_SAFE_INTEGER, 0);
      const maxRaw = row?.maxSalary ?? row?.max;
      const maxSalary =
        maxRaw === '' || maxRaw == null || maxRaw === undefined
          ? null
          : clampNum(maxRaw, 0, Number.MAX_SAFE_INTEGER, null);
      if (maxSalary != null && maxSalary < minSalary) return null;
      return {
        id: String(row?.id || '').trim() || `slab-${index + 1}`,
        minSalary,
        maxSalary,
        percent: clampNum(row?.percent ?? row?.commissionPercent, 0, 100, 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.minSalary - b.minSalary);
  return {
    enabled: input.enabled === true,
    basis,
    salaryCurrency,
    commissionCurrency,
    fxRate,
    fallbackPercent: clampNum(input.fallbackPercent, 0, 100, 20),
    slabs,
  };
}

export function matchCommissionSlab(config, salary) {
  const settings = normalizeCommissionSlabs(config);
  const amount = Number(salary);
  if (!Number.isFinite(amount) || amount < 0) {
    return { percent: settings.fallbackPercent, slab: null, salary: null };
  }
  const matches = settings.slabs.filter((slab) => {
    if (amount < slab.minSalary) return false;
    if (slab.maxSalary == null) return true;
    return amount <= slab.maxSalary;
  });
  const slab = matches.sort((a, b) => b.minSalary - a.minSalary)[0] || null;
  return {
    percent: slab ? slab.percent : settings.fallbackPercent,
    slab,
    salary: amount,
  };
}

function moneyRound(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Pick the slab in salaryCurrency, then charge percent of the candidate/job
 * salary converted into commissionCurrency.
 */
export function resolveCommissionPercent(config, { offerSalary, offerCurrency, jobSalary } = {}) {
  const settings = normalizeCommissionSlabs(config);
  const offer = Number(offerSalary);
  const hasOffer = Number.isFinite(offer) && offer > 0;
  const jobAnchor = jobSalaryAnchor(jobSalary);
  const jobCurrency = jobSalaryCurrency(jobSalary) || settings.salaryCurrency;
  const offerCcy = normalizeCurrencyCode(offerCurrency, settings.salaryCurrency);

  const matchNative =
    settings.basis === 'job_salary'
      ? jobAnchor ?? (hasOffer ? offer : null)
      : hasOffer
        ? offer
        : jobAnchor;
  const matchCurrency =
    settings.basis === 'job_salary'
      ? jobAnchor
        ? jobCurrency
        : offerCcy
      : hasOffer
        ? offerCcy
        : jobCurrency;

  const chargeNative = hasOffer ? offer : jobAnchor;
  const chargeCurrency = hasOffer ? offerCcy : jobCurrency;

  const salaryForMatch =
    matchNative == null
      ? null
      : convertCommissionAmount(matchNative, matchCurrency, settings.salaryCurrency, settings);

  const matched = matchCommissionSlab(settings, salaryForMatch);
  const feeNative =
    chargeNative != null && matched.percent > 0 ? (Number(chargeNative) * matched.percent) / 100 : 0;
  const fee = convertCommissionAmount(
    feeNative,
    chargeCurrency || settings.salaryCurrency,
    settings.commissionCurrency,
    settings,
  );

  if (!settings.enabled) {
    return {
      enabled: false,
      basis: settings.basis,
      salary: salaryForMatch,
      percent: settings.fallbackPercent,
      fee: moneyRound(fee),
      slab: null,
      salaryCurrency: settings.salaryCurrency,
      commissionCurrency: settings.commissionCurrency,
      fxRate: settings.fxRate,
    };
  }

  return {
    enabled: true,
    basis: settings.basis,
    salary: matched.salary,
    percent: matched.percent,
    fee: moneyRound(fee),
    slab: matched.slab,
    salaryCurrency: settings.salaryCurrency,
    commissionCurrency: settings.commissionCurrency,
    fxRate: settings.fxRate,
  };
}

async function findOrgSettingRow(key) {
  return prisma.setting.findFirst({
    where: { key, scope: ORG_SCOPE },
    orderBy: { updatedAt: 'desc' },
  });
}

async function upsertOrgSettingJson(key, value) {
  const existing = await findOrgSettingRow(key);
  if (existing) {
    await prisma.setting.update({
      where: { id: existing.id },
      data: { value },
    });
    return;
  }
  await prisma.setting.create({
    data: { key, scope: ORG_SCOPE, value },
  });
}

export async function getCommissionSlabs() {
  const row = await findOrgSettingRow(KEY_COMMISSION_SLABS);
  const normalized = normalizeCommissionSlabs(row?.value);
  try {
    const org = await getDefaultCurrency();
    if (!row?.value?.salaryCurrency) normalized.salaryCurrency = org;
    if (!row?.value?.commissionCurrency) normalized.commissionCurrency = org;
  } catch {
    /* keep defaults */
  }
  if (
    normalized.fxRate == null &&
    normalized.salaryCurrency &&
    normalized.commissionCurrency &&
    normalized.salaryCurrency !== normalized.commissionCurrency
  ) {
    normalized.fxRate = moneyRound(
      convertViaUsd(1, normalized.salaryCurrency, normalized.commissionCurrency),
    );
  }
  return normalized;
}

export async function setCommissionSlabs(payload) {
  const normalized = normalizeCommissionSlabs(payload);
  await upsertOrgSettingJson(KEY_COMMISSION_SLABS, normalized);
  return getCommissionSlabs();
}

export async function resolveCommissionFromContext({
  offerSalary,
  offerCurrency,
  jobId,
  jobSalary,
} = {}) {
  const config = await getCommissionSlabs();
  let salaryJson = jobSalary;
  if (!salaryJson && jobId) {
    const job = await prisma.job.findUnique({
      where: { id: String(jobId) },
      select: { salary: true },
    });
    salaryJson = job?.salary;
  }
  return resolveCommissionPercent(config, {
    offerSalary,
    offerCurrency: offerCurrency || jobSalaryCurrency(salaryJson) || config.salaryCurrency,
    jobSalary: salaryJson,
  });
}

export { SUPPORTED_CURRENCIES };
