export function isSuperAdminUser(reqOrUser) {
  const u = reqOrUser?.user || reqOrUser;
  const role = u?.role || reqOrUser?.role || '';
  const roleName =
    u?.roleName || u?.systemRole?.roleName || reqOrUser?.roleName || reqOrUser?.systemRole?.roleName || '';
  const normalizedRole = String(role).trim().toUpperCase().replace(/\s+/g, '_');
  const normalizedRoleName = String(roleName).trim().toUpperCase().replace(/\s+/g, '_');
  return (
    normalizedRole === 'SUPER_ADMIN' ||
    normalizedRoleName === 'SUPER_ADMIN' ||
    normalizedRoleName.replace(/_/g, '') === 'SUPERADMIN'
  );
}

export function buildSuperAdminOwnerScope(reqOrUser, ownerFields = []) {
  const userId = reqOrUser?.user?.id || reqOrUser?.id;
  if (!isSuperAdminUser(reqOrUser) || !userId || !Array.isArray(ownerFields) || ownerFields.length === 0) {
    return null;
  }

  // Super Admin should see all tenant records by default.
  // Apply owner-only scope only when explicitly requested via mineOnly=true.
  const mineOnlyRaw = reqOrUser?.query?.mineOnly;
  const mineOnly = mineOnlyRaw === true || String(mineOnlyRaw).toLowerCase() === 'true';
  if (!mineOnly) {
    return null;
  }

  const parts = ownerFields
    .map((field) => String(field || '').trim())
    .filter(Boolean)
    .map((field) => ({ [field]: userId }));

  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return { OR: parts };
}

export function mergeWhereWithScope(where = {}, scope = null) {
  if (!scope) return where;
  if (!where || Object.keys(where).length === 0) return scope;
  return { AND: [where, scope] };
}
