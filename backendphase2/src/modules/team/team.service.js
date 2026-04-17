import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';

export const teamService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { department, search } = req.query;

    const where = {};
    if (department) where.department = { contains: department, mode: 'insensitive' };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take: limit,
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true, role: true },
              },
            },
          },
          _count: {
            select: { members: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.team.count({ where }),
    ]);

    return formatPaginationResponse(teams, page, limit, total);
  },

  async getById(id) {
    return prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                role: true,
                department: true,
              },
            },
          },
        },
      },
    });
  },

  async create(data) {
    const team = await prisma.team.create({
      data: {
        name: data.name,
        department: data.department,
      },
    });

    if (data.memberIds && data.memberIds.length > 0) {
      await Promise.all(
        data.memberIds.map((userId, index) =>
          prisma.teamMember.create({
            data: {
              userId,
              teamId: team.id,
              role: data.memberRoles?.[index] || 'MEMBER',
            },
          })
        )
      );
    }

    return prisma.team.findUnique({
      where: { id: team.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                role: true,
                department: true,
              },
            },
          },
        },
      },
    });
  },

  async update(id, data) {
    return prisma.team.update({
      where: { id },
      data: {
        name: data.name,
        department: data.department,
      },
    });
  },

  async addMember(teamId, userId, role) {
    return prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: role || 'MEMBER',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  },

  async removeMember(teamId, userId) {
    await prisma.teamMember.deleteMany({
      where: {
        teamId,
        userId,
      },
    });
    return { message: 'Member removed successfully' };
  },

  async delete(id) {
    await prisma.team.delete({ where: { id } });
    return { message: 'Team deleted successfully' };
  },
};
