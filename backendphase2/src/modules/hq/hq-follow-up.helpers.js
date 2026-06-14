export function recomputeNextFollowUpAt(followUps) {
  if (!Array.isArray(followUps)) return null;
  const upcoming = followUps
    .filter((item) => String(item?.status || 'scheduled') !== 'completed')
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
  return followUps.findIndex((item) => String(item?.id || '') === String(followUpId || ''));
}
