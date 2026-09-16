const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export type AssigneeNameSource = {
  id?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export function getStoredCurrentUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('currentUser');
    if (!raw) return '';
    const user = JSON.parse(raw) as Record<string, unknown>;
    return String(user.id || user.userId || user._id || '').trim();
  } catch {
    return '';
  }
}

export function isCurrentAssignee(
  userId: string | null | undefined,
  currentUserId: string | null | undefined = getStoredCurrentUserId(),
): boolean {
  const a = String(userId || '').trim();
  const b = String(currentUserId || '').trim();
  return Boolean(a && b && a === b);
}

export function formatAssigneeOptionLabel(
  user: AssigneeNameSource | null | undefined,
  currentUserId: string | null | undefined = getStoredCurrentUserId(),
): string {
  const name = formatAssigneeDisplayName(user) || String(user?.name || '').trim() || 'Member';
  return isCurrentAssignee(user?.id, currentUserId) ? `${name} (You)` : name;
}

/** Team member label for Assign To — never a raw Mongo id. */
export function formatAssigneeDisplayName(user: AssigneeNameSource | null | undefined): string {
  if (!user) return '';
  const id = String(user.id || '').trim();
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const named = String(user.name || '').trim();
  const email = String(user.email || '').trim();
  const pick = full || named || email;
  if (!pick) return '';
  if (id && pick === id) return email && email !== id ? email : '';
  if (OBJECT_ID_RE.test(pick) && !full) return email && email !== pick ? email : '';
  return pick;
}

export function assigneeCompanyId(user: {
  assignCompanyId?: string | null;
  orgUnitId?: string | null;
  orgUnit?: { id?: string | null } | null;
} | null | undefined): string {
  return String(user?.assignCompanyId || user?.orgUnitId || user?.orgUnit?.id || '').trim();
}
