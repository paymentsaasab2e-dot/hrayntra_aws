import { sendError, sendResponse } from '../../utils/response.js';
import * as tenantBehaviorService from './tenant-behavior.service.js';

function handleError(res, error, fallback) {
  if (error?.code === 'VALIDATION') return sendError(res, 400, error.message);
  if (error?.code === 'FORBIDDEN') return sendError(res, 403, error.message);
  console.error(fallback, error);
  return sendError(res, 500, error?.message || fallback);
}

export const tenantBehaviorController = {
  async upsertSnapshot(req, res) {
    try {
      const result = await tenantBehaviorService.upsertTenantBehaviorSnapshot({
        body: req.body,
        user: req.user,
      });
      return sendResponse(res, 200, 'Behavior snapshot saved', result);
    } catch (error) {
      return handleError(res, error, '[upsertSnapshot]');
    }
  },

  async getMySnapshot(req, res) {
    try {
      const snapshot = await tenantBehaviorService.getTenantBehaviorSnapshot(req.user?.id);
      return sendResponse(res, 200, 'OK', { payload: snapshot?.payload || null });
    } catch (error) {
      return handleError(res, error, '[getMySnapshot]');
    }
  },

  async getTenantAggregate(req, res) {
    try {
      const aggregate = await tenantBehaviorService.buildTenantBehaviorAggregate();
      return sendResponse(res, 200, 'OK', aggregate);
    } catch (error) {
      return handleError(res, error, '[getTenantAggregate]');
    }
  },

  async getLiveDashboard(req, res) {
    try {
      const dashboard = await tenantBehaviorService.buildTenantLiveDashboard();
      return sendResponse(res, 200, 'OK', dashboard);
    } catch (error) {
      return handleError(res, error, '[getLiveDashboard]');
    }
  },

  async getSnapshotByUser(req, res) {
    try {
      const userId = String(req.query?.userId || req.params?.userId || '').trim();
      if (!userId) return sendError(res, 400, 'userId is required');
      const snapshot = await tenantBehaviorService.getTenantBehaviorSnapshot(userId);
      if (!snapshot) return sendResponse(res, 200, 'OK', { payload: null });
      return sendResponse(res, 200, 'OK', { payload: snapshot.payload });
    } catch (error) {
      return handleError(res, error, '[getSnapshotByUser]');
    }
  },

  async listSnapshots(req, res) {
    try {
      const limit = req.query?.limit;
      const snapshots = await tenantBehaviorService.listTenantBehaviorSnapshots({ limit });
      return sendResponse(res, 200, 'OK', { snapshots, count: snapshots.length });
    } catch (error) {
      return handleError(res, error, '[listSnapshots]');
    }
  },

  async getCrmContext(req, res) {
    try {
      const context = await tenantBehaviorService.getTenantCrmContext();
      return sendResponse(res, 200, 'OK', context);
    } catch (error) {
      return handleError(res, error, '[getCrmContext]');
    }
  },

  async getAllBehavior(req, res) {
    try {
      const data = await tenantBehaviorService.buildAllTenantBehaviorData();
      return sendResponse(res, 200, 'OK', data);
    } catch (error) {
      return handleError(res, error, '[getAllBehavior]');
    }
  },

  async getBehaviorEngine(req, res) {
    try {
      const { buildEmployerBehaviorEngineReport } = await import('./tenant-behavior-engine.service.js');
      const rangeRaw = String(req.query?.range || 'week').trim().toLowerCase();
      const range = ['today', 'week', 'month', 'year'].includes(rangeRaw) ? rangeRaw : 'week';
      const userId = String(req.query?.userId || '').trim() || undefined;
      const data = await buildEmployerBehaviorEngineReport({ range, userId });
      return sendResponse(res, 200, 'OK', data);
    } catch (error) {
      return handleError(res, error, '[getBehaviorEngine]');
    }
  },
};
