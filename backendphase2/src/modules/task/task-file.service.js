import { prisma } from '../../config/prisma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const taskFileService = {
  async getAll(taskId) {
    return prisma.taskFile.findMany({
      where: { taskId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(fileId) {
    return prisma.taskFile.findUnique({
      where: { id: fileId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(taskId, fileData, uploadedById) {
    return prisma.taskFile.create({
      data: {
        taskId,
        fileName: fileData.fileName,
        fileType: fileData.fileType || this.getFileType(fileData.fileName),
        fileUrl: fileData.fileUrl,
        fileSize: fileData.fileSize || null,
        uploadedById,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async createMultiple(taskId, filesData, uploadedById) {
    const files = filesData.map(fileData => ({
      taskId,
      fileName: fileData.fileName,
      fileType: fileData.fileType || this.getFileType(fileData.fileName),
      fileUrl: fileData.fileUrl,
      fileSize: fileData.fileSize || null,
      uploadedById,
    }));

    return prisma.taskFile.createMany({
      data: files,
    });
  },

  async delete(fileId) {
    const file = await prisma.taskFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Delete physical file if it exists
    if (file.fileUrl && !file.fileUrl.startsWith('http://') && !file.fileUrl.startsWith('https://')) {
      const filePath = path.join(__dirname, '..', '..', '..', file.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.taskFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },

  getFileType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const docExts = ['.doc', '.docx', '.txt', '.rtf'];
    const pdfExts = ['.pdf'];
    const excelExts = ['.xls', '.xlsx', '.csv'];

    if (imageExts.includes(ext)) return 'Image';
    if (pdfExts.includes(ext)) return 'PDF';
    if (docExts.includes(ext)) return 'Document';
    if (excelExts.includes(ext)) return 'Spreadsheet';
    return 'Other';
  },
};
