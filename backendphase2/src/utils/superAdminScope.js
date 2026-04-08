export function isSuperAdminUser(reqOrUser) {
  const role = reqOrUser?.user?.role || reqOrUser?.role || '';
  const roleName = reqOrUser?.user?.roleName || reqOrUser?.roleName || '';
  const normalizedRole = String(role).trim().toUpperCase().replace(/\s+/g, '_');
  const normalizedRoleName = String(roleName).trim().toUpperCase().replace(/\s+/g, '_');
  return normalizedRole === 'SUPER_ADMIN' || normalizedRoleName === 'SUPER_ADMIN';
}

export function buildSuperAdminOwnerScope(reqOrUser, ownerFields = []) {
  const userId = reqOrUser?.user?.id || reqOrUser?.id;
  if (!isSuperAdminUser(reqOrUser) || !userId || !Array.isArray(ownerFields) || ownerFields.length === 0) {
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
