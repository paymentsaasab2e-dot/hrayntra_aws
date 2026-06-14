import type { CrossDepartmentWorkRequest } from './api/teamApi';
import {
  canInitiateSentRequest,
  resolveLatestSentRequestStatus,
  type SentRequestInfo,
  type SentRequestUiStatus,
} from './sentRequestStatus';

export type ClientHandoffUiStatus = SentRequestUiStatus;
export type ClientHandoffRequestInfo = SentRequestInfo;

export function resolveClientHandoffInfo(
  requests: CrossDepartmentWorkRequest[],
  clientId: string,
): ClientHandoffRequestInfo {
  const normalizedClientId = String(clientId || '').trim();
  return resolveLatestSentRequestStatus(requests, (req) => {
    if (String(req.workType || '').toUpperCase() !== 'CLIENT') return false;
    return String(req.linkedEntityId || '').trim() === normalizedClientId;
  });
}

export function buildClientHandoffStatusMap(
  requests: CrossDepartmentWorkRequest[],
): Map<string, ClientHandoffRequestInfo> {
  const clientIds = new Set<string>();
  for (const req of requests) {
    if (String(req.workType || '').toUpperCase() !== 'CLIENT') continue;
    const clientId = String(req.linkedEntityId || '').trim();
    if (clientId) clientIds.add(clientId);
  }

  const map = new Map<string, ClientHandoffRequestInfo>();
  for (const clientId of clientIds) {
    map.set(clientId, resolveClientHandoffInfo(requests, clientId));
  }
  return map;
}

export const canInitiateClientHandoff = canInitiateSentRequest;
