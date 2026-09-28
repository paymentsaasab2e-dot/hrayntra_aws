import fs from 'fs';
import os from 'os';
import path from 'path';
import { prisma, runWithTenantContext } from '../config/prisma.js';
import { hasRedisConfig } from '../cache/redis.js';
import {
  processCandidateCv,
  validateCvUploadFile,
} from './cvParsing.service.js';
import { buildIdentityFields, resumeSha256FromBuffer } from '../lib/personIdentity.js';

const jobs = new Map();
const MAX_JOBS = Math.min(500, Math.max(20, Number(process.env.CV_PARSE_JOB_MAX || 200) || 200));
const TTL_MS = Math.min(
  6 * 60 * 60 * 1000,
  Math.max(5 * 60 * 1000, Number(process.env.CV_PARSE_JOB_TTL_MS || 30 * 60 * 1000) || 30 * 60 * 1000),
);

function dropHeavyFields(job) {
  if (!job) return job;
  if (job.file) job.file = undefined;
  if (job.parseFn) job.parseFn = undefined;
  return job;
}

function pruneJobs(now = Date.now()) {
  for (const [id, job] of jobs) {
    const stamp = Number(job.updatedAt || job.createdAt || 0);
    if (stamp && now - stamp > TTL_MS) {
      jobs.delete(id);
      continue;
    }
    if (job.status === 'done' || job.status === 'error') {
      dropHeavyFields(job);
    }
  }
  if (jobs.size <= MAX_JOBS) return;
  const ordered = [...jobs.entries()].sort(
    (a, b) => Number(a[1].createdAt || 0) - Number(b[1].createdAt || 0),
  );
  for (const [id] of ordered) {
    if (jobs.size <= MAX_JOBS) break;
    jobs.delete(id);
  }
}

function setJob(jobId, patch) {
  const prev = jobs.get(jobId) || { jobId, status: 'queued', createdAt: Date.now() };
  const next = { ...prev, ...patch, jobId, updatedAt: Date.now() };
  if (next.status === 'done' || next.status === 'error') {
    dropHeavyFields(next);
  }
  jobs.set(jobId, next);
  return next;
}

function buildCvPatch(data) {
  const patch = {};
  const mapped = {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    currentCompany: data.currentCompany,
    currentTitle: data.currentDesignation || data.designation,
    experience: Number.isFinite(Number(data.experience)) ? Math.round(Number(data.experience)) : null,
    experienceYears: Number.isFinite(Number(data.experience)) ? Number(data.experience) : null,
    location: data.location,
    city: data.city,
    country: data.country,
    address: data.currentAddress,
    addressLine: data.currentAddress,
    linkedIn: data.linkedinUrl,
    website: data.website,
    portfolio: data.portfolioUrl,
    skills: Array.isArray(data.skills) ? data.skills : [],
    education: data.education,
    languages: Array.isArray(data.languages) ? data.languages : [],
    certifications: Array.isArray(data.certifications) ? data.certifications : [],
    certificationsList: Array.isArray(data.certifications) ? data.certifications : [],
    cvSummary: data.summary,
    cvEducationEntries: Array.isArray(data.educationEntries) ? data.educationEntries : null,
    cvWorkExperienceEntries: Array.isArray(data.workExperienceEntries) ? data.workExperienceEntries : null,
    cvPortfolioLinks: Array.isArray(data.portfolioLinks) ? data.portfolioLinks : null,
    expectedSalary: Number.isFinite(Number(data.expectedSalary)) ? Number(data.expectedSalary) : null,
    currentSalary: Number.isFinite(Number(data.currentSalary)) ? Number(data.currentSalary) : null,
    currency: data.currency,
    noticePeriod: data.noticePeriod,
    resume: data.resumeUrl || null,
    resumeUrl: data.resumeUrl || null,
  };

  for (const [key, value] of Object.entries(mapped)) {
    if (value !== undefined && value !== null && value !== '') {
      patch[key] = value;
    }
  }

  if (data.extraFields || data.score) {
    const extra = typeof data.extraFields === 'object' && data.extraFields ? { ...data.extraFields } : {};
    if (data.score) extra.score = data.score;
    patch.extraData = extra;
  }

  return patch;
}

async function patchCandidateFromCv(candidateId, data) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, personId: true, email: true, phone: true },
  });
  if (!candidate) return;

  const identity = buildIdentityFields({
    email: data.email || candidate.email,
    phone: data.phone || candidate.phone,
    existingPersonId: candidate.personId,
  });

  const patch = buildCvPatch(data);
  patch.personId = identity.personId;

  await prisma.candidate.update({
    where: { id: candidateId },
    data: patch,
  });
}

