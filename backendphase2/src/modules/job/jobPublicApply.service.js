import crypto from 'crypto';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { uploadBufferToCloudinary, uploadContentTypeForFile } from '../../utils/s3.js';
import {
  generateApplyLinkToken,
  normalizeApplicationFormSchema,
  schemaFromLegacyQuestions,
  defaultApplicationFormSchema,
} from '../../utils/applicationFormSchema.js';
import {
  updateCandidateStage,
  PIPELINE_STAGES,
  resolveJobPipelineStageForRole,
} from '../stage/candidateStage.service.js';
import { getActiveTenantDbName, getJobPortalPrismaClient } from '../../config/prisma.js';
import logger from '../../utils/logger.js';

/** Keep portal DB candidate row aligned so CRM list merge + mine filters see job links. */
async function syncPortalCandidateAfterApplyLink(candidate, job) {
  if (!candidate?.id || !job?.id) return;
  let portal;
  try {
    portal = getJobPortalPrismaClient();
  } catch {
    return;
  }
  try {
    const assignedJobs = Array.isArray(candidate.assignedJobs)
      ? candidate.assignedJobs.map(String).filter(Boolean)
      : [String(job.id)];
    const row = {
      firstName: candidate.firstName || undefined,
      lastName: candidate.lastName || undefined,
      email: candidate.email || undefined,
      phone: candidate.phone || undefined,
      avatar: candidate.avatar || undefined,
      resumeUrl: candidate.resumeUrl || candidate.resume || undefined,
      source: candidate.source || 'Job Apply Link',
      recruiterStatus: candidate.status || 'ACTIVE',
      assignedJobs,
    };
    await portal.candidate.upsert({
      where: { id: candidate.id },
      create: { id: candidate.id, ...row },
      update: row,
    });
    await portal.application.upsert({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
      create: {
        candidateId: candidate.id,
        jobId: job.id,
        status: 'SUBMITTED',
      },
      update: { status: 'SUBMITTED' },
    });
  } catch (err) {
    console.warn('[jobPublicApply] portal candidate sync failed:', err?.message || err);
  }
}

function summarizeApplyAnswersForLog(schema, answers, files = {}) {
  const rows = [];
  for (const field of schema?.fields || []) {
    if (field.type === 'section_title') continue;
    if (field.type === 'photo' || field.type === 'resume') {
      const file = files[field.id];
      rows.push({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        value: file?.originalname || '(uploaded)',
      });
      continue;
    }
    const val = answers[field.id];
    if (val == null || val === '') continue;
    rows.push({
      fieldId: field.id,
      label: field.label,
      type: field.type,
      value: val,
    });
  }
  return rows;
}

