export function isPendingFollowUp(item) {
  const status = String(item?.status || 'scheduled').toLowerCase();
  return status !== 'completed' && status !== 'done' && status !== 'cancelled';
}

export function recomputeNextFollowUpAt(followUps) {
  if (!Array.isArray(followUps)) return null;
  const upcoming = followUps
    .filter((item) => isPendingFollowUp(item))
    .map((item) => {
      const raw = item?.scheduledAt;
      const date = raw instanceof Date ? raw : raw ? new Date(raw) : null;
      return date && !Number.isNaN(date.getTime()) ? date : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming.length ? upcoming[0] : null;
}

export function findFollowUpIndex(followUps, followUpId) {
  if (!Array.isArray(followUps)) return -1;
  const target = String(followUpId || '');
  if (!target) return -1;
  return followUps.findIndex((item) => {
    const id = String(item?.id || '');
    const oid = item?._id != null ? String(item._id) : '';
    return (id && id === target) || (oid && oid === target);
  });
}

export function findNextPendingFollowUpIndex(followUps) {
  if (!Array.isArray(followUps)) return -1;
  let best = -1;
  let bestTime = Infinity;
  followUps.forEach((item, index) => {
    if (!isPendingFollowUp(item)) return;
    const raw = item?.scheduledAt;
    const date = raw instanceof Date ? raw : raw ? new Date(raw) : null;
    const time = date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
    if (time < bestTime) {
      bestTime = time;
      best = index;
    }
  });
  return best;
}

export function withFollowUpIds(followUps) {
  if (!Array.isArray(followUps)) return [];
  return followUps.map((item) => ({
    ...item,
    id: String(item?.id || item?._id || ''),
  }));
}

export function isNextFollowUpToken(followUpId) {
  return ['next', '__next__', 'pending'].includes(String(followUpId || '').trim().toLowerCase());
}
