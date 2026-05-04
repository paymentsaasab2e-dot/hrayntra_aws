import { applyPortalApplicationSync } from './portal-sync.service.js';

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
