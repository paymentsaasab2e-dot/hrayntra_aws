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
  listOrgDataTransfers,
  revertOrgDataTransfer,
  listOrgDuplicates,
  removeOrgDuplicates,
  resolveViewerOrgScope,
} from './org.service.js';
import { listAssignableCompanies } from '../../services/orgListScope.service.js';
import {
  filterCompaniesWithEligibleAssignees,
  resolveAssignmentModulesFromReq,
} from '../../services/assigneeModuleAccess.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const orgController = {
  async workspace(req, res) {
    try {
      const data = await resolveViewerOrgScope(req);
      res.setHeader('Cache-Control', 'private, no-store');
      sendResponse(res, 200, 'OK', data);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async assignCompanies(req, res) {
    try {
      const companies = await listAssignableCompanies(req);
      const modules = resolveAssignmentModulesFromReq(req);
      const visible = await filterCompaniesWithEligibleAssignees(companies, { modules });
      sendResponse(res, 200, 'OK', { companies: visible });
    } catch (error) {
      sendError(res, error?.statusCode === 403 ? 403 : 400, error.message, error);
    }
  },

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
        toOrgUnitId:
          req.query.toOrgUnitId !== undefined ? req.query.toOrgUnitId : req.query.destOrgUnitId,
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

  async transferHistory(req, res) {
    try {
      const data = await listOrgDataTransfers(req, { limit: req.query.limit });
      sendResponse(res, 200, 'OK', data);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async revertTransfer(req, res) {
    try {
      const result = await revertOrgDataTransfer(req, req.params.id);
      sendResponse(res, 200, 'Transfer reverted', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async duplicates(req, res) {
    try {
      const data = await listOrgDuplicates(req, { type: req.query.type || 'jobs' });
      sendResponse(res, 200, 'OK', data);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async removeDuplicates(req, res) {
    try {
      const result = await removeOrgDuplicates(req, req.body || {});
      sendResponse(res, 200, 'Duplicates removed', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
