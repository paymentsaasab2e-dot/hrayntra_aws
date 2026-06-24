import type { HqSubscriptionPackage } from '@/lib/api';

export const HQ_PLANS_SECTION = {
  title: 'Plans that scale with your hiring',
  description:
    'Simple pricing for teams of every size. All plans include the SAASA B2E employer platform, AI tools, and onboarding support.',
};

export type BillingCycle = 'monthly' | 'annual';

export type PackagePresentation = {
  displayName: string;
  monthlyPrice: string;
  yearlyPrice: string;
  period: string;
  features: string[];
  footnote: string;
  isPopular?: boolean;
};

function formatLimitBullet(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined) return `Unlimited ${unit}`;
  return `Up to ${value} ${unit}`;
}

export function formatBillingCycleLabel(cycle?: string | null) {
  return cycle === 'annual' ? 'Annual' : 'Monthly';
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
  if (!plan?.name && !plan?.id) return '—';
  const match = packages.find(
    (pkg) =>
      (plan.id && pkg.id === plan.id) ||
      String(pkg.name || '').toLowerCase() === String(plan.name || '').toLowerCase() ||
      String(pkg.slug || '').toLowerCase() === String(plan.name || '').toLowerCase()
  );
  if (match) return getPackageOptionLabel(match);
  return String(plan.name || '—');
}

export function getPackagePresentation(pkg: HqSubscriptionPackage): PackagePresentation {
  const storedFeatures = Array.isArray(pkg.features)
    ? pkg.features.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (pkg.price || pkg.yearlyPrice || storedFeatures.length > 0 || pkg.displayName) {
    return {
      displayName: pkg.displayName || pkg.name.toUpperCase(),
      monthlyPrice: pkg.price || '—',
      yearlyPrice: pkg.yearlyPrice || pkg.price || '—',
      period: pkg.pricePeriod || 'per month',
      features:
        storedFeatures.length > 0
          ? storedFeatures
          : [
              formatLimitBullet(pkg.maxUsers, 'team users'),
              formatLimitBullet(pkg.maxJobs, 'active job postings'),
              'All platform modules included',
            ],
      footnote: pkg.description || '',
      isPopular: Boolean(pkg.isPopular),
    };
  }

  return {
    displayName: pkg.name.toUpperCase(),
    monthlyPrice: '—',
    yearlyPrice: '—',
    period: 'per month',
    features: [
      formatLimitBullet(pkg.maxUsers, 'team users'),
      formatLimitBullet(pkg.maxJobs, 'active job postings'),
      'All platform modules included',
      'Recruitment, HR, payroll, analytics & AI tools',
    ],
    footnote: pkg.description || 'Custom package for tenant assignment.',
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
