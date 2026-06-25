'use client';

import React from 'react';
import { CreditCard, LogOut, Mail } from 'lucide-react';
import { formatDateDMY } from '@/utils/dateDisplay';
import type { CachedOrgSubscriptionPlan } from '@/lib/orgTrialPlan';
import { clearTrialExpiredPlanSnapshot, getEmployersPurchaseUrl } from '@/lib/orgTrialPlan';

type TrialExpiredPurchaseModalProps = {
  open: boolean;
  plan: CachedOrgSubscriptionPlan | null;
  onDismiss: () => void;
};

export function TrialExpiredPurchaseModal({ open, plan, onDismiss }: TrialExpiredPurchaseModalProps) {
  if (!open) return null;

  const purchaseUrl = getEmployersPurchaseUrl();

  const handleDismiss = () => {
    clearTrialExpiredPlanSnapshot();
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-expired-title"
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
          <LogOut className="h-3.5 w-3.5" />
          Signed out — trial ended
        </div>

        <h2 id="trial-expired-title" className="text-2xl font-bold text-slate-900">
          Your 5-day trial has ended
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          You have been signed out. Purchase a plan to sign back in and continue using SAASA B2E with
          full access. Your workspace data is kept safe until you upgrade.
        </p>

        {plan?.planStartDate || plan?.planEndDate ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {plan.planStartDate ? (
              <p>
                <span className="font-semibold text-slate-900">Started:</span>{' '}
                {formatDateDMY(plan.planStartDate)}
              </p>
            ) : null}
            {plan.planEndDate ? (
              <p className={plan.planStartDate ? 'mt-1' : ''}>
                <span className="font-semibold text-slate-900">Ended:</span>{' '}
                {formatDateDMY(plan.planEndDate)}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={purchaseUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-105"
          >
            <CreditCard className="h-4 w-4" />
            Purchase a plan
          </a>
          <a
            href="mailto:support@hryantra.com?subject=SAASA%20B2E%20trial%20upgrade"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Mail className="h-4 w-4" />
            Contact sales
          </a>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="mt-4 w-full text-center text-xs font-medium text-slate-500 transition hover:text-slate-800"
        >
          Dismiss and sign in later
        </button>
      </div>
    </div>
  );
}
