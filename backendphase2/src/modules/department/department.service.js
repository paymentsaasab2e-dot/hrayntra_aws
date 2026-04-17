import { prisma } from '../../config/prisma.js';

export const departmentService = {
  async getAll() {
    if (!prisma) {
      console.error('Prisma client is not initialized. Please check:');
      console.error('1. DATABASE_URL is set in .env file');
      console.error('2. Prisma client has been generated (run: npx prisma generate)');
      console.error('3. Database connection is available');
      throw new Error('Database connection not initialized. Please check server logs for details.');
    }

    try {
      return await prisma.department.findMany({
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      console.error('Error fetching departments:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
      });
      throw new Error(`Failed to fetch departments: ${error.message}`);
    }
  },

  async create(data) {
    if (!prisma) {
      throw new Error('Database connection not initialized');
    }

    const { name, description } = data;

    if (!name) {
      throw new Error('Department name is required');
    }

    try {
      return await prisma.department.create({
        data: {
          name,
          description,
        },
      });
    } catch (error) {
      console.error('Error creating department:', error);
      throw new Error(`Failed to create department: ${error.message}`);
    }
  },
};
