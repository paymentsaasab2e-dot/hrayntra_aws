import type { CrossDepartmentWorkRequest } from './api/teamApi';

export type ClientHandoffUiStatus = 'none' | 'pending' | 'accepted' | 'rejected';

export type ClientHandoffRequestInfo = {
  status: ClientHandoffUiStatus;
  requestId?: string;
  reviewNote?: string;
  targetDepartmentId?: string;
  targetDepartmentName?: string;
  updatedAt?: string;
};

export function resolveClientHandoffInfo(
  requests: CrossDepartmentWorkRequest[],
  clientId: string,
): ClientHandoffRequestInfo {
  const normalizedClientId = String(clientId || '').trim();
  if (!normalizedClientId) return { status: 'none' };

  const clientRequests = requests
    .filter(
      (req) =>
        String(req.workType || '').toUpperCase() === 'CLIENT' &&
        String(req.linkedEntityId || '').trim() === normalizedClientId,
    )
    .sort(
      (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime(),
    );

  if (!clientRequests.length) return { status: 'none' };

  const pending = clientRequests.find((req) => req.status === 'pending');
  if (pending) {
    return {
      status: 'pending',
      requestId: pending.id,
      targetDepartmentId: pending.targetDepartmentId,
      updatedAt: pending.updatedAt || pending.createdAt,
    };
  }

  const accepted = clientRequests.find((req) => req.status === 'accepted' || req.status === 'forwarded');
  if (accepted) {
    return {
      status: 'accepted',
      requestId: accepted.id,
      updatedAt: accepted.updatedAt || accepted.createdAt,
    };
  }

  const rejected = clientRequests.find((req) => req.status === 'rejected');
  if (rejected) {
    return {
      status: 'rejected',
      requestId: rejected.id,
      reviewNote: rejected.reviewNote,
      targetDepartmentId: rejected.targetDepartmentId,
      updatedAt: rejected.updatedAt || rejected.createdAt,
    };
  }

  return { status: 'none' };
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

export function canInitiateClientHandoff(info: ClientHandoffRequestInfo | undefined): boolean {
  if (!info || info.status === 'none' || info.status === 'rejected') return true;
  return false;
}
