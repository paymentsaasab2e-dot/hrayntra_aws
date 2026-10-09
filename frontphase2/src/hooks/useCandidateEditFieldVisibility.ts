'use client';

import { useCallback, useEffect, useState } from 'react';
import { ORG_RECRUITMENT_CACHE_EVENT, syncOrgRecruitmentSummaryFromApi } from '../lib/api';
import {
  getCachedCandidateEditFieldVisibility,
  type CandidateEditFieldVisibility,
} from '../lib/candidateEditFieldVisibility';

export function useCandidateEditFieldVisibility(): CandidateEditFieldVisibility {
  const [visibility, setVisibility] = useState<CandidateEditFieldVisibility>(() =>
    getCachedCandidateEditFieldVisibility(),
  );

  const refresh = useCallback(() => {
    setVisibility(getCachedCandidateEditFieldVisibility());
  }, []);

  useEffect(() => {
    refresh();
    let cancelled = false;

    const loadFromServer = async () => {
      try {
        await syncOrgRecruitmentSummaryFromApi({ force: true });
        if (!cancelled) refresh();
      } catch {
        // Keep cached/local defaults when sync fails.
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
