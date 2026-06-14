'use client';

import { useCallback, useEffect, useState } from 'react';
import { ORG_RECRUITMENT_CACHE_EVENT, syncOrgRecruitmentSummaryFromApi } from '../lib/api';
import {
  getCachedClientPageFieldVisibility,
  type ClientPageFieldVisibility,
} from '../lib/clientPageFieldVisibility';

export function useClientPageFieldVisibility(): ClientPageFieldVisibility {
  const [visibility, setVisibility] = useState<ClientPageFieldVisibility>(() =>
    getCachedClientPageFieldVisibility(),
  );

  const refresh = useCallback(() => {
    setVisibility(getCachedClientPageFieldVisibility());
  }, []);

  useEffect(() => {
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
  }, [refresh]);

  return visibility;
}
