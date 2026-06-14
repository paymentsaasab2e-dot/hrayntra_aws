'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  LEAD_CONVERSION_REQUESTS_UPDATED_EVENT,
  listLeadConversionRequests,
  type LeadConversionRequest,
} from '../lib/api/teamApi';
import { resolveLatestSentRequestStatus, type SentRequestInfo } from '../lib/sentRequestStatus';

export function resolveLeadConversionInfo(
  requests: LeadConversionRequest[],
  leadId: string,
): SentRequestInfo {
  const normalizedLeadId = String(leadId || '').trim();
  return resolveLatestSentRequestStatus(requests, (req) => String(req.leadId || '').trim() === normalizedLeadId);
}

export function useLeadConversionStatuses() {
  const [requests, setRequests] = useState<LeadConversionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await listLeadConversionRequests('sent');
      setRequests(Array.isArray(rows) ? rows : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdated = () => void refresh();
    window.addEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdated);
  }, [refresh]);

  const getStatusForLead = useCallback(
    (leadId: string): SentRequestInfo => resolveLeadConversionInfo(requests, leadId),
    [requests],
  );

  return { loading, requests, getStatusForLead, refresh };
}
