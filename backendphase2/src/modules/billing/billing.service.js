import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';

export const billingService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { clientId, status, dueDate } = req.query;

    const where = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (dueDate) {
      const date = new Date(dueDate);
      where.dueDate = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lte: new Date(date.setHours(23, 59, 59, 999)),
      };
    }

    const [records, total] = await Promise.all([
      prisma.billingRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: {
            select: { id: true, companyName: true },
          },
          placement: {
            select: { id: true, candidate: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.billingRecord.count({ where }),
    ]);

    return formatPaginationResponse(records, page, limit, total);
  },

  async getById(id) {
    return prisma.billingRecord.findUnique({
      where: { id },
      include: {
        client: true,
        placement: {
          include: {
            candidate: true,
            job: true,
          },
        },
      },
    });
  },

  async create(data) {
    return prisma.billingRecord.create({
      data: {
        clientId: data.clientId,
        placementId: data.placementId,
        amount: data.amount,
        currency: data.currency || 'USD',
        status: data.status || 'DRAFT',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        invoiceUrl: data.invoiceUrl,
        notes: data.notes,
      },
    });
  },

  async update(id, data) {
    return prisma.billingRecord.update({
      where: { id },
      data: {
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        paidAt: data.status === 'PAID' && !data.paidAt ? new Date() : data.paidAt ? new Date(data.paidAt) : undefined,
        invoiceUrl: data.invoiceUrl,
        notes: data.notes,
      },
    });
  },

  async delete(id) {
    await prisma.billingRecord.delete({ where: { id } });
    return { message: 'Billing record deleted successfully' };
  },
};
