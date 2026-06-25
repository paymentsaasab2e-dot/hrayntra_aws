export type CachedOrgSubscriptionPlan = {
  name?: string;
  planStartDate?: string;
  planEndDate?: string;
  isTrial?: boolean;
  trialDays?: number;
};

const CACHE_KEY = 'orgSubscriptionPlan';
export const TRIAL_EXPIRED_PLAN_SESSION_KEY = 'trialExpiredPlanSnapshot';
export const TRIAL_EXPIRED_URL_PARAM = 'trialExpired';

export function getCachedOrgSubscriptionPlan(): CachedOrgSubscriptionPlan | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedOrgSubscriptionPlan;
  } catch {
    return null;
  }
}

export function setCachedOrgSubscriptionPlan(plan: CachedOrgSubscriptionPlan | null) {
  if (typeof window === 'undefined') return;
  if (!plan || (!plan.name && !plan.planStartDate && !plan.planEndDate)) {
    localStorage.removeItem(CACHE_KEY);
    return;
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(plan));
}

export function parsePlanDate(value?: string | null): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 23, 59, 59, 999);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getTrialDaysRemaining(plan: CachedOrgSubscriptionPlan | null): number | null {
  if (!plan?.isTrial || !plan.planEndDate) return null;
  const end = parsePlanDate(plan.planEndDate);
  if (!end) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  const diff = Math.ceil((endDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

export function isTrialExpired(plan: CachedOrgSubscriptionPlan | null): boolean {
  if (!plan?.isTrial || !plan.planEndDate) return false;
  const end = parsePlanDate(plan.planEndDate);
  if (!end) return false;
  return Date.now() > end.getTime();
}

export function getEmployersPurchaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MARKETING_EMPLOYERS_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000/en/employers';
  }
  return 'https://www.hryantra.com/en/employers';
}

export function persistTrialExpiredPlan(plan: CachedOrgSubscriptionPlan | null) {
  if (typeof window === 'undefined' || !plan) return;
  sessionStorage.setItem(TRIAL_EXPIRED_PLAN_SESSION_KEY, JSON.stringify(plan));
}

export function readTrialExpiredPlanSnapshot(): CachedOrgSubscriptionPlan | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(TRIAL_EXPIRED_PLAN_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedOrgSubscriptionPlan;
  } catch {
    return null;
  }
}

export function clearTrialExpiredPlanSnapshot() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TRIAL_EXPIRED_PLAN_SESSION_KEY);
}
