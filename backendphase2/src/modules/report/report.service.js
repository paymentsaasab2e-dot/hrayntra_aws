import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';

export const reportService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { type, generatedById } = req.query;

    const where = {};
    if (type) where.type = type;
    if (generatedById) where.generatedById = generatedById;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        include: {
          generatedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.report.count({ where }),
    ]);

    return formatPaginationResponse(reports, page, limit, total);
  },

  async getById(id) {
    return prisma.report.findUnique({
      where: { id },
      include: {
        generatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(data) {
    return prisma.report.create({
      data: {
        name: data.name,
        type: data.type,
        filters: data.filters,
        generatedById: data.generatedById,
        result: data.result,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });
  },

  async update(id, data) {
    return prisma.report.update({
      where: { id },
      data: {
        name: data.name,
        filters: data.filters,
        result: data.result,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    });
  },

  async delete(id) {
    await prisma.report.delete({ where: { id } });
    return { message: 'Report deleted successfully' };
  },
};
