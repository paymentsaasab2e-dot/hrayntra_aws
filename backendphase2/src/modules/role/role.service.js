import { prisma } from '../../config/prisma.js';

export const roleService = {
  async getAll() {
    const roles = await prisma.systemRole.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { roleName: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      roleName: role.roleName,
      description: role.description,
      permissions: role.rolePermissions.map((rp) => rp.permission),
      createdAt: role.createdAt,
    }));
  },
};
