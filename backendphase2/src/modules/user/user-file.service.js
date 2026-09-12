/**
 * User file service – handles avatar/profile picture uploads.
 * Stores the avatar URL directly on the User model.
 */
import { prisma } from '../../config/prisma.js';

export const userFileService = {
  /**
   * Get user avatar info (returns as a file-like object for consistency)
   * @param {string} userId - ID of the user
   */
  async getAll(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatar: true, name: true },
    });

    if (!user || !user.avatar) {
      return [];
    }

    // Return as array of file-like objects for consistency with other entity services
    return [{
      id: `avatar-${userId}`,
      fileName: 'avatar',
      fileUrl: user.avatar,
      fileType: 'Avatar',
      entityType: 'user',
      entityId: userId,
      uploadedById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }];
  },

  /**
   * Create/update user avatar.
   * Updates the user's avatar field with the file URL.
   * @param {string} userId - ID of the user
   * @param {object} fileData - { fileName, fileUrl, fileType }
   * @param {string} uploadedById - ID of user performing the upload
   */
  async create(userId, fileData, uploadedById) {
    const fileType = String(fileData.fileType || 'Avatar').trim() || 'Avatar';
    // Only Avatar updates the profile picture. Other types (e.g. email signature logo)
    // return the uploaded URL without touching user.avatar.
    if (fileType.toLowerCase() === 'avatar') {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          avatar: fileData.fileUrl,
        },
        select: {
          id: true,
          avatar: true,
        },
      });

      return {
        id: `avatar-${userId}`,
        fileName: fileData.fileName || 'avatar',
        fileUrl: updatedUser.avatar,
        fileType: 'Avatar',
        entityType: 'user',
        entityId: userId,
        uploadedById: uploadedById || userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return {
      id: `user-file-${userId}-${Date.now()}`,
      fileName: fileData.fileName || 'file',
      fileUrl: fileData.fileUrl,
      fileType,
      entityType: 'user',
      entityId: userId,
      uploadedById: uploadedById || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Delete user avatar (clear the avatar field)
   * @param {string} userId - ID of the user
   */
  async delete(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        avatar: null,
      },
    });

    return { message: 'Avatar deleted successfully' };
  },
};
