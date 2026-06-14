export type SentRequestUiStatus = 'none' | 'pending' | 'accepted' | 'rejected';

export type SentRequestInfo = {
  status: SentRequestUiStatus;
  requestId?: string;
  reviewNote?: string;
  requestNote?: string;
  updatedAt?: string;
};

type RequestLike = {
  id: string;
  status: string;
  reviewNote?: string;
  requestNote?: string;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeStatus(status: string): SentRequestUiStatus {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'pending') return 'pending';
  if (value === 'accepted' || value === 'approved' || value === 'forwarded') return 'accepted';
  if (value === 'rejected') return 'rejected';
  return 'none';
}

export function resolveLatestSentRequestStatus<T extends RequestLike>(
  requests: T[],
  matches: (request: T) => boolean,
): SentRequestInfo {
  const relevant = requests
    .filter(matches)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    );

  if (!relevant.length) return { status: 'none' };

  const pending = relevant.find((req) => normalizeStatus(req.status) === 'pending');
  if (pending) {
    return {
      status: 'pending',
      requestId: pending.id,
      requestNote: pending.requestNote,
      updatedAt: pending.updatedAt || pending.createdAt,
    };
  }

  const accepted = relevant.find((req) => normalizeStatus(req.status) === 'accepted');
  if (accepted) {
    return {
      status: 'accepted',
      requestId: accepted.id,
      updatedAt: accepted.updatedAt || accepted.createdAt,
    };
  }

  const rejected = relevant.find((req) => normalizeStatus(req.status) === 'rejected');
  if (rejected) {
    return {
      status: 'rejected',
      requestId: rejected.id,
      reviewNote: rejected.reviewNote,
      requestNote: rejected.requestNote,
      updatedAt: rejected.updatedAt || rejected.createdAt,
    };
  }

  return { status: 'none' };
}

export function canInitiateSentRequest(info: SentRequestInfo | undefined): boolean {
  if (!info || info.status === 'none' || info.status === 'rejected') return true;
  return false;
}

export function sentRequestStatusLabel(info: SentRequestInfo | undefined): string | null {
  if (!info || info.status === 'none') return null;
  if (info.status === 'pending') return 'Request pending';
  if (info.status === 'accepted') return 'Request approved';
  return 'Request rejected';
}
