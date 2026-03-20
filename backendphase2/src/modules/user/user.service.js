import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';

export const userService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { role, isActive, search } = req.query;

    const where = {};
    if (role) {
      // Normalize role to uppercase to match enum
      const roleUpper = role.toUpperCase();
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'MANAGER', 'VIEWER'];
      if (validRoles.includes(roleUpper)) {
        where.role = roleUpper;
      }
    }
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          avatar: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return formatPaginationResponse(users, page, limit, total);
  },

  async getById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatar: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        avatar: data.avatar,
        isActive: data.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatar: true,
        isActive: true,
      },
    });
  },

  async delete(id) {
    await prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  },
};
