import {
  applyPortalApplicationSync,
  applyPortalWithdrawSync,
  applyPlacementOfferResponse,
  backfillPortalJobTenantDbNames,
  lookupPortalInterviewFeedback,
} from './portal-sync.service.js';
import { applyPortalTailoredCvSync } from './portal-tailored-cv.service.js';
import { hqLeadsService } from '../hq/hq-leads.service.js';
import { hqTrialService } from '../hq/hq-trial.service.js';
import { hqPaidProvisionService } from '../hq/hq-paid-provision.service.js';

export async function postSyncPortalApplication(req, res) {
  try {
    const { tenantDbName, candidateId, jobId, assignedJobs, assignedJobsSnapshot, performedById } = req.body || {};
    const jobs = assignedJobsSnapshot ?? assignedJobs;

    await applyPortalApplicationSync({
      tenantDbName,
      candidateId,
      jobId,
      assignedJobsSnapshot: Array.isArray(jobs) ? jobs : [],
      performedById: performedById || null,
    });

    return res.json({ success: true, message: 'Portal application synced' });
  } catch (error) {
    const message = String(error?.message || 'Sync failed');
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({
      success: false,
      message,
    });
  }
}

/**
 * One-shot admin endpoint: backfill `tenantDbName` on every portal Job mirror
 * that originated from this tenant. Idempotent — re-running it is safe and
 * cheap (only updates rows where the field is missing or wrong).
 *
 * Body: { tenantDbName: string }
 */
export async function postPlacementOfferResponse(req, res) {
  try {
    const { tenantDbName, candidateId, jobId, decision, remark } = req.body || {};
    const placement = await applyPlacementOfferResponse({
      tenantDbName,
      candidateId,
      jobId,
      decision,
      remark,
    });
    return res.json({
      success: true,
      data: {
        placementId: placement?.id,
        status: placement?.status,
        candidateOfferRemark: placement?.candidateOfferRemark || null,
      },
    });
  } catch (error) {
    const message = String(error?.message || 'Offer response failed');
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message });
  }
}

export async function postSyncPortalWithdrawApplication(req, res) {
  try {
    const { tenantDbName, candidateId, jobId } = req.body || {};
    await applyPortalWithdrawSync({ tenantDbName, candidateId, jobId });
    return res.json({ success: true, message: 'Portal withdraw synced' });
  } catch (error) {
    const message = String(error?.message || 'Withdraw sync failed');
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message });
  }
}

export async function postSyncPortalTailoredCv(req, res) {
  try {
    const { tenantDbName, candidateId, jobId, cvPayload, source } = req.body || {};
    const result = await applyPortalTailoredCvSync({
      tenantDbName,
      candidateId,
      jobId,
      cvPayload,
      source,
    });
    return res.json({ success: true, message: 'Portal tailored CV synced', data: result });
  } catch (error) {
    const message = String(error?.message || 'Tailored CV sync failed');
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message });
  }
}

export async function postBackfillPortalJobTenants(req, res) {
  try {
    const { tenantDbName } = req.body || {};
    const result = await backfillPortalJobTenantDbNames({ tenantDbName });
    return res.json({ success: true, ...result });
  } catch (error) {
    const message = String(error?.message || 'Backfill failed');
    return res.status(400).json({ success: false, message });
  }
}

export async function postSyncEmployerDemoVerified(req, res) {
  try {
    const result = await hqLeadsService.createLeadFromEmployerDemoRequest(req.body || {});
    return res.json({
      success: true,
      message: result.created ? 'HQ lead created from demo request' : 'HQ lead already exists',
      data: {
        leadId: result.lead?.id || null,
        created: result.created,
      },
    });
  } catch (error) {
    const message = String(error?.message || 'Employer demo sync failed');
    return res.status(400).json({ success: false, message });
  }
}

export async function postProvisionEmployerTrial(req, res) {
  try {
    const result = await hqTrialService.provisionEmployerTrialRequest(req.body || {});
    return res.json({
      success: true,
      message: result.alreadyProvisioned
        ? 'Trial workspace already exists for this email'
        : '5-day trial workspace provisioned',
      data: result,
    });
  } catch (error) {
    const message = String(error?.message || 'Employer trial provisioning failed');
    return res.status(400).json({ success: false, message });
  }
}

export async function postProvisionEmployerPaid(req, res) {
  try {
    const result = await hqPaidProvisionService.provisionEmployerPaidRequest(req.body || {});
    return res.json({
      success: true,
      message: result.alreadyProvisioned
        ? 'Workspace already exists for this email'
        : 'Paid workspace provisioned',
      data: result,
    });
  } catch (error) {
    const message = String(error?.message || 'Employer paid provisioning failed');
    return res.status(400).json({ success: false, message });
  }
}

export async function postPortalInterviewFeedbackLookup(req, res) {
  try {
    const { tenantDbName, candidateId, jobId, interviewIds, repairPortal } = req.body || {};
    const data = await lookupPortalInterviewFeedback({
      tenantDbName,
      candidateId,
      jobId,
      interviewIds,
      repairPortal: repairPortal !== false,
    });
    return res.json({ success: true, data });
  } catch (error) {
    const message = String(error?.message || 'Interview feedback lookup failed');
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message });
  }
}
