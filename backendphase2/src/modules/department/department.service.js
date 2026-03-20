import { prisma } from '../../config/prisma.js';

export const departmentService = {
  async getAll() {
    return prisma.department.findMany({
      orderBy: { name: 'asc' },
    });
  },

  async create(data) {
    const { name, description } = data;

    if (!name) {
      throw new Error('Department name is required');
    }

    return prisma.department.create({
      data: {
        name,
        description,
      },
    });
  },
};
