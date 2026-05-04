import { prisma } from '../../config/prisma.js';
import { DEFAULT_PERMISSIONS, DEFAULT_PERMISSION_NAMES } from './default-permissions.js';

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
    where: { permissionName: { in: DEFAULT_PERMISSION_NAMES } },
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
