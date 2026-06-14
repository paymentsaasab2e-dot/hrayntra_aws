const idStr = (id) => String(id || '').trim();

export function uniqueUserIds(...values) {
  return [...new Set(values.map((value) => idStr(value)).filter(Boolean))];
}

export function appendParticipantIds(existing = [], ...ids) {
  return uniqueUserIds(...(Array.isArray(existing) ? existing : []), ...ids);
}

export function buildInitialParticipantIds(createdById, assignedToId) {
  return uniqueUserIds(createdById, assignedToId);
}

/** OR-clause members for CRM list/detail visibility (assignee, creator, assignment history). */
export function buildAssigneeVisibilityOr(userId, { includeAssignedToIds = false } = {}) {
  const uid = idStr(userId);
  if (!uid) return [];
  const or = [
    { assignedToId: uid },
    { createdById: uid },
    { participantIds: { has: uid } },
  ];
  if (includeAssignedToIds) {
    or.push({ assignedToIds: { has: uid } });
  }
  return or;
}

/**
 * When assignee changes, keep prior assignee + assigner in participantIds so both
 * still see the record after handoff (same pattern as tasks).
 */
export function stampVisibilityOnAssigneeChange({
  updateData,
  previous,
  performerId,
  assigneeField = 'assignedToId',
  participantField = 'participantIds',
  creatorField = 'createdById',
}) {
  const prevAssignee = previous?.[assigneeField];
  const nextAssignee = updateData?.[assigneeField];
  if (nextAssignee === undefined || idStr(nextAssignee) === idStr(prevAssignee)) {
    return updateData;
  }

  const performer = idStr(performerId);
  if (!previous?.[creatorField] && performer) {
    updateData[creatorField] = performer;
  }

  updateData[participantField] = appendParticipantIds(
    previous?.[participantField],
    prevAssignee,
    performer,
    previous?.[creatorField],
  );

  return updateData;
}

/** Lead uses assignedToIds instead of participantIds. */
export function stampLeadAssigneeVisibility({
  updateData,
  previous,
  performerId,
  nextPrimaryId,
  nextIds,
}) {
  const performer = idStr(performerId);
  const prevPrimary = idStr(previous?.assignedToId);
  const primary = idStr(nextPrimaryId);

  if (Array.isArray(nextIds)) {
    updateData.assignedToIds = uniqueUserIds(
      ...nextIds,
      primary,
      prevPrimary,
      ...(Array.isArray(previous?.assignedToIds) ? previous.assignedToIds : []),
      performer,
      previous?.createdBy,
    );
    return updateData;
  }

  if (nextPrimaryId !== undefined) {
    if (primary) {
      updateData.assignedToIds = uniqueUserIds(
        primary,
        prevPrimary,
        ...(Array.isArray(previous?.assignedToIds) ? previous.assignedToIds : []),
        performer,
        previous?.createdBy,
      );
    } else {
      updateData.assignedToIds = [];
    }
  }

  return updateData;
}
