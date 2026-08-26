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

export function orgUnitIdsFromQuery(q = {}) {
  return String(q.orgUnitIds || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Company-scoped list filter for dashboards:
 * - rows stamped with selected orgUnitId (or descendants)
 * - legacy untagged rows still owned by company people (assignedTo)
 */
export function companyRecordScope(q = {}, assignedField = 'assignedToId') {
  const unitIds = orgUnitIdsFromQuery(q);
  const assignedTo = assigneeIdFilter(q);
  if (!unitIds.length) {
    return assignedTo ? { [assignedField]: assignedTo } : {};
  }
  const or = [{ orgUnitId: { in: unitIds } }];
  if (assignedTo) {
    or.push({
      AND: [
        { OR: [{ orgUnitId: null }, { orgUnitId: { isSet: false } }] },
        { [assignedField]: assignedTo },
      ],
    });
  }
  return { OR: or };
}

export function orHasStringArray(field, assignedTo) {
  if (!assignedTo) return [];
  const ids = typeof assignedTo === 'object' && Array.isArray(assignedTo.in) ? assignedTo.in : [assignedTo];
  return ids.map((id) => ({ [field]: { has: id } }));
}