function splitNameParts(answers, schema) {
  let firstName = '';
  let lastName = '';
  for (const field of schema?.fields || []) {
    const label = String(field.label || '').toLowerCase();
    const val = String(answers[field.id] ?? '').trim();
    if (!val) continue;
    if (label.includes('first') && label.includes('name')) firstName = val;
    else if (label.includes('last') && label.includes('name')) lastName = val;
    else if (label === 'full name' || label === 'name') {
      const parts = val.split(/\s+/).filter(Boolean);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }
  return { firstName, lastName };
}

function extractEmail(answers, schema) {
  for (const field of schema?.fields || []) {
    if (field.type === 'email') {
      const v = String(answers[field.id] ?? '').trim().toLowerCase();
      if (v) return v;
    }
    const label = String(field.label || '').toLowerCase();
    if (label.includes('email')) {
      const v = String(answers[field.id] ?? '').trim().toLowerCase();
      if (v) return v;
    }
  }
  return '';
}

function extractPhone(answers, schema) {
  for (const field of schema?.fields || []) {
    if (field.type === 'phone') {
      const v = String(answers[field.id] ?? '').trim();
      if (v) return v;
    }
    const label = String(field.label || '').toLowerCase();
    if (label.includes('phone') || label.includes('mobile') || label.includes('whatsapp')) {
      const v = String(answers[field.id] ?? '').trim();
      if (v) return v;
    }
  }
  return '';
}

function resolveJobFormSchema(job) {
  const fromSchema = normalizeApplicationFormSchema(job.applicationFormSchema);
  if (fromSchema) return fromSchema;
  if (job.applicationFormEnabled && Array.isArray(job.applicationFormQuestions)?.length) {
    return schemaFromLegacyQuestions(job.applicationFormQuestions);
  }
  if (job.applicationFormEnabled) return defaultApplicationFormSchema();
  return null;
}

function formatPublicJob(job) {
  const client = job.client;
  return {
    id: job.id,
    title: job.title,
    company: client?.companyName || null,
    companyLogo: client?.logo || null,
    location: job.location || [job.city, job.state, job.country].filter(Boolean).join(', ') || null,
    description: job.description || job.overview || null,
    overview: job.overview || null,
    keyResponsibilities: job.keyResponsibilities || [],
    requirements: job.requirements || [],
    skills: job.skills || [],
    preferredSkills: job.preferredSkills || [],
    experienceRequired: job.experienceRequired || null,
    education: job.education || null,
    benefits: job.benefits || [],
    employmentType: job.type || null,
    workMode: job.workMode || job.jobLocationType || null,
    openings: job.openings,
    salary: job.salary,
    applicationFormNote: job.applicationFormNote || null,
    applicationFormLogo: job.applicationFormLogo || null,
  };
}

async function ensureApplyToken(jobId) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, applyLinkToken: true, applicationFormEnabled: true, isDeleted: true },
  });
  if (!job || job.isDeleted) return null;
  if (!job.applicationFormEnabled) return null;
  if (job.applyLinkToken) return job.applyLinkToken;
  const token = generateApplyLinkToken();
  await prisma.job.update({
    where: { id: jobId },
    data: { applyLinkToken: token },
  });
  return token;
}

