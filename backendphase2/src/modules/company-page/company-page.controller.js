import { sendError, sendResponse } from '../../utils/response.js';
import * as companyPageService from './company-page.service.js';
import {
  storeCompanyLogoFile,
  storeCompanyPostMediaFile,
} from './company-page-logo.service.js';
import * as store from './company-page.store.js';

function handleError(res, error, fallback) {
  if (error?.code === 'VALIDATION') return sendError(res, 400, error.message);
  if (error?.code === 'NOT_FOUND') return sendError(res, 404, error.message);
  console.error(fallback, error);
  return sendError(res, 500, error?.message || fallback);
}

function resolveTenantDbName(req) {
  return (
    req.headers['x-tenant-db-name'] ||
    req.user?.tenantDbName ||
    req.query?.tenantDbName ||
    null
  );
}

export const companyPageController = {
  async get(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      const data = await companyPageService.getTenantCompanyPage({
        tenantDbName,
        user: req.user,
      });
      return sendResponse(res, 200, 'OK', data);
    } catch (error) {
      return handleError(res, error, '[companyPage.get]');
    }
  },

  async upsert(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      const data = await companyPageService.upsertTenantCompanyPage({
        tenantDbName,
        user: req.user,
        payload: req.body || {},
      });
      return sendResponse(res, 200, 'Company page saved', data);
    } catch (error) {
      return handleError(res, error, '[companyPage.upsert]');
    }
  },

  async uploadLogo(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      if (!tenantDbName) {
        return sendError(res, 400, 'Tenant is required');
      }
      if (!req.file) {
        return sendError(res, 400, 'No logo file uploaded');
      }

      const uploaded = await storeCompanyLogoFile(req.file, { tenantDbName });
      const existing = await store.getCompanyPageByTenant(tenantDbName);
      let page = existing || null;

      if (existing) {
        page = await store.upsertCompanyPageRecord({
          ...existing,
          logoUrl: uploaded.logoUrl,
          updatedAt: new Date().toISOString(),
        });
        try {
          await companyPageService.resyncTenantCompanyPage({ tenantDbName });
        } catch {
          /* ignore sync errors on upload */
        }
      }

      return sendResponse(res, 201, 'Logo uploaded', {
        logoUrl: uploaded.logoUrl,
        name: uploaded.name,
        size: uploaded.size,
        page,
      });
    } catch (error) {
      return handleError(res, error, '[companyPage.uploadLogo]');
    }
  },

  async uploadPostMedia(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      if (!tenantDbName) {
        return sendError(res, 400, 'Tenant is required');
      }
      if (!req.file) {
        return sendError(res, 400, 'No photo uploaded');
      }

      const uploaded = await storeCompanyPostMediaFile(req.file, { tenantDbName });
      return sendResponse(res, 201, 'Photo uploaded', {
        mediaUrl: uploaded.mediaUrl,
        name: uploaded.name,
        size: uploaded.size,
      });
    } catch (error) {
      return handleError(res, error, '[companyPage.uploadPostMedia]');
    }
  },

  async createPost(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      const data = await companyPageService.createTenantCompanyPost({
        tenantDbName,
        user: req.user,
        payload: req.body || {},
      });
      return sendResponse(res, 201, 'Post published', data);
    } catch (error) {
      return handleError(res, error, '[companyPage.createPost]');
    }
  },

  async deletePost(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      const data = await companyPageService.deleteTenantCompanyPost({
        tenantDbName,
        postId: req.params.postId,
      });
      return sendResponse(res, 200, 'Post deleted', data);
    } catch (error) {
      return handleError(res, error, '[companyPage.deletePost]');
    }
  },

  async resync(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      const data = await companyPageService.resyncTenantCompanyPage({ tenantDbName });
      return sendResponse(res, 200, 'Synced to Phase 1', data);
    } catch (error) {
      return handleError(res, error, '[companyPage.resync]');
    }
  },
};
