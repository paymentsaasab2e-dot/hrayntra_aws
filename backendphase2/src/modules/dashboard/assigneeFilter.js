/** Single assignee id or `{ in: ids }` from query.assignedTo / assignedToIds. */
export function assigneeIdFilter(q = {}) {
  const many = String(q.assignedToIds || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const one = String(q.assignedTo || q.team || q.recruiterId || '').trim();
  if (many.length === 1) return many[0];
  if (many.length > 1) return { in: many };
  return one || undefined;
}

export function orHasStringArray(field, assignedTo) {
  if (!assignedTo) return [];
  const ids = typeof assignedTo === 'object' && Array.isArray(assignedTo.in) ? assignedTo.in : [assignedTo];
  return ids.map((id) => ({ [field]: { has: id } }));
}
