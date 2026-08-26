import {
  listOrgStructure,
  createOrgUnit,
  updateOrgUnit,
  deleteOrgUnit,
  assignOrgMember,
  adoptWorkspaceIntoUnit,
  getOrgTreeStats,
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
      const result = await adoptWorkspaceIntoUnit(req, req.params.id);
      sendResponse(res, 200, 'Moved tenant workspace', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
