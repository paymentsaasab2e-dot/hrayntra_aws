'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  buildClientHandoffStatusMap,
  resolveClientHandoffInfo,
  type ClientHandoffRequestInfo,
} from '../lib/clientHandoffStatus';
import {
  CROSS_DEPT_REQUESTS_UPDATED_EVENT,
  listCrossDeptRequests,
  type CrossDepartmentWorkRequest,
} from '../lib/api/teamApi';

export function useClientHandoffStatuses() {
  const [requests, setRequests] = useState<CrossDepartmentWorkRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await listCrossDeptRequests('sent');
      const clientRows = Array.isArray(rows)
        ? rows.filter((row) => String(row.workType || '').toUpperCase() === 'CLIENT')
        : [];
      setRequests(clientRows);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdated = () => void refresh();
    window.addEventListener(CROSS_DEPT_REQUESTS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(CROSS_DEPT_REQUESTS_UPDATED_EVENT, onUpdated);
  }, [refresh]);

  const statusMap = buildClientHandoffStatusMap(requests);

  const getStatusForClient = useCallback(
    (clientId: string): ClientHandoffRequestInfo => {
      return statusMap.get(clientId) || resolveClientHandoffInfo(requests, clientId);
    },
    [requests, statusMap],
  );

  return {
    loading,
    requests,
    statusMap,
    getStatusForClient,
    refresh,
  };
}
