import { hqService } from './hq.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const hqController = {
  async setupSuperAdmin(req, res) {
    try {
      const result = await hqService.setupSuperAdmin(req.body);
      sendResponse(res, 201, 'Super Admin setup successful', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async provisionTenant(req, res) {
    try {
      const result = await hqService.provisionTenant(req.body, req.user);
      sendResponse(res, 201, 'Tenant provisioned', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listTenants(req, res) {
    try {
      const result = await hqService.listTenants(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async assignPlan(req, res) {
    try {
      const result = await hqService.assignPlan(req.body, req.user);
      sendResponse(res, 200, 'Plan updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listLeads(req, res) {
    try {
      const result = await hqService.listLeads(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async createLead(req, res) {
    try {
      const result = await hqService.createLead(req.body, req.user);
      sendResponse(res, 201, 'Lead created', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateLead(req, res) {
    try {
      const result = await hqService.updateLead(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Lead updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addLeadFollowUp(req, res) {
    try {
      const result = await hqService.addLeadFollowUp(req.params.id, req.body, req.user);
      sendResponse(res, 201, 'Follow-up scheduled', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addLeadRemark(req, res) {
    try {
      const result = await hqService.addLeadRemark(req.params.id, req.body, req.user);
      sendResponse(res, 201, 'Remark added', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async convertLeadToCompany(req, res) {
    try {
      const result = await hqService.convertLeadToCompany(req.params.id, req.user);
      sendResponse(res, 201, 'Lead converted to company', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listCompanies(req, res) {
    try {
      const result = await hqService.listCompanies(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async createCompany(req, res) {
    try {
      const result = await hqService.createCompany(req.body, req.user);
      sendResponse(res, 201, 'Company created', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateCompany(req, res) {
    try {
      const result = await hqService.updateCompany(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Company updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addCompanyFollowUp(req, res) {
    try {
      const result = await hqService.addCompanyFollowUp(req.params.id, req.body, req.user);
      sendResponse(res, 201, 'Follow-up scheduled', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addCompanyRemark(req, res) {
    try {
      const result = await hqService.addCompanyRemark(req.params.id, req.body, req.user);
      sendResponse(res, 201, 'Remark added', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteTenant(req, res) {
    try {
      // Accept email via body, URL params, or query — the HQ UI uses the
      // body, but we make the endpoint forgiving in case some HTTP libs
      // strip DELETE bodies (Express does keep them by default, but axios
      // older versions and some proxies do not).
      const email =
        req.body?.email || req.params?.email || req.query?.email || null;
      const dropDatabase =
        typeof req.body?.dropDatabase === 'boolean'
          ? req.body.dropDatabase
          : req.query?.dropDatabase === 'false'
            ? false
            : true;
      console.log('[hq] deleteTenant request', {
        email,
        dropDatabase,
        userEmail: req.user?.email,
        userRole: req.user?.role,
      });
      const result = await hqService.deleteTenant({ email, dropDatabase }, req.user);
      sendResponse(res, 200, 'Tenant deleted', result);
    } catch (error) {
      console.error('[hq] deleteTenant failed:', error?.message || error);
      sendError(res, 400, error.message, error);
    }
  },
};