export const jobPublicApplyService = {
  resolveJobFormSchema,

  async ensureApplyTokenForJob(jobId) {
    return ensureApplyToken(jobId);
  },

  async getJobTenantForApplyLink(jobId) {
    return prisma.job.findUnique({
      where: { id: jobId },
      select: { tenantDbName: true },
    });
  },

  async listTemplates(req) {
    const templates = await prisma.jobApplicationFormTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      schema: t.schema,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  },

  async createTemplate(req) {
    const name = String(req.body?.name || '').trim() || 'Untitled template';
    const schema =
      normalizeApplicationFormSchema(req.body?.schema) || defaultApplicationFormSchema();
    const row = await prisma.jobApplicationFormTemplate.create({
      data: {
        name,
        schema,
        createdById: req.user?.id || null,
      },
    });
    return { id: row.id, name: row.name, schema: row.schema };
  },

  async updateTemplate(id, req) {
    const name = req.body?.name != null ? String(req.body.name).trim() : undefined;
    const schema =
      req.body?.schema != null
        ? normalizeApplicationFormSchema(req.body.schema) || defaultApplicationFormSchema()
        : undefined;
    const row = await prisma.jobApplicationFormTemplate.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(schema ? { schema } : {}),
      },
    });
    return { id: row.id, name: row.name, schema: row.schema };
  },

  async deleteTemplate(id) {
    await prisma.jobApplicationFormTemplate.delete({ where: { id } });
    return { deleted: true };
  },

  async getPublicApplyPage(token) {
    const job = await prisma.job.findFirst({
      where: {
        applyLinkToken: String(token || '').trim(),
        isDeleted: { not: true },
        status: { in: ['OPEN', 'DRAFT'] },
      },
      include: {
        client: { select: { companyName: true, logo: true } },
      },
    });
    if (!job) {
      throw Object.assign(new Error('Apply link not found or job is no longer accepting applications'), {
        statusCode: 404,
      });
    }
    if (!job.applicationFormEnabled) {
      throw Object.assign(new Error('Application form is not enabled for this job'), { statusCode: 400 });
    }
    const schema = resolveJobFormSchema(job);
    return {
      job: formatPublicJob(job),
      formSchema: schema,
    };
  },

  async submitPublicApplication(token, { answers = {}, files = {} }) {
    const job = await prisma.job.findFirst({
      where: {
        applyLinkToken: String(token || '').trim(),
        isDeleted: { not: true },
        status: { in: ['OPEN', 'DRAFT'] },
      },
      include: {
        client: { select: { companyName: true } },
      },
    });
    if (!job) {
      throw Object.assign(new Error('Apply link not found'), { statusCode: 404 });
    }

    const schema = resolveJobFormSchema(job);
    if (!schema) {
      throw Object.assign(new Error('No application form configured'), { statusCode: 400 });
    }

    const parsedAnswers =
      typeof answers === 'string'
        ? JSON.parse(answers)
        : answers && typeof answers === 'object'
          ? answers
          : {};

    const tenantDb = getActiveTenantDbName() || '(default)';
    const answerLog = summarizeApplyAnswersForLog(schema, parsedAnswers, files);
    console.log('\n-------- Job apply link submission --------');
    console.log(`Tenant DB: ${tenantDb}`);
    console.log(`Job: ${job.title} (${job.id})`);
    console.log(`Apply token: ${String(token || '').trim()}`);
    console.log('Form responses:');
    for (const row of answerLog) {
      const preview =
        typeof row.value === 'object' ? JSON.stringify(row.value) : String(row.value ?? '');
      console.log(`  - ${row.label} (${row.type}): ${preview.slice(0, 500)}`);
    }
    console.log('-------------------------------------------\n');
    logger.info({
      evt: 'job_apply_link_submit',
      tenant: tenantDb,
      jobId: job.id,
      jobTitle: job.title,
      applyToken: String(token || '').trim(),
      formFields: answerLog,
    });

    for (const field of schema.fields) {
      if (field.type === 'section_title') continue;
      if (!field.required) continue;
      if (field.type === 'photo' || field.type === 'resume') {
        if (!files[field.id]) {
          throw Object.assign(new Error(`${field.label} is required`), { statusCode: 400 });
        }
        continue;
      }
      const val = parsedAnswers[field.id];
      if (val == null || String(val).trim() === '') {
        throw Object.assign(new Error(`${field.label} is required`), { statusCode: 400 });
      }
    }

    const email = extractEmail(parsedAnswers, schema);
    if (!email) {
      throw Object.assign(new Error('Email is required'), { statusCode: 400 });
    }

    const { firstName, lastName } = splitNameParts(parsedAnswers, schema);
    const phone = extractPhone(parsedAnswers, schema);
    const recruiterOwnerId = job.assignedToId || job.createdById || null;

    let educationJson = null;
    let workJson = null;
    for (const field of schema.fields) {
      if (field.type === 'education' && parsedAnswers[field.id]) {
        educationJson = parsedAnswers[field.id];
      }
      if (field.type === 'work_history' && parsedAnswers[field.id]) {
        workJson = parsedAnswers[field.id];
      }
    }

    let avatarUrl = null;
    let resumeUrl = null;
    for (const field of schema.fields) {
      const file = files[field.id];
      if (!file?.buffer) continue;
      const mime = file.mimetype || uploadContentTypeForFile(file.originalname);
      const folder =
        field.type === 'photo'
          ? 'jobportal/apply-photos'
          : 'jobportal/apply-resumes';
      const ext = path.extname(String(file.originalname || '')).toLowerCase();
      const uploaded = await uploadBufferToCloudinary(file.buffer, {
        folder,
        resourceType: field.type === 'photo' ? 'image' : 'raw',
        publicId: `${job.id}_${field.id}_${Date.now()}${ext || (field.type === 'resume' ? '.pdf' : '')}`,
        contentType: mime,
        originalFilename: file.originalname,
      });
      if (field.type === 'photo') avatarUrl = uploaded.secure_url || uploaded.url;
      if (field.type === 'resume') resumeUrl = uploaded.secure_url || uploaded.url;
    }

    let candidate = await prisma.candidate.findFirst({
      where: { email },
      select: { id: true, assignedJobs: true, stage: true },
    });

    const candidatePayload = {
      firstName: firstName || email.split('@')[0],
      lastName: lastName || '',
      email,
      phone: phone || undefined,
      avatar: avatarUrl || undefined,
      resume: resumeUrl || undefined,
      resumeUrl: resumeUrl || undefined,
      source: 'Job Apply Link',
      stage: 'Applied',
      status: 'ACTIVE',
      lastActivity: new Date(),
      assignedToId: recruiterOwnerId || undefined,
      createdById: job.createdById || recruiterOwnerId || undefined,
      cvEducationEntries: educationJson || undefined,
      cvWorkExperienceEntries: workJson || undefined,
    };

    if (candidate) {
      const union = new Set([
        ...(Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : []),
        job.id,
      ]);
      candidate = await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          ...candidatePayload,
          assignedJobs: Array.from(union),
        },
      });
    } else {
      candidate = await prisma.candidate.create({
        data: {
          ...candidatePayload,
          assignedJobs: [job.id],
        },
      });
    }

    const existingApp = await prisma.application.findFirst({
      where: { candidateId: candidate.id, jobId: job.id },
    });
    if (!existingApp) {
      await prisma.application.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          status: 'SUBMITTED',
          screeningAnswers: {
            schemaVersion: 1,
            answers: parsedAnswers,
            submittedVia: 'apply_link',
          },
        },
      });
    } else {
      await prisma.application.update({
        where: { id: existingApp.id },
        data: {
          screeningAnswers: {
            schemaVersion: 1,
            answers: parsedAnswers,
            submittedVia: 'apply_link',
          },
        },
      });
    }

    const existingMatch = await prisma.match.findFirst({
      where: { candidateId: candidate.id, jobId: job.id },
    });
    if (!existingMatch) {
      await prisma.match.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          score: 75,
          status: 'REVIEWED',
          notes: 'Applied via job apply link',
          evaluation: { origin: 'applied', source: 'apply_link' },
          createdById: job.createdById || job.assignedToId || undefined,
        },
      });
    }

    const appliedPipelineStage = await resolveJobPipelineStageForRole(
      job.id,
      PIPELINE_STAGES.APPLIED
    );
    const fallbackStage = await prisma.pipelineStage.findFirst({
      where: { jobId: job.id },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    const pipelineStageId = appliedPipelineStage?.id || fallbackStage?.id;
    if (pipelineStageId) {
      const pe = await prisma.pipelineEntry.findFirst({
        where: { candidateId: candidate.id, jobId: job.id },
      });
      if (!pe) {
        await prisma.pipelineEntry.create({
          data: {
            candidateId: candidate.id,
            jobId: job.id,
            stageId: pipelineStageId,
            movedById: recruiterOwnerId || undefined,
            notes: 'Applied via job apply link',
          },
        });
      } else {
        await prisma.pipelineEntry.update({
          where: { id: pe.id },
          data: {
            stageId: pipelineStageId,
            movedById: recruiterOwnerId || undefined,
            notes: 'Applied via job apply link',
          },
        });
      }
    }

    try {
      await updateCandidateStage({
        candidateId: candidate.id,
        jobId: job.id,
        stage: PIPELINE_STAGES.APPLIED,
        performedById: job.createdById || job.assignedToId || undefined,
        skipStageActivity: true,
      });
    } catch (stageErr) {
      console.warn('[jobPublicApply] stage update failed:', stageErr?.message || stageErr);
    }

    console.log('\n-------- Job apply link saved --------');
    console.log(`Tenant DB: ${tenantDb}`);
    console.log(`Candidate: ${candidate.firstName} ${candidate.lastName} (${candidate.id})`);
    console.log(`Email: ${candidate.email}`);
    console.log(`Stage: Applied | Owner: ${recruiterOwnerId || 'unassigned'}`);
    console.log('--------------------------------------\n');
    logger.info({
      evt: 'job_apply_link_saved',
      tenant: tenantDb,
      jobId: job.id,
      candidateId: candidate.id,
      email: candidate.email,
      stage: 'Applied',
      assignedToId: recruiterOwnerId,
    });

    await syncPortalCandidateAfterApplyLink(candidate, job);

    return {
      success: true,
      candidateId: candidate.id,
      jobId: job.id,
      message: 'Application submitted successfully',
    };
  },
};

export function buildApplyUrlFromToken(token, frontendBase, tenantDbName) {
  const base = String(frontendBase || process.env.FRONTEND_URL || 'http://localhost:3001').replace(
    /\/$/,
    ''
  );
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  return `${base}/apply/${token}${qs}`;
}
