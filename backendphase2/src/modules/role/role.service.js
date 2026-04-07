import { prisma } from '../../config/prisma.js';

export const roleService = {
  async getAll() {
    if (!prisma) {
      console.error('Prisma client is not initialized. Please check:');
      console.error('1. DATABASE_URL is set in .env file');
      console.error('2. Prisma client has been generated (run: npx prisma generate)');
      console.error('3. Database connection is available');
      throw new Error('Database connection not initialized. Please check server logs for details.');
    }

    try {
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
