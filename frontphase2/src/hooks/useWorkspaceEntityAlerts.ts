'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiGetWorkspaceBriefEntityAlertsBatch,
  WORKSPACE_BRIEF_UPDATED_EVENT,
  type AiWorkspaceBriefAlert,
  type AiWorkspaceBriefEntityType,
} from '@/lib/apiAiWorkspaceBrief';

export function useWorkspaceEntityAlerts(
  entityType: AiWorkspaceBriefEntityType,
  entityIds: string[],
) {
  const [alertsByEntityId, setAlertsByEntityId] = useState<Record<string, AiWorkspaceBriefAlert[]>>({});
  const idsKey = useMemo(
    () => [...new Set(entityIds.map((id) => String(id || '').trim()).filter(Boolean))].sort().join(','),
    [entityIds],
  );

  const load = useCallback(
    async (ids: string[]) => {
      const uniqueIds = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
      if (!uniqueIds.length) {
        setAlertsByEntityId({});
        return;
      }
      try {
        const res = await apiGetWorkspaceBriefEntityAlertsBatch(entityType, uniqueIds);
        setAlertsByEntityId(res.data?.alertsByEntityId ?? {});
      } catch {
        setAlertsByEntityId({});
      }
    },
    [entityType],
  );

  useEffect(() => {
    void load(idsKey ? idsKey.split(',') : []);
  }, [idsKey, load]);

  useEffect(() => {
    const onUpdated = () => void load(idsKey ? idsKey.split(',') : []);
    window.addEventListener(WORKSPACE_BRIEF_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(WORKSPACE_BRIEF_UPDATED_EVENT, onUpdated);
  }, [idsKey, load]);

  const showAlertColumn = useMemo(
    () => Object.values(alertsByEntityId).some((alerts) => alerts.length > 0),
    [alertsByEntityId],
  );

  return { alertsByEntityId, showAlertColumn };
}
