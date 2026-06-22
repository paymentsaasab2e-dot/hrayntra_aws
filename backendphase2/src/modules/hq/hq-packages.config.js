/** All platform modules are available on every package — only user/job limits differ. */
export const DEFAULT_HQ_PACKAGES = [
  {
    slug: 'basic',
    name: 'Basic',
    description: 'Small teams — limited users and job postings.',
    maxUsers: 5,
    maxJobs: 25,
    isSystem: true,
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'Growing teams — more users, unlimited job postings.',
    maxUsers: 25,
    maxJobs: null,
    isSystem: true,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Large organizations — unlimited users and job postings.',
    maxUsers: null,
    maxJobs: null,
    isSystem: true,
  },
];

export function toAssignablePlan(pkg) {
  if (!pkg) return null;
  return {
    id: String(pkg.id || pkg._id || ''),
    name: String(pkg.name || '').trim(),
    maxUsers: pkg.maxUsers === null || pkg.maxUsers === undefined ? null : Number(pkg.maxUsers) || null,
    maxJobs: pkg.maxJobs === null || pkg.maxJobs === undefined ? null : Number(pkg.maxJobs) || null,
  };
}
