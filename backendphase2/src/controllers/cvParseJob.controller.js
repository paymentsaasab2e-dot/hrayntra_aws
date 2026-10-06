import { getActiveTenantDbName } from '../config/prisma.js';
import { enqueueCvParseJob, getCvParseJob } from '../services/cvParseJob.service.js';

export async function createParseJob(req, res) {
  const file = req.file;
  if (!file) {
    return res.status(400).json({
      success: false,
      message: 'Resume file is required',
    });
  }

  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  if (!tenantDbName) {
    return res.status(400).json({
      success: false,
      message: 'Company workspace is required',
    });
  }

  const candidateId = req.body?.candidateId || req.body?.candidate_id || null;

  const { jobId, status } = enqueueCvParseJob({ file, candidateId, tenantDbName });

  return res.status(202).json({
    success: true,
    jobId,
    status,
  });
}

export async function getParseJob(req, res) {
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  const job = getCvParseJob(req.params?.id, tenantDbName);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found',
    });
  }

  const payload = {
    success: true,
    jobId: job.jobId,
    status: job.status,
  };
  if (job.error) payload.error = job.error;
  if (job.data) payload.data = job.data;

  return res.json(payload);
}

export const cvParseJobController = {
  createParseJob,
  getParseJob,
};
