/** All platform modules are available on every package — only user/job limits differ. */
export const DEFAULT_HQ_PACKAGES = [
  {
    slug: 'starter',
    name: 'Starter',
    displayName: 'STARTER',
    description: 'For small teams hiring their first roles on SAASA B2E.',
    price: '149',
    yearlyPrice: '119',
    pricePeriod: 'per month',
    features: [
      'Up to 25 active job postings',
      'AI CV screening & ATS scoring',
      'Candidate pipeline & interviews',
      'Basic analytics dashboard',
      'Email support (48h response)',
    ],
    isPopular: false,
    maxUsers: 5,
    maxJobs: 25,
    annualMaxUsers: 8,
    annualMaxJobs: 40,
    isSystem: true,
  },
  {
    slug: 'professional',
    name: 'Professional',
    displayName: 'PROFESSIONAL',
    description: 'For growing companies running hiring and HR in one place.',
    price: '399',
    yearlyPrice: '319',
    pricePeriod: 'per month',
    features: [
      'Unlimited job postings',
      'Full AI recruitment suite',
      'Employee management & onboarding',
      'Performance & payroll modules',
      'Multi-platform job publishing',
      'Priority support (24h response)',
      'Team collaboration & roles',
    ],
    isPopular: true,
    maxUsers: 25,
    maxJobs: null,
    annualMaxUsers: 40,
    annualMaxJobs: null,
    isSystem: true,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    displayName: 'ENTERPRISE',
    description: 'For large organizations with complex HR operations.',
    price: '999',
    yearlyPrice: '799',
    pricePeriod: 'per month',
    features: [
      'Everything in Professional',
      'Custom workflows & integrations',
      'Dedicated account manager',
      'SSO & advanced security',
      'SLA-backed uptime',
      'On-premise / private cloud options',
      'Custom contracts & training',
    ],
    isPopular: false,
    maxUsers: null,
    maxJobs: null,
    annualMaxUsers: null,
    annualMaxJobs: null,
    isSystem: true,
  },
];

const SLUG_ALIASES = {
  basic: 'starter',
  pro: 'professional',
};

export function resolvePackageSlug(slug, name) {
  const raw = String(slug || name || '')
    .trim()
    .toLowerCase();
  return SLUG_ALIASES[raw] || raw;
}

export function getDefaultPackageTemplate(slug, name) {
  const key = resolvePackageSlug(slug, name);
  return (
    DEFAULT_HQ_PACKAGES.find((pkg) => pkg.slug === key) ||
    DEFAULT_HQ_PACKAGES.find((pkg) => pkg.name.toLowerCase() === String(name || '').toLowerCase()) ||
    null
  );
}

export function enrichPackageDoc(doc) {
  const template = getDefaultPackageTemplate(doc?.slug, doc?.name);
  const features = Array.isArray(doc?.features)
    ? doc.features.map(String).filter(Boolean)
    : template?.features || [];

  return {
    ...doc,
    displayName:
      String(doc?.displayName || '').trim() ||
      template?.displayName ||
      String(doc?.name || '').trim().toUpperCase(),
    description:
      String(doc?.description || '').trim() || template?.description || '',
    price: String(doc?.price ?? template?.price ?? '').trim(),
    yearlyPrice: String(doc?.yearlyPrice ?? template?.yearlyPrice ?? '').trim(),
    pricePeriod:
      String(doc?.pricePeriod || '').trim() || template?.pricePeriod || 'per month',
    features: features.length > 0 ? features : template?.features || [],
    isPopular:
      doc?.isPopular === undefined || doc?.isPopular === null
        ? Boolean(template?.isPopular)
        : Boolean(doc.isPopular),
  };
}

export function resolveBillingCycle(value) {
  return String(value || '').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly';
}

export function parsePlanStartDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function todayPlanStartDate() {
  return new Date().toISOString().slice(0, 10);
}

export function computePlanEndDate(startDateIso, billingCycle = 'monthly') {
  const start = parsePlanStartDate(startDateIso);
  if (!start) return null;
  const days = resolveBillingCycle(billingCycle) === 'annual' ? 365 : 30;
  const d = new Date(`${start}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const TRIAL_PACKAGE_DAYS = 5;

export function computeTrialEndDate(startDateIso) {
  const start = parsePlanStartDate(startDateIso) || todayPlanStartDate();
  const d = new Date(`${start}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + TRIAL_PACKAGE_DAYS);
  return d.toISOString().slice(0, 10);
}

export function toTrialAssignablePlan(pkg, planStartDate) {
  const base = toAssignablePlan(pkg, 'monthly', planStartDate);
  if (!base) return null;
  return {
    ...base,
    name: `${base.name} Trial`,
    planEndDate: computeTrialEndDate(base.planStartDate),
    isTrial: true,
    trialDays: TRIAL_PACKAGE_DAYS,
  };
}

export function resolvePackageLimits(pkg, billingCycle = 'monthly') {
  const cycle = resolveBillingCycle(billingCycle);
  if (cycle === 'annual') {
    return {
      billingCycle: cycle,
      maxUsers:
        pkg?.annualMaxUsers === null || pkg?.annualMaxUsers === undefined
          ? pkg?.maxUsers ?? null
          : Number(pkg.annualMaxUsers) || null,
      maxJobs:
        pkg?.annualMaxJobs === null || pkg?.annualMaxJobs === undefined
          ? pkg?.maxJobs ?? null
          : Number(pkg.annualMaxJobs) || null,
    };
  }
  return {
    billingCycle: 'monthly',
    maxUsers: pkg?.maxUsers === null || pkg?.maxUsers === undefined ? null : Number(pkg.maxUsers) || null,
    maxJobs: pkg?.maxJobs === null || pkg?.maxJobs === undefined ? null : Number(pkg.maxJobs) || null,
  };
}

export function toAssignablePlan(pkg, billingCycle = 'monthly', planStartDate) {
  if (!pkg) return null;
  const limits = resolvePackageLimits(pkg, billingCycle);
  const start = parsePlanStartDate(planStartDate) || todayPlanStartDate();
  return {
    id: String(pkg.id || pkg._id || ''),
    name: String(pkg.name || '').trim(),
    billingCycle: limits.billingCycle,
    maxUsers: limits.maxUsers,
    maxJobs: limits.maxJobs,
    planStartDate: start,
    planEndDate: computePlanEndDate(start, limits.billingCycle),
  };
}
