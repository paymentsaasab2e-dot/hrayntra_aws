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

  async createTenantImpersonationAccess(req, res) {
    try {
      const result = await hqService.createTenantImpersonationAccess(req.body, req.user);
      sendResponse(res, 200, 'Tenant access link created', result);
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

  async setTenantCoins(req, res) {
    try {
      const result = await hqService.setTenantCoins(req.body, req.user);
      sendResponse(res, 200, 'Coins updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listAiFeatures(req, res) {
    try {
      const result = await hqService.listAiFeatures(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateAiFeatures(req, res) {
    try {
      const result = await hqService.updateAiFeatures(req.body, req.user);
      sendResponse(res, 200, 'AI feature costs updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listAiCoinPacks(req, res) {
    try {
      const result = await hqService.listAiCoinPacks(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async saveAiCoinPacks(req, res) {
    try {
      const result = await hqService.saveAiCoinPacks(req.body, req.user);
      sendResponse(res, 200, 'AI coin packs saved', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getPhase1TokenConfig(req, res) {
    try {
      const result = await hqService.getPhase1TokenConfig(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async savePhase1TokenPacks(req, res) {
    try {
      const result = await hqService.savePhase1TokenPacks(req.body, req.user);
      sendResponse(res, 200, 'Phase 1 coin packs saved', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async savePhase1TokenCosts(req, res) {
    try {
      const result = await hqService.savePhase1TokenCosts(req.body, req.user);
      sendResponse(res, 200, 'Phase 1 spend costs saved', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async savePhase1TokenEarns(req, res) {
    try {
      const result = await hqService.savePhase1TokenEarns(req.body, req.user);
      sendResponse(res, 200, 'Phase 1 free earn rewards saved', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async setTenantPause(req, res) {
    try {
      const result = await hqService.setTenantPause(req.body, req.user);
      sendResponse(res, 200, result.status === 'PAUSED' ? 'Tenant paused' : 'Tenant resumed', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateTenantModules(req, res) {
    try {
      const result = await hqService.updateTenantModules(req.body, req.user);
      sendResponse(res, 200, 'Tenant modules updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateTenantOrganizationName(req, res) {
    try {
      const result = await hqService.updateTenantOrganizationName(req.body, req.user);
      sendResponse(res, 200, 'Company name updated', result);
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

  async deleteLead(req, res) {
    try {
      const result = await hqService.deleteLead(req.params.id, req.user);
      sendResponse(res, 200, 'Lead deleted', result);
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

  async updateLeadFollowUp(req, res) {
    try {
      const result = await hqService.updateLeadFollowUp(
        req.params.id,
        req.params.followUpId,
        req.body,
        req.user
      );
      sendResponse(res, 200, 'Follow-up updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async completeLeadFollowUp(req, res) {
    try {
      const result = await hqService.completeLeadFollowUp(
        req.params.id,
        req.params.followUpId,
        req.user,
        req.body
      );
      sendResponse(res, 200, 'Follow-up completed', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteLeadFollowUp(req, res) {
    try {
      const result = await hqService.deleteLeadFollowUp(
        req.params.id,
        req.params.followUpId,
        req.user
      );
      sendResponse(res, 200, 'Follow-up deleted', result);
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

  async listDemoRequests(req, res) {
    try {
      const result = await hqService.listDemoRequests(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteDemoRequest(req, res) {
    try {
      const result = await hqService.deleteDemoRequest(req.params.id, req.user);
      sendResponse(res, 200, 'Demo request deleted', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async grantDemoTrial(req, res) {
    try {
      const result = await hqService.grantDemoTrial(req.params.id, req.body || {}, req.user);
      sendResponse(res, 200, 'Try-free access granted', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async grantLeadTrial(req, res) {
    try {
      const result = await hqService.grantLeadTrial(req.params.id, req.body || {}, req.user);
      sendResponse(res, 200, 'Try-free access granted', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async listSupportTickets(req, res) {
    try {
      const result = await hqService.listSupportTickets(req.user, {
        status: req.query?.status,
        priority: req.query?.priority,
        tenantDbName: req.query?.tenantDbName,
      });
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateSupportTicket(req, res) {
    try {
      const result = await hqService.updateSupportTicket(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Ticket updated', { ticket: result });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listSupportTicketMessages(req, res) {
    try {
      const result = await hqService.listSupportTicketMessages(req.params.id, req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addSupportTicketMessage(req, res) {
    try {
      const body = req.body?.body;
      const message = await hqService.addSupportTicketMessage(req.params.id, body, req.user);
      sendResponse(res, 201, 'Message sent', { message });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listHelpTickets(req, res) {
    try {
      const result = await hqService.listHelpTickets(req.user, {
        status: req.query?.status,
        email: req.query?.email,
        id: req.query?.id,
        limit: req.query?.limit,
      });
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateHelpTicket(req, res) {
    try {
      const id = req.params?.id || req.body?.id;
      const status = req.body?.status;
      const ticket = await hqService.updateHelpTicket(id, status, req.user);
      sendResponse(res, 200, 'Help ticket updated', { ticket });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listHelpTicketMessages(req, res) {
    try {
      const id = req.params?.id;
      const result = await hqService.listHelpTicketMessages(id, req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addHelpTicketMessage(req, res) {
    try {
      const id = req.params?.id;
      const body = req.body?.body;
      const message = await hqService.addHelpTicketMessage(id, body, req.user);
      sendResponse(res, 200, 'Message sent', { message });
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

  async uploadCompanyLogo(req, res) {
    try {
      const result = await hqService.uploadCompanyLogo(req.params.id, req.file, req.user);
      sendResponse(res, 200, 'Company logo uploaded', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteCompany(req, res) {
    try {
      const result = await hqService.deleteCompany(req.params.id, req.user);
      sendResponse(res, 200, 'Company deleted', result);
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

  async updateCompanyFollowUp(req, res) {
    try {
      const result = await hqService.updateCompanyFollowUp(
        req.params.id,
        req.params.followUpId,
        req.body,
        req.user
      );
      sendResponse(res, 200, 'Follow-up updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async completeCompanyFollowUp(req, res) {
    try {
      const result = await hqService.completeCompanyFollowUp(
        req.params.id,
        req.params.followUpId,
        req.user
      );
      sendResponse(res, 200, 'Follow-up completed', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteCompanyFollowUp(req, res) {
    try {
      const result = await hqService.deleteCompanyFollowUp(
        req.params.id,
        req.params.followUpId,
        req.user
      );
      sendResponse(res, 200, 'Follow-up deleted', result);
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

  async listTeamMembers(req, res) {
    try {
      const result = await hqService.listTeamMembers(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getSessionAccess(req, res) {
    try {
      const result = await hqService.getSessionAccess(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 403, error.message, error);
    }
  },

  async createTeamMember(req, res) {
    try {
      const result = await hqService.createTeamMember(req.body, req.user);
      sendResponse(res, 201, 'Team member created', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateTeamMember(req, res) {
    try {
      const result = await hqService.updateTeamMember(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Team member updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteTeamMember(req, res) {
    try {
      const result = await hqService.deleteTeamMember(req.params.id, req.user);
      sendResponse(res, 200, 'Team member deleted', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listHqPermissions(req, res) {
    try {
      const result = await hqService.listHqPermissions(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listHqRoles(req, res) {
    try {
      const result = await hqService.listHqRoles(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async createHqRole(req, res) {
    try {
      const result = await hqService.createHqRole(req.body, req.user);
      sendResponse(res, 201, 'Role created', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateHqRole(req, res) {
    try {
      const result = await hqService.updateHqRole(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Role updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteHqRole(req, res) {
    try {
      const result = await hqService.deleteHqRole(req.params.id, req.user);
      sendResponse(res, 200, 'Role deleted', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getPortalOverview(req, res) {
    try {
      const result = await hqService.getPortalOverview(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listAllCandidates(req, res) {
    try {
      const result = await hqService.listAllCandidates(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listKycInterviewers(req, res) {
    try {
      const result = await hqService.listKycInterviewers(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, error?.statusCode || 400, error.message, error);
    }
  },

  async verifyKycInterviewer(req, res) {
    try {
      const result = await hqService.verifyKycInterviewer(req.user, req.params.id);
      sendResponse(res, 200, 'Interviewer verified for candidate marketplace', result);
    } catch (error) {
      sendError(res, error?.statusCode || 400, error.message, error);
    }
  },

  async rejectKycInterviewer(req, res) {
    try {
      const result = await hqService.rejectKycInterviewer(
        req.user,
        req.params.id,
        req.body?.reviewNotes || req.body?.notes,
      );
      sendResponse(res, 200, 'Interviewer application rejected', result);
    } catch (error) {
      sendError(res, error?.statusCode || 400, error.message, error);
    }
  },

  async getCandidateBehavior(req, res) {
    try {
      const result = await hqService.getCandidateBehavior(req.user, req.params.id);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      if (error?.code === 'VALIDATION') return sendError(res, 400, error.message);
      sendError(res, 400, error.message, error);
    }
  },

  async getTenantBehavior(req, res) {
    try {
      const tenantDbName = String(req.params.tenantDbName || req.query.tenantDbName || '').trim();
      if (!tenantDbName) return sendError(res, 400, 'tenantDbName is required');
      const rangeRaw = String(req.query.range || 'week').trim().toLowerCase();
      const range = ['today', 'week', 'month', 'year'].includes(rangeRaw) ? rangeRaw : 'week';

      const tenants = await hqService.listTenants(req.user);
      const tenant = (tenants?.tenants || []).find(
        (t) => String(t.tenantDbName || '').trim() === tenantDbName,
      );

      const result = await hqService.getTenantBehavior(req.user, tenantDbName, tenant || {}, range);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      if (error?.code === 'VALIDATION') return sendError(res, 400, error.message);
      sendError(res, 400, error.message, error);
    }
  },

  async getTenantBehaviorEngine(req, res) {
    try {
      const tenantDbName = String(req.params.tenantDbName || req.query.tenantDbName || '').trim();
      if (!tenantDbName) return sendError(res, 400, 'tenantDbName is required');
      const rangeRaw = String(req.query.range || 'week').trim().toLowerCase();
      const range = ['today', 'week', 'month', 'year'].includes(rangeRaw) ? rangeRaw : 'week';
      const userId = String(req.query.userId || '').trim() || undefined;

      const result = await hqService.getTenantBehaviorEngine(req.user, tenantDbName, { range, userId });
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      if (error?.code === 'VALIDATION') return sendError(res, 400, error.message);
      sendError(res, 400, error.message, error);
    }
  },

  async getBilling(req, res) {
    try {
      const result = await hqService.getBilling(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getCandidateBillingLedger(req, res) {
    try {
      const candidateId = String(req.params?.id || '').trim();
      if (!candidateId) return sendError(res, 400, 'Candidate ID is required');
      const result = await hqService.getCandidateBillingLedger(req.user, candidateId);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getEmployerBillingLedger(req, res) {
    try {
      const tenantKey = decodeURIComponent(String(req.params?.tenantKey || '').trim());
      if (!tenantKey) return sendError(res, 400, 'Tenant key is required');
      const result = await hqService.getEmployerBillingLedger(req.user, tenantKey);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getAnalytics(req, res) {
    try {
      const result = await hqService.getAnalytics(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listCustomReports(req, res) {
    try {
      const result = await hqService.listCustomReports(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async createCustomReport(req, res) {
    try {
      const result = await hqService.createCustomReport(req.body || {}, req.user);
      sendResponse(res, 201, 'Report saved', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async updateCustomReport(req, res) {
    try {
      const result = await hqService.updateCustomReport(req.params.id, req.body || {}, req.user);
      sendResponse(res, 200, 'Report updated', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async deleteCustomReport(req, res) {
    try {
      const result = await hqService.deleteCustomReport(req.params.id, req.user);
      sendResponse(res, 200, 'Report deleted', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async deletePortalJob(req, res) {
    try {
      const jobId = String(req.params?.id || '').trim();
      if (!jobId) {
        return sendError(res, 400, 'Job ID is required');
      }
      const result = await hqService.deletePortalJob(jobId, req.body || {}, req.user);
      sendResponse(res, 200, 'Job deleted from tenant and portal', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async setPortalJobClientVisibility(req, res) {
    try {
      const jobId = String(req.params?.id || '').trim();
      if (!jobId) {
        return sendError(res, 400, 'Job ID is required');
      }
      const result = await hqService.setPortalJobClientVisibility(
        jobId,
        req.body || {},
        req.user,
      );
      sendResponse(
        res,
        200,
        result.showClientNamePublicly
          ? 'Client name is now visible on Phase 1'
          : 'Client name hidden on Phase 1',
        result,
      );
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
      sendResponse(res, 200, 'Moved to recycle bin', result);
    } catch (error) {
      console.error('[hq] deleteTenant failed:', error?.message || error);
      sendError(res, 400, error.message, error);
    }
  },

  async listRecycleBin(req, res) {
    try {
      const result = await hqService.listRecycleBin(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async restoreTenant(req, res) {
    try {
      const email = req.body?.email || req.params?.email || req.query?.email || null;
      const result = await hqService.restoreTenant({ email }, req.user);
      sendResponse(res, 200, 'Tenant restored', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async purgeTenant(req, res) {
    try {
      const email = req.body?.email || req.params?.email || req.query?.email || null;
      const dropDatabase =
        typeof req.body?.dropDatabase === 'boolean'
          ? req.body.dropDatabase
          : req.query?.dropDatabase === 'false'
            ? false
            : true;
      const result = await hqService.purgeTenant({ email, dropDatabase }, req.user);
      sendResponse(res, 200, 'Tenant permanently deleted', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listPackages(req, res) {
    try {
      const result = await hqService.listPackages(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listPublicPackages(req, res) {
    try {
      const result = await hqService.listPublicPackages();
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async createPackage(req, res) {
    try {
      const result = await hqService.createPackage(req.body, req.user);
      sendResponse(res, 201, 'Package created', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updatePackage(req, res) {
    try {
      const result = await hqService.updatePackage(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Package updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deletePackage(req, res) {
    try {
      const result = await hqService.deletePackage(req.params.id, req.user);
      sendResponse(res, 200, 'Package deleted', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async listCourses(req, res) {
    try {
      const result = await hqService.listCourses(req.user);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async listCourseEnrollments(req, res) {
    try {
      const result = await hqService.listCourseEnrollments(req.params.id, req.user);
      sendResponse(res, 200, 'Course learners fetched', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async createCourse(req, res) {
    try {
      const result = await hqService.createCourse(req.body, req.user);
      sendResponse(res, 201, 'Course created', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async updateCourse(req, res) {
    try {
      const result = await hqService.updateCourse(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Course updated', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async deleteCourse(req, res) {
    try {
      const result = await hqService.deleteCourse(req.params.id, req.user);
      sendResponse(res, 200, 'Course deleted', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async deleteCourses(req, res) {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const result = await hqService.deleteCourses(ids, req.user);
      sendResponse(res, 200, 'Courses deleted', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async uploadCourseThumbnail(req, res) {
    try {
      const file = req.file;
      if (!file) {
        return sendError(res, 400, 'No image file provided');
      }
      const result = await hqService.uploadCourseThumbnail(file, req.user);
      sendResponse(res, 201, 'Thumbnail uploaded', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async uploadCourseVideo(req, res) {
    try {
      const file = req.file;
      if (!file) {
        return sendError(res, 400, 'No video file provided');
      }
      const result = await hqService.uploadCourseVideo(file, req.user);
      sendResponse(res, 201, 'Video uploaded', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async uploadCourseCertificateBackground(req, res) {
    try {
      const file = req.file;
      if (!file) {
        return sendError(res, 400, 'No image file provided');
      }
      const result = await hqService.uploadCourseCertificateBackground(file, req.user);
      sendResponse(res, 201, 'Certificate background uploaded', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async previewCourseCertificate(req, res) {
    try {
      const result = hqService.previewCourseCertificate(req.body || {}, req.user);
      sendResponse(res, 200, 'Certificate preview', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async passCourseCheckpoint(req, res) {
    try {
      const result = await hqService.passCourseCheckpoint(
        req.params.id,
        req.params.enrollmentId,
        req.params.checkpointId,
        req.user,
      );
      sendResponse(res, 200, 'Checkpoint signed off', result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },
};
