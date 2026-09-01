const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export type AssigneeNameSource = {
  id?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

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
