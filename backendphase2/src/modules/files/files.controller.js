import { filesService } from './files.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { assertCanAccessEntityFiles } from '../../services/filesAccess.service.js';

export const filesController = {
  /**
   * GET /api/v1/files?entityType=job&entityId=xxx
   */
  async getByEntity(req, res) {
    try {
      const { entityType, entityId } = req.query;
      await assertCanAccessEntityFiles(req, entityType, entityId);
      const files = await filesService.getByEntity(entityType, entityId);
      sendResponse(res, 200, 'Files retrieved successfully', files);
    } catch (error) {
      const status = /permission|denied|not found/i.test(error.message) ? 403 : 400;
      sendError(res, status, error.message, error);
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

      await assertCanAccessEntityFiles(req, entityType, entityType === 'user' ? req.user.id : entityId, { write: true });

      const fileUrl = req.file.location || req.file.path;
      if (!fileUrl) {
        return sendError(res, 500, 'Upload did not return a file URL');
      }
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
      const { entityType, entityId } = req.query;
      if (!entityId) {
        return sendError(res, 400, 'entityId query param is required');
      }
      await assertCanAccessEntityFiles(req, entityType || 'job', entityId, { write: true });
      const result = await filesService.delete(entityType || 'job', fileId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      const status = /permission|denied|not found/i.test(error.message) ? 403 : 400;
      sendError(res, status, error.message, error);
    }
  },
};
