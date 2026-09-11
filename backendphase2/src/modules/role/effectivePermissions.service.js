import { prisma } from '../../config/prisma.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';

export const OVERRIDE_GRANT = 'GRANT';
export const OVERRIDE_DENY = 'DENY';

function oid(value) {
  return String(value || '').trim();
}

function uniqueNames(values = []) {
  return Array.from(new Set((values || []).map((v) => String(v || '').trim()).filter(Boolean)));
}

function normalizeOverrideRows(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const permissionId = oid(row?.permissionId);
      if (!permissionId) return null;
      const effect =
        String(row?.effect || '').toUpperCase() === OVERRIDE_DENY ? OVERRIDE_DENY : OVERRIDE_GRANT;
      return { permissionId, effect };
    })
    .filter(Boolean);
}

/**
 * Live role permissions ∪ GRANT − DENY.
 * New members with no override rows inherit the role fully.
 */
export function mergeRoleAndOverrides(rolePermissionNames = [], overrides = []) {
  const effective = new Set(uniqueNames(rolePermissionNames));
  for (const row of overrides || []) {
    const name = String(row?.permissionName || row?.permission?.permissionName || '').trim();
    if (!name) continue;
    const effect = String(row?.effect || '').toUpperCase();
    if (effect === OVERRIDE_GRANT) effective.add(name);
    else if (effect === OVERRIDE_DENY) effective.delete(name);
  }
  return Array.from(effective);
}

export async function loadRolePermissionNames(roleId) {
  const id = oid(roleId);
  if (!id) return [];
  const rows = await prisma.rolePermission.findMany({
    where: { roleId: id },
    select: { permission: { select: { permissionName: true } } },
  });
  return uniqueNames(rows.map((row) => row.permission?.permissionName));
}

async function loadOverridesFromCollection(userId) {
  try {
    const rows = await prisma.userPermissionOverride.findMany({
      where: { userId },
      select: {
        id: true,
        permissionId: true,
        effect: true,
        permission: { select: { id: true, permissionName: true, module: true } },
      },
    });
    return (rows || []).map((row) => ({
      id: String(row.id),
      permissionId: String(row.permissionId),
      effect: String(row.effect || '').toUpperCase() === OVERRIDE_DENY ? OVERRIDE_DENY : OVERRIDE_GRANT,
      permissionName: row.permission?.permissionName || '',
      module: row.permission?.module || '',
    }));
  } catch (error) {
    console.warn('[permissions] collection overrides failed:', error?.message || error);
    return null;
  }
}

async function loadOverridesFromUserJson(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { permissionOverrides: true },
    });
    const rows = normalizeOverrideRows(user?.permissionOverrides);
    if (!rows.length) return [];
    const permissionIds = rows.map((row) => row.permissionId);
    const perms = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true, permissionName: true, module: true },
    });
    const byId = new Map(perms.map((p) => [String(p.id), p]));
    return rows.map((row) => {
      const permission = byId.get(row.permissionId);
      return {
        id: `${userId}:${row.permissionId}`,
        permissionId: row.permissionId,
        effect: row.effect,
        permissionName: permission?.permissionName || '',
        module: permission?.module || '',
      };
    });
  } catch {
    return [];
  }
}

export async function loadUserPermissionOverrides(userId) {
  const id = oid(userId);
  if (!id) return [];
  const fromCollection = await loadOverridesFromCollection(id);
  if (fromCollection && fromCollection.length) return fromCollection;
  if (fromCollection && fromCollection.length === 0) {
    // Collection works but empty — still check legacy JSON once for migration.
    const legacy = await loadOverridesFromUserJson(id);
    if (legacy.length) {
      await replaceUserPermissionOverrides(
        id,
        // Rebuild selected as role ∪ grants − denies requires role; just persist legacy rows.
        null,
        legacy,
      ).catch(() => {});
      return legacy;
    }
    return [];
  }
  return loadOverridesFromUserJson(id);
}

