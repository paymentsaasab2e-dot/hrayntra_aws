import { prisma } from '../../config/prisma.js';
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_PERMISSION_NAMES,
  DEFAULT_ROLE_PERMISSION_PRESETS,
  DEFAULT_SYSTEM_ROLES,
} from './default-permissions.js';

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export async function syncDefaultPermissions() {
  const desiredNames = unique(DEFAULT_PERMISSION_NAMES);
  const desiredNameSet = new Set(desiredNames);

  for (const permission of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { permissionName: permission.permissionName },
      update: {
        module: permission.module,
        description: permission.description || null,
      },
      create: {
        permissionName: permission.permissionName,
        module: permission.module,
        description: permission.description || null,
      },
    });
  }

  const existingPermissions = await prisma.permission.findMany({
    select: { id: true, permissionName: true },
  });
  const stalePermissionIds = existingPermissions
    .filter((permission) => !desiredNameSet.has(permission.permissionName))
    .map((permission) => permission.id);

  if (stalePermissionIds.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: stalePermissionIds } },
    });
    await prisma.permission.deleteMany({
      where: { id: { in: stalePermissionIds } },
    });
  }
}

export async function ensureSuperAdminHasAllPermissions() {
  const superAdminRole = await prisma.systemRole.findUnique({
    where: { roleName: 'Super Admin' },
    select: { id: true },
  });
  if (!superAdminRole?.id) return;

  const permissions = await prisma.permission.findMany({
    select: { id: true },
  });
  if (!permissions.length) return;

  const existing = await prisma.rolePermission.findMany({
    where: {
      roleId: superAdminRole.id,
      permissionId: { in: permissions.map((permission) => permission.id) },
    },
    select: { permissionId: true },
  });
  const existingIds = new Set(existing.map((row) => row.permissionId));
  const missing = permissions
    .map((permission) => permission.id)
    .filter((permissionId) => !existingIds.has(permissionId));

  if (!missing.length) return;

  await prisma.rolePermission.createMany({
    data: missing.map((permissionId) => ({
      roleId: superAdminRole.id,
      permissionId,
    })),
  });
}

async function resolvePermissionIdsByNames(names = []) {
  const uniqueNames = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  if (!uniqueNames.length) return [];
  const rows = await prisma.permission.findMany({
    where: { permissionName: { in: uniqueNames } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Apply preset permissions to default system roles (does not touch Super Admin). */
export async function syncDefaultRolePresets() {
  for (const roleDef of DEFAULT_SYSTEM_ROLES) {
    if (roleDef.roleName === 'Super Admin') continue;

    const preset = DEFAULT_ROLE_PERMISSION_PRESETS[roleDef.roleName];
    if (!preset?.length) continue;

    const role = await prisma.systemRole.findUnique({
      where: { roleName: roleDef.roleName },
      select: { id: true },
    });
    if (!role?.id) continue;

    const existingCount = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existingCount > 0) continue;

    const permissionIds = await resolvePermissionIdsByNames(preset);
    if (!permissionIds.length) continue;

    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
    });
  }
}
