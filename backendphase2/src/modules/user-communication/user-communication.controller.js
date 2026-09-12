import { ZodError } from 'zod';
import { sendResponse, sendError } from '../../utils/response.js';
import { getActiveTenantDbName } from '../../config/prisma.js';
import {
  getCompositeResponse,
  putComposite,
  patchPreferences,
  resetPreferences,
  upsertJobBoard,
  deleteJobBoard,
  connectionsOnlyPayload,
} from './user-communication.service.js';
import { storeEmailSignatureLogoFile } from './email-signature-logo.service.js';

export const userCommunicationController = {
  async get(req, res) {
    try {
      const data = await getCompositeResponse(req.user.id);
      sendResponse(res, 200, 'Communication settings loaded', data);
    } catch (e) {
      sendError(res, 500, e.message, e);
    }
  },

  async put(req, res) {
    try {
      const data = await putComposite(req.user.id, req.body, req.user.email);
      sendResponse(res, 200, 'Communication settings saved', data);
    } catch (e) {
      if (e.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues: e.errors,
        });
      }
      sendError(res, 400, e.message, e);
    }
  },

  async patch(req, res) {
    try {
      const data = await patchPreferences(req.user.id, req.body, req.user.email);
      sendResponse(res, 200, 'Updated', data);
    } catch (e) {
      if (e.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues: e.errors,
        });
      }
      sendError(res, 400, e.message, e);
    }
  },

  async reset(req, res) {
    try {
      const data = await resetPreferences(req.user.id, req.user.email);
      sendResponse(res, 200, 'Reset to defaults', data);
    } catch (e) {
      sendError(res, 500, e.message, e);
    }
  },

  async getConnections(req, res) {
    try {
      const full = await getCompositeResponse(req.user.id);
      sendResponse(res, 200, 'Connections', connectionsOnlyPayload(full));
    } catch (e) {
      sendError(res, 500, e.message, e);
    }
  },

  async patchJobBoard(req, res) {
    try {
      const out = await upsertJobBoard(req.user.id, req.body);
      sendResponse(res, 200, 'Job board updated', out);
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues: e.issues,
        });
      }
      sendError(res, 400, e.message, e);
    }
  },

  async deleteJobBoard(req, res) {
    try {
      const platform = req.body?.platform;
      const out = await deleteJobBoard(req.user.id, platform);
      sendResponse(res, 200, 'Job board cleared', out);
    } catch (e) {
      sendError(res, 400, e.message, e);
    }
  },

  async uploadSignatureLogo(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }
      const tenantDbName =
        getActiveTenantDbName() || req.user?.tenantDbName || req.headers['x-tenant-db-name'];
      const uploaded = await storeEmailSignatureLogoFile(req.file, {
        tenantDbName,
        userId: req.user.id,
      });
      const data = await patchPreferences(
        req.user.id,
        { emailComposeSignatureLogoUrl: uploaded.fileUrl },
        req.user.email,
      );
      sendResponse(res, 201, 'Signature logo uploaded', {
        fileUrl: uploaded.fileUrl,
        settings: data.settings,
      });
    } catch (e) {
      const status = e?.code === 'VALIDATION' ? 400 : 500;
      sendError(res, status, e.message, e);
    }
  },
};
