import type { HqSubscriptionPackage } from '@/lib/api';

export const HQ_PLANS_SECTION = {
  title: 'Subscription plans',
  description: 'Create plans with names, pricing, and limits — then assign them to tenants.',
};

export type BillingCycle = 'monthly' | 'annual';

/** Used when the API returns legacy plan options without pricing fields. */
export const DEFAULT_SUBSCRIPTION_PACKAGES: HqSubscriptionPackage[] = [
  {
    id: 'starter',
    slug: 'starter',
    name: 'Starter',
    displayName: 'STARTER',
    description: '',
    price: '149',
    yearlyPrice: '119',
    pricePeriod: 'per month',
    maxUsers: 5,
    maxJobs: 25,
    isSystem: true,
  },
  {
    id: 'professional',
    slug: 'professional',
    name: 'Professional',
    displayName: 'PROFESSIONAL',
    description: '',
    price: '399',
    yearlyPrice: '319',
    pricePeriod: 'per month',
    maxUsers: 25,
    maxJobs: null,
    isSystem: true,
  },
  {
    id: 'enterprise',
    slug: 'enterprise',
    name: 'Enterprise',
    displayName: 'ENTERPRISE',
    description: '',
    price: '999',
    yearlyPrice: '799',
    pricePeriod: 'per month',
    maxUsers: null,
    maxJobs: null,
    isSystem: true,
  },
];

export function subscriptionPackagesWithPricing(
  options: HqSubscriptionPackage[]
): HqSubscriptionPackage[] {
  if (options.some((item) => item.price || item.yearlyPrice)) return options;
  return DEFAULT_SUBSCRIPTION_PACKAGES;
}

export type PackagePresentation = {
  displayName: string;
  monthlyPrice: string;
  yearlyPrice: string;
  period: string;
  features: string[];
  footnote: string;
  isPopular?: boolean;
};

export function formatBillingCycleLabel(cycle?: string | null) {
  return cycle === 'annual' ? 'Annual' : 'Monthly';
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computePlanEndDate(startDate: string, billingCycle: BillingCycle): string {
  const start = String(startDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return '';
  const d = new Date(`${start}T12:00:00.000Z`);
  const days = billingCycle === 'annual' ? 365 : 30;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getPackageLimitsForCycle(
  pkg: Pick<HqSubscriptionPackage, 'maxUsers' | 'maxJobs' | 'annualMaxUsers' | 'annualMaxJobs'>,
  billingCycle: BillingCycle
): { maxUsers: number | null; maxJobs: number | null } {
  if (billingCycle === 'annual') {
    return {
      maxUsers: pkg.annualMaxUsers ?? pkg.maxUsers ?? null,
      maxJobs: pkg.annualMaxJobs ?? pkg.maxJobs ?? null,
    };
  }
  return {
    maxUsers: pkg.maxUsers ?? null,
    maxJobs: pkg.maxJobs ?? null,
  };
}

export function getPackageOptionLabel(
  pkg: Pick<HqSubscriptionPackage, 'name' | 'displayName'>
): string {
  const display = String(pkg.displayName || '').trim();
  if (display) return display;
  return String(pkg.name || '').trim();
}

export function getPlanLabel(
  plan: { name?: string; id?: string } | null | undefined,
  packages: HqSubscriptionPackage[]
): string {
  const match = findPackageForPlan(plan, packages);
  if (match) return getPackageOptionLabel(match);
  if (!plan?.name && !plan?.id) return '—';
  return String(plan.name || '—');
}

const PLAN_PACKAGE_ALIASES: Record<string, string> = {
  basic: 'starter',
  pro: 'professional',
};

export function findPackageForPlan(
  plan: { name?: string; id?: string } | null | undefined,
  packages: HqSubscriptionPackage[]
): HqSubscriptionPackage | null {
  if (!plan || !packages.length) return null;
  const id = String(plan.id || '').trim().toLowerCase();
  const name = String(plan.name || '').trim().toLowerCase();
  const alias = PLAN_PACKAGE_ALIASES[id] || PLAN_PACKAGE_ALIASES[name] || '';

  return (
    packages.find((pkg) => {
      const pkgName = String(pkg.name || '').toLowerCase();
      const pkgSlug = String(pkg.slug || '').toLowerCase();
      if (plan.id && pkg.id === plan.id) return true;
      if (name && pkgName === name) return true;
      if (name && pkgSlug === name) return true;
      if (id && pkgSlug === id) return true;
      if (alias && (pkgSlug === alias || pkgName === alias)) return true;
      return false;
    }) ?? null
  );
}

export function getPackagePresentation(pkg: HqSubscriptionPackage): PackagePresentation {
  return {
    displayName: pkg.displayName || pkg.name,
    monthlyPrice: pkg.price || '—',
    yearlyPrice: pkg.yearlyPrice || pkg.price || '—',
    period: pkg.pricePeriod || 'per month',
    features: [],
    footnote: pkg.description || '',
    isPopular: Boolean(pkg.isPopular),
  };
}

export function getDisplayedPrice(
  presentation: PackagePresentation,
  billingCycle: BillingCycle
): { amount: string; periodLabel: string } {
  if (billingCycle === 'annual') {
    return {
      amount: presentation.yearlyPrice,
      periodLabel: 'per month (billed annually)',
    };
  }
  return {
    amount: presentation.monthlyPrice,
    periodLabel: presentation.period || 'per month',
  };
}
