'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TrialExpiredPurchaseModal } from '@/components/trial/TrialExpiredPurchaseModal';
import {
  readTrialExpiredPlanSnapshot,
  TRIAL_EXPIRED_URL_PARAM,
  type CachedOrgSubscriptionPlan,
} from '@/lib/orgTrialPlan';

export function TrialExpiredLoginPrompt() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<CachedOrgSubscriptionPlan | null>(null);

  useEffect(() => {
    if (searchParams.get(TRIAL_EXPIRED_URL_PARAM) !== '1') return;
    setPlan(readTrialExpiredPlanSnapshot());
    setOpen(true);
  }, [searchParams]);

  return (
    <TrialExpiredPurchaseModal
      open={open}
      plan={plan}
      onDismiss={() => {
        setOpen(false);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete(TRIAL_EXPIRED_URL_PARAM);
          window.history.replaceState({}, '', `${url.pathname}${url.search}`);
        }
      }}
    />
  );
}