export async function resolveEffectivePermissionNames(userOrId) {
  let user = userOrId;
  if (typeof userOrId === 'string' || !userOrId?.id) {
    const id = oid(userOrId?.id || userOrId);
    if (!id) return { isSuperAdmin: false, roleId: null, roleName: '', permissions: [], overrides: [] };
    user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        roleId: true,
        systemRole: { select: { id: true, roleName: true, color: true } },
      },
    });
  }
  if (!user) return { isSuperAdmin: false, roleId: null, roleName: '', permissions: [], overrides: [] };

  const isSuperAdmin = isSuperAdminUser(user);
  if (isSuperAdmin) {
    return {
      isSuperAdmin: true,
      roleId: user.roleId || user.systemRole?.id || null,
      roleName: user.systemRole?.roleName || 'Super Admin',
      permissions: ['all'],
      rolePermissions: ['all'],
      overrides: [],
    };
  }

  const roleId = oid(user.roleId || user.systemRole?.id);
  const rolePermissions = await loadRolePermissionNames(roleId);
  const overrides = await loadUserPermissionOverrides(user.id);
  const permissions = mergeRoleAndOverrides(rolePermissions, overrides);

  return {
    isSuperAdmin: false,
    roleId: roleId || null,
    roleName: user.systemRole?.roleName || '',
    permissions,
    rolePermissions,
    overrides,
  };
}

/**
 * Replace overrides. Pass selectedPermissionIds to diff vs role,
 * or rawRows to write exact GRANT/DENY list.
 */
export async function replaceUserPermissionOverrides(userId, selectedPermissionIds = [], rawRows = null) {
  const id = oid(userId);
  if (!id) throw new Error('User id is required');

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, roleId: true, systemRole: { select: { id: true } } },
  });
  if (!user) throw new Error('User not found');

  let createRows;
  if (Array.isArray(rawRows)) {
    createRows = normalizeOverrideRows(rawRows);
  } else {
    const roleId = oid(user.roleId || user.systemRole?.id);
    const rolePermRows = roleId
      ? await prisma.rolePermission.findMany({
          where: { roleId },
          select: { permissionId: true },
        })
      : [];
    const roleIds = new Set(rolePermRows.map((row) => String(row.permissionId)));
    const selected = new Set(
      (Array.isArray(selectedPermissionIds) ? selectedPermissionIds : [])
        .map((value) => oid(value))
        .filter(Boolean),
    );
    const grants = [...selected].filter((permissionId) => !roleIds.has(permissionId));
    const denies = [...roleIds].filter((permissionId) => !selected.has(permissionId));
    createRows = [
      ...grants.map((permissionId) => ({ permissionId, effect: OVERRIDE_GRANT })),
      ...denies.map((permissionId) => ({ permissionId, effect: OVERRIDE_DENY })),
    ];
  }

  let usedCollection = false;
  try {
    await prisma.userPermissionOverride.deleteMany({ where: { userId: id } });
    for (const row of createRows) {
      await prisma.userPermissionOverride.create({
        data: {
          userId: id,
          permissionId: row.permissionId,
          effect: row.effect,
        },
      });
    }
    usedCollection = true;
  } catch (error) {
    console.warn('[permissions] collection write failed, using user JSON:', error?.message || error);
  }

  await prisma.user.update({
    where: { id },
    data: {
      permissionOverrides: usedCollection ? [] : createRows,
    },
  });

  return loadUserPermissionOverrides(id);
}

export async function clearUserPermissionOverrides(userId) {
  const id = oid(userId);
  if (!id) return { deleted: 0 };
  try {
    await prisma.userPermissionOverride.deleteMany({ where: { userId: id } });
  } catch {
    /* collection may be missing */
  }
  try {
    await prisma.user.update({
      where: { id },
      data: { permissionOverrides: [] },
    });
    return { deleted: 1 };
  } catch {
    return { deleted: 0 };
  }
}

export async function getMemberPermissionDetail(userId) {
  const id = oid(userId);
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      roleId: true,
      role: true,
      systemRole: { select: { id: true, roleName: true, color: true } },
    },
  });
  if (!user) throw new Error('User not found');

  const resolved = await resolveEffectivePermissionNames(user);
  const roleId = resolved.roleId;
  const rolePermRows = roleId
    ? await prisma.rolePermission.findMany({
        where: { roleId },
        select: {
          permissionId: true,
          permission: { select: { id: true, permissionName: true, module: true } },
        },
      })
    : [];

  const allPerms = await prisma.permission.findMany({
    select: { id: true, permissionName: true, module: true },
  });
  const idByName = new Map(allPerms.map((p) => [p.permissionName, String(p.id)]));

  const rolePermissionIds = rolePermRows.map((row) => String(row.permissionId));
  const effectivePermissionIds = resolved.permissions
    .map((name) => idByName.get(name))
    .filter(Boolean);

  return {
    userId: id,
    roleId,
    roleName: resolved.roleName,
    isSuperAdmin: resolved.isSuperAdmin,
    rolePermissionIds,
    rolePermissionNames: resolved.rolePermissions,
    overrideCount: resolved.overrides.length,
    overrides: resolved.overrides,
    effectivePermissionIds,
    effectivePermissionNames: resolved.permissions,
  };
}
