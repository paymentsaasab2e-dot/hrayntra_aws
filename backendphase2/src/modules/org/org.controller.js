import {
  listOrgStructure,
  createOrgUnit,
  updateOrgUnit,
  deleteOrgUnit,
  assignOrgMember,
  adoptWorkspaceIntoUnit,
  stampUntaggedRecordsForUnit,
  getOrgTreeStats,
  listTransferableData,
  transferOrgUnitData,
} from './org.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const orgController = {
  async list(req, res) {
    try {
      const data = await listOrgStructure(req);
      sendResponse(res, 200, 'OK', data);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async tree(req, res) {
    try {
      const data = await getOrgTreeStats(req);
      sendResponse(res, 200, 'OK', data);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const unit = await createOrgUnit(req, req.body || {});
      sendResponse(res, 201, 'Created', unit);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const unit = await updateOrgUnit(req, req.params.id, req.body || {});
      sendResponse(res, 200, 'Updated', unit);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async remove(req, res) {
    try {
      const result = await deleteOrgUnit(req, req.params.id);
      sendResponse(res, 200, 'Deleted', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async assign(req, res) {
    try {
      const member = await assignOrgMember(req, req.body || {});
      sendResponse(res, 200, 'Assigned', member);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async adopt(req, res) {
    try {
      const result = await adoptWorkspaceIntoUnit(req, req.params.id, req.body || {});
      sendResponse(res, 200, 'Moved tenant workspace', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async adoptByBody(req, res) {
    try {
      const id = String(req.body?.orgUnitId || req.body?.id || '').trim();
      if (!id) return sendError(res, 400, 'orgUnitId is required');
      const result = await adoptWorkspaceIntoUnit(req, id, req.body || {});
      sendResponse(res, 200, 'Moved tenant workspace', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async stampUntagged(req, res) {
    try {
      const result = await stampUntaggedRecordsForUnit(req, req.params.id, req.body || {});
      sendResponse(res, 200, 'Assigned existing users and data to company', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async stampUntaggedByBody(req, res) {
    try {
      const id = String(req.body?.orgUnitId || req.body?.id || '').trim();
      if (!id) return sendError(res, 400, 'orgUnitId is required');
      const result = await stampUntaggedRecordsForUnit(req, id, req.body || {});
      sendResponse(res, 200, 'Assigned existing users and data to company', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async transferableData(req, res) {
    try {
      const data = await listTransferableData(req, {
        orgUnitId: req.query.orgUnitId || req.query.fromOrgUnitId || '',
        type: req.query.type,
        search: req.query.search || '',
        limit: req.query.limit,
      });
      sendResponse(res, 200, 'OK', data);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async transferData(req, res) {
    try {
      const result = await transferOrgUnitData(req, req.body || {});
      sendResponse(
        res,
        200,
        result.mode === 'move' ? 'Data moved' : 'Data duplicated',
        result,
      );
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