async function runJob(job) {
  setJob(job.jobId, { status: 'processing' });
  try {
    const validation = validateCvUploadFile(job.file);
    if (!validation.ok) {
      throw new Error(validation.message || 'Invalid CV file');
    }

    const buffer = job.file.buffer || (job.file.path ? fs.readFileSync(job.file.path) : null);
    const resumeSha256 = buffer ? resumeSha256FromBuffer(buffer) : null;

    const tenantDbName = String(job.tenantDbName || '').trim();
    if (!tenantDbName) {
      throw new Error('Tenant is required');
    }

    const parseFn = typeof job.parseFn === 'function' ? job.parseFn : processCandidateCv;
    const result = await runWithTenantContext(tenantDbName, async () => {
      return parseFn(job.file, { candidateId: job.candidateId, jobId: job.jobId });
    });

    const data = { ...(result || {}), resumeSha256 };

    if (job.candidateId) {
      await runWithTenantContext(tenantDbName, async () => {
        return patchCandidateFromCv(job.candidateId, data);
      });
    }

    setJob(job.jobId, { status: 'done', data });
  } catch (err) {
    console.error('[cvParseJob] failed:', job.jobId, err?.message || err);
    setJob(job.jobId, { status: 'error', error: err?.message || 'Parse failed' });
  } finally {
    if (!job.keepFile) {
      try {
        if (job.file?.path && fs.existsSync(job.file.path)) {
          fs.unlinkSync(job.file.path);
        }
      } catch {
        // temp file cleanup best-effort
      }
    }
  }
}

export function enqueueCvParseJob({ file, candidateId, tenantDbName, parseFn, keepFile, meta } = {}) {
  pruneJobs();
  const jobId = `cvj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  let jobFile = file;
  // When a Redis-backed queue is configured, never keep file buffers on the
  // API heap — spill them to a temp file and keep only the path.
  if (hasRedisConfig() && jobFile?.buffer && !jobFile?.path) {
    try {
      const safeName = path.basename(String(jobFile.originalname || 'resume')).replace(/[^a-zA-Z0-9.-]/g, '_');
      const tmpPath = path.join(os.tmpdir(), `cvparse-${jobId}-${safeName}`);
      fs.writeFileSync(tmpPath, jobFile.buffer);
      jobFile = { ...jobFile, path: tmpPath, buffer: undefined };
    } catch {
      // fall back to in-memory file if temp write fails
    }
  }
  const tenant = String(tenantDbName || '').trim();
  const job = {
    jobId,
    status: 'queued',
    file: jobFile,
    candidateId: candidateId ? String(candidateId).trim() : null,
    tenantDbName: tenant,
    parseFn,
    keepFile: Boolean(keepFile),
    ...(meta && typeof meta === 'object' ? { meta } : {}),
    createdAt: Date.now(),
  };
  jobs.set(jobId, job);
  if (!tenant) {
    setJob(jobId, { status: 'error', error: 'Tenant is required' });
    return { jobId, status: 'error' };
  }
  setImmediate(() => runJob(job));
  return { jobId, status: 'queued' };
}

/** Bulk-CV entry point — same in-process queue, carries session/fileIndex for the UI. */
export function enqueueBulkCvParseJob({ file, tenantDbName, sessionId, fileIndex, keepFile, parseFn } = {}) {
  const { jobId, status } = enqueueCvParseJob({
    file,
    tenantDbName,
    keepFile,
    meta: {
      sessionId: sessionId != null ? String(sessionId) : undefined,
      fileIndex: Number.isFinite(Number(fileIndex)) ? Number(fileIndex) : undefined,
    },
    parseFn,
  });
  return { jobId, status, fileIndex: Number(fileIndex), sessionId };
}

/**
 * Update a live job's status fields (e.g. `waiting_user` while the bulk
 * duplicate dialog waits for a human decision). Thin wrapper over setJob;
 * prune/TTL and tenant-scoped reads are unchanged.
 */
export function setCvParseJobStatus(jobId, patch) {
  pruneJobs();
  const id = String(jobId || '').trim();
  if (!id || !jobs.has(id)) return null;
  return setJob(id, patch && typeof patch === 'object' ? patch : {});
}

export function getCvParseJob(jobId, tenantDbName) {
  pruneJobs();
  const id = String(jobId || '').trim();
  const job = jobs.get(id) || null;
  if (!job) return null;
  const callerTenant = String(tenantDbName || '').trim();
  if (!callerTenant || callerTenant !== job.tenantDbName) return null;
  const { file, parseFn, candidateId, tenantDbName: _tenant, ...rest } = job;
  return rest;
}
