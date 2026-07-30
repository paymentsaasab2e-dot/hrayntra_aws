'use client';

import { useCallback, useEffect, useState } from 'react';
import { ORG_RECRUITMENT_CACHE_EVENT, syncOrgRecruitmentSummaryFromApi } from '../lib/api';
import {
  getCachedClientPageFieldVisibility,
  type ClientPageFieldVisibility,
} from '../lib/clientPageFieldVisibility';
import { useClientPageFieldVisibilityOverride } from '../components/hq/ClientPageFieldVisibilityOverride';

export function useClientPageFieldVisibility(): ClientPageFieldVisibility {
  const override = useClientPageFieldVisibilityOverride();
  const [visibility, setVisibility] = useState<ClientPageFieldVisibility>(() =>
    getCachedClientPageFieldVisibility(),
  );

  const refresh = useCallback(() => {
    setVisibility(getCachedClientPageFieldVisibility());
  }, []);

  useEffect(() => {
    if (override) return;
    refresh();
    let cancelled = false;

    const loadFromServer = async () => {
      try {
        await syncOrgRecruitmentSummaryFromApi();
        if (!cancelled) refresh();
      } catch {
        // Keep cached/local values when sync fails.
      }
    };

    void loadFromServer();
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, refresh);
    };
  }, [override, refresh]);

  return override ?? visibility;
}
