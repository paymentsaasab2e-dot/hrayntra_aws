import {
  applyPortalApplicationSync,
  backfillPortalJobTenantDbNames,
} from './portal-sync.service.js';

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
