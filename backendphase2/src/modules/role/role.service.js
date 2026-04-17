import { prisma } from '../../config/prisma.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';

const DEFAULT_SUPER_ADMIN_ROLE_NAMES = [
  'Super Admin',
  'Admin',
  'Recruiter',
  'Manager',
  'Viewer',
];

export const roleService = {
  async getAll(reqUser) {
    if (!prisma) {
      console.error('Prisma client is not initialized. Please check:');
      console.error('1. DATABASE_URL is set in .env file');
      console.error('2. Prisma client has been generated (run: npx prisma generate)');
      console.error('3. Database connection is available');
      throw new Error('Database connection not initialized. Please check server logs for details.');
    }

    try {
      const where = isSuperAdminUser(reqUser)
        ? { roleName: { in: DEFAULT_SUPER_ADMIN_ROLE_NAMES } }
        : {};

      const roles = await prisma.systemRole.findMany({
        where,
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
        permissions: role.rolePermissions
          .filter((rp) => rp.permission)
          .map((rp) => rp.permission),
        createdAt: role.createdAt,
      }));
    } catch (error) {
      console.error('Error fetching roles:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
      });
      throw new Error(`Failed to fetch roles: ${error.message}`);
    }
  },
};
