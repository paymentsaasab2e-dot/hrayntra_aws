'use client';

import { useCallback, useEffect, useState } from 'react';
import { ORG_RECRUITMENT_CACHE_EVENT } from '../lib/api';
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
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, refresh);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, refresh);
  }, [refresh]);

  return visibility;
}
