import { filesService } from './files.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { uploadBufferToCloudinary, cloudinaryResourceTypeForFile } from '../../utils/cloudinary.js';

export const filesController = {
  /**
   * GET /api/v1/files?entityType=job&entityId=xxx
   */
  async getByEntity(req, res) {
    try {
      const { entityType, entityId } = req.query;
      const files = await filesService.getByEntity(entityType, entityId);
      sendResponse(res, 200, 'Files retrieved successfully', files);
    } catch (error) {
      sendError(res, error.message.includes('required') || error.message.includes('Unsupported') ? 400 : 500, error.message, error);
    }
  },

  /**
   * POST /api/v1/files
   * Body (multipart): file, entityType, entityId, fileType
   */
   async create(req, res) {
    try {
      const { runWithTenantContext, getActiveTenantDbName } = await import('../../config/prisma.js');
      let tenantDbName = getActiveTenantDbName() || req.user?.tenantDbName;
      console.log('[filesController.create] Start. Tenant:', tenantDbName || '(none)', 'User:', req.user?.id);

      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }
      const { entityType, entityId, fileType } = req.body;
      const defaultTypes = { job: 'JD', lead: 'Other', client: 'Contract', candidate: 'Other', interview: 'Other', user: 'Avatar' };
      const type = (fileType || defaultTypes[entityType] || 'Other').trim();

      if (!entityType || !entityId) {
        return sendError(res, 400, 'entityType and entityId are required');
      }

      if (!['job', 'lead', 'client', 'candidate', 'interview', 'user'].includes(entityType)) {
        return sendError(res, 400, 'Only entityType=job, lead, client, candidate, interview, or user is supported for upload');
      }

      const subDir =
        entityType === 'lead'
          ? 'leads'
          : entityType === 'client'
            ? 'clients'
            : entityType === 'candidate'
              ? 'candidates'
              : entityType === 'interview'
                ? 'interviews'
                : entityType === 'user'
                  ? 'users'
                  : 'jobs';
      const resourceType = cloudinaryResourceTypeForFile(req.file.mimetype, req.file.originalname);
      const upload = await uploadBufferToCloudinary(req.file.buffer, {
        folder: `jobportal/${subDir}/${entityId}`,
        resourceType,
        originalFilename: req.file.originalname,
      });

      const fileUrl = upload?.secure_url || upload?.url;
      const fileData = {
        fileName: req.file.originalname,
        fileUrl,
        fileType: type,
      };

      // For user avatar, always use current user's ID
      const targetEntityId = entityType === 'user' ? req.user.id : entityId;

      const file = await runWithTenantContext(tenantDbName, () => 
        filesService.create(entityType, targetEntityId, fileData, req.user.id)
      );
      sendResponse(res, 201, 'File uploaded successfully', file);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  /**
   * DELETE /api/v1/files/:fileId?entityType=job&entityId=xxx
   */
  async delete(req, res) {
    try {
      const { fileId } = req.params;
      const { entityType } = req.query;
      const result = await filesService.delete(entityType || 'job', fileId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, error.message.includes('required') ? 400 : 500, error.message, error);
    }
  },
};
