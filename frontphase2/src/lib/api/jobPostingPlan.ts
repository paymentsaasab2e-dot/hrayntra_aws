import { apiFetch } from './core';
import type { SubscriptionPaymentOrder } from './types';

export type JobPostingQuotaSnapshot = {
  monthKey: string;
  tier: 'free' | 'premium' | string;
  billingCycle?: string;
  limit: number;
  used: number;
  remaining: number;
  canPublish: boolean;
  premiumUntil?: string | null;
  freeLimit: number;
  premiumLimit: number;
  pricing: {
    monthlyPaise: number;
    yearlyPaise: number;
    currency: string;
  };
};

export type FreeJobPackOffer = {
  id: string;
  name: string;
  description?: string;
  monthlyLimit: number;
  durationDays: number;
  priceUsd: number;
  priceLabel: string;
  popular?: boolean;
};

export type JobPostingPremiumOffer = {
  name: string;
  description: string;
  monthly: { billingCycle: string; amountPaise: number; limit: number };
  yearly: { billingCycle: string; amountPaise: number; limit: number };
  freeLimit: number;
  packs?: FreeJobPackOffer[];
};

export const JOB_POSTING_QUOTA_ERROR_CODE = 'JOB_POSTING_QUOTA_EXCEEDED';

export function isJobPostingQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { status?: number; data?: { code?: string; quota?: unknown }; message?: string };
  if (err.data?.code === JOB_POSTING_QUOTA_ERROR_CODE) return true;
  if (err.status === 402 && /job posts this month|Upgrade to Premium/i.test(String(err.message || ''))) {
    return true;
  }
  return false;
}

export function readQuotaFromError(error: unknown): JobPostingQuotaSnapshot | null {
  if (!error || typeof error !== 'object') return null;
  const quota = (error as { data?: { quota?: JobPostingQuotaSnapshot } }).data?.quota;
  return quota && typeof quota === 'object' ? quota : null;
}

export async function apiGetJobPostingPlan() {
  return apiFetch<{
    snapshot: JobPostingQuotaSnapshot;
    offer: JobPostingPremiumOffer;
    packs?: FreeJobPackOffer[];
  }>('/job-posting-plan', { auth: true });
}

export async function apiCreateJobPostingPremiumOrder(body: {
  billingCycle?: 'monthly' | 'annual';
  packId?: string;
}) {
  return apiFetch<SubscriptionPaymentOrder>('/job-posting-plan/payment-order', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiActivateJobPostingPremium(body: {
  billingCycle?: 'monthly' | 'annual';
  packId?: string;
  paymentReference?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}) {
  return apiFetch<{
    plan: Record<string, unknown>;
    snapshot: JobPostingQuotaSnapshot;
  }>('/job-posting-plan/activate', {
    method: 'POST',
    auth: true,
    body,
  });
}
