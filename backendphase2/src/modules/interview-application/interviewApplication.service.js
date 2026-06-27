import path from 'path';
import {
  getActiveTenantDbName,
  getJobPortalPrismaClient,
  prisma,
  runWithTenantContext,
} from '../../config/prisma.js';
import { uploadBufferToCloudinary, uploadContentTypeForFile } from '../../utils/s3.js';
import {
  generateApplyLinkToken,
  normalizeApplicationFormSchema,
  defaultApplicationFormSchema,
} from '../../utils/applicationFormSchema.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { findWorkspaceClient } from '../setting/workspace-client.service.js';

function formatTenantLabel(tenantDbName) {
  const raw = String(tenantDbName || '').trim();
  if (!raw) return '';
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function buildTenantAgencyNameMap() {
  const map = new Map();

  try {
    const tenants = await headquartersAuthService.listTenants();
    for (const tenant of tenants || []) {
      const db = String(tenant?.tenantDbName || '').trim();
      if (!db) continue;
      const hqName = String(tenant?.name || '').trim();
      map.set(db, hqName || formatTenantLabel(db));
    }
  } catch (error) {
    console.warn(
      '[interview-applications] unable to load HQ tenant names:',
      error?.message || error,
    );
  }

  await Promise.all(
    [...map.keys()].map(async (tenantDbName) => {
      try {
        const client = await runWithTenantContext(tenantDbName, () => findWorkspaceClient());
        const companyName = String(client?.companyName || '').trim();
        if (!companyName) return;
        const label = companyName.replace(/\s+Workspace$/i, '').trim();
        if (label) map.set(tenantDbName, label);
      } catch {
        /* workspace client optional */
      }
    }),
  );

  return map;
}

async function enrichPublishedFormRows(rows, agencyMap = null) {
  const map = agencyMap || (await buildTenantAgencyNameMap());
  return (rows || []).map((row) => {
    const tenantDbName = String(row?.tenantDbName || '').trim();
    return {
      ...row,
      tenantAgencyName:
        (tenantDbName && map.get(tenantDbName)) || (tenantDbName ? formatTenantLabel(tenantDbName) : null),
    };
  });
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeNameToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function lastNameTokens(value) {
  return normalizeNameToken(value)
    .split(/\s+/)
    .filter(Boolean);
}

function lastNamesOverlap(a, b) {
  const left = lastNameTokens(a);
  const right = lastNameTokens(b);
  if (!left.length || !right.length) return false;
  if (normalizeNameToken(a) === normalizeNameToken(b)) return true;
  return left.some((token) => right.includes(token));
}

function applicantNamesMatch(applicantFirst, applicantLast, candidateFirst, candidateLast) {
  const af = normalizeNameToken(applicantFirst);
  const al = normalizeNameToken(applicantLast);
  const cf = normalizeNameToken(candidateFirst);
  const cl = normalizeNameToken(candidateLast);
  if (!af || !cf || af !== cf) return false;
  if (!al || !cl) return true;
  return lastNamesOverlap(al, cl);
}

function collectEmailPhoneFromAnswers(answers) {
  const emails = [];
  const phones = [];
  if (!answers || typeof answers !== 'object') return { emails, phones };

  for (const value of Object.values(answers)) {
    const raw = String(value ?? '').trim();
    if (!raw) continue;
    if (raw.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      emails.push(raw.toLowerCase());
    }
    const digits = normalizePhoneDigits(raw);
    if (digits.length >= 7) phones.push(raw);
  }

  return {
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
  };
}

function phonesMatch(a, b) {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10) return da.slice(-10) === db.slice(-10);
  return false;
}

function formatApplicationStatusLabel(status) {
  const key = String(status || '').toUpperCase();
  const labels = {
    SUBMITTED: 'Submitted',
    PENDING_REVIEW: 'Pending review',
    IN_INTERVIEW: 'In interview',
    INTERVIEW_COMPLETED: 'Interview completed',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };
  return labels[key] || 'Applied';
}

function formatMyApplicationSnapshot(application) {
  if (!application) return null;
  return {
    applicationId: application.id,
    status: application.status,
    statusLabel: formatApplicationStatusLabel(application.status),
    appliedAt: application.createdAt || null,
  };
}

function applicationMatchesApplicant(application, applicant = {}) {
  const normalizedEmail = String(applicant.email || '').trim().toLowerCase();
  const phoneCandidates = [
    ...(Array.isArray(applicant.phones) ? applicant.phones : []),
    ...(applicant.phone ? String(applicant.phone).split(',') : []),
  ]
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  const uniquePhones = [...new Set(phoneCandidates)];
  const normalizedPhase1Id = String(applicant.phase1CandidateId || '').trim();
  const applicantFirst = String(applicant.firstName || '').trim();
  const applicantLast = String(applicant.lastName || '').trim();

  const responses =
    application.responses && typeof application.responses === 'object' ? application.responses : {};
  if (normalizedPhase1Id && String(responses.phase1CandidateId || '') === normalizedPhase1Id) {
    return true;
  }

  const answerContact = collectEmailPhoneFromAnswers(responses.answers);
  const candidateEmail = String(application.candidate?.email || '').trim().toLowerCase();
  const candidatePhone = application.candidate?.phone;

  const emailCandidates = [
    normalizedEmail,
    ...answerContact.emails,
  ].filter(Boolean);
  for (const email of [...new Set(emailCandidates)]) {
    if (candidateEmail && email === candidateEmail) return true;
  }

  const allPhones = [...uniquePhones, ...answerContact.phones];
  for (const candidatePhoneValue of [...new Set(allPhones)]) {
    if (phonesMatch(candidatePhoneValue, candidatePhone)) {
      return true;
    }
  }

  if (applicantFirst && applicantLast) {
    const cFirst = String(application.candidate?.firstName || '').trim();
    const cLast = String(application.candidate?.lastName || '').trim();
    if (applicantNamesMatch(applicantFirst, applicantLast, cFirst, cLast)) {
      return true;
    }
  }

  return false;
}

function parseApplicantContext(applicant = {}) {
  const email = String(applicant.email || '').trim();
  const phone = String(applicant.phone || '').trim();
  const phones = [
    ...String(applicant.phones || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    ...(phone ? phone.split(',').map((p) => p.trim()).filter(Boolean) : []),
  ];
  return {
    email,
    phone,
    phones: [...new Set(phones)],
    phase1CandidateId: String(applicant.phase1CandidateId || '').trim(),
    firstName: String(applicant.firstName || '').trim(),
    lastName: String(applicant.lastName || '').trim(),
  };
}

function applicantHasIdentity(applicant) {
  return Boolean(
    applicant.email ||
      applicant.phones?.length ||
      applicant.phase1CandidateId ||
      (applicant.firstName && applicant.lastName),
  );
}

async function persistPhase1CandidateLink(application, phase1CandidateId) {
  const id = String(phase1CandidateId || '').trim();
  if (!id || !application?.id) return;
  const responses =
    application.responses && typeof application.responses === 'object'
      ? application.responses
      : {};
  if (String(responses.phase1CandidateId || '') === id) return;
  try {
    await prisma.interviewApplication.update({
      where: { id: application.id },
      data: {
        responses: {
          ...responses,
          phase1CandidateId: id,
        },
      },
    });
  } catch (error) {
    console.warn(
      '[interview-applications] phase1 link backfill failed:',
      error?.message || error,
    );
  }
}

async function listApplicantApplicationStatusMap(applicant = {}) {
  const parsed = parseApplicantContext(applicant);
  if (!applicantHasIdentity(parsed)) return new Map();

  const statusMap = new Map();
  const tenants = await resolvePublicFeedTenantDbNames();

  await Promise.all(
    tenants.map(async (tenantDbName) => {
      try {
        await runWithTenantContext(tenantDbName, async () => {
          const applications = await prisma.interviewApplication.findMany({
            orderBy: { createdAt: 'desc' },
            take: 500,
            include: {
              candidate: { select: { email: true, phone: true, firstName: true, lastName: true } },
            },
          });

          for (const application of applications) {
            if (!applicationMatchesApplicant(application, parsed)) continue;
            if (parsed.phase1CandidateId) {
              void persistPhase1CandidateLink(application, parsed.phase1CandidateId);
            }
            const key = `${tenantDbName}:${application.interviewFormId}`;
            if (statusMap.has(key)) continue;
            statusMap.set(key, formatMyApplicationSnapshot(application));
          }
        });
      } catch (error) {
        console.warn(
          `[interview-applications] status sync failed for ${tenantDbName}:`,
          error?.message || error,
        );
      }
    }),
  );

  return statusMap;
}

async function findExistingApplicationForApplicant(
  formId,
  { email, phone, phones, phase1CandidateId, firstName, lastName } = {},
) {
  const parsed = parseApplicantContext({ email, phone, phones, phase1CandidateId, firstName, lastName });
  if (!applicantHasIdentity(parsed)) return null;

  const applications = await prisma.interviewApplication.findMany({
    where: { interviewFormId: String(formId) },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      candidate: { select: { email: true, phone: true, firstName: true, lastName: true } },
    },
  });

  for (const application of applications) {
    if (applicationMatchesApplicant(application, parsed)) {
      return application;
    }
  }

  return null;
}

async function attachApplicantStatusToForms(rows, applicant = {}) {
  const parsed = parseApplicantContext(applicant);
  if (!applicantHasIdentity(parsed)) {
    return (rows || []).map((row) => ({ ...row, myApplication: null }));
  }

  const statusMap = await listApplicantApplicationStatusMap(parsed);

  return (rows || []).map((row) => {
    const tenantDbName = String(row?.tenantDbName || '').trim();
    const key = tenantDbName && row?.id ? `${tenantDbName}:${row.id}` : '';
    return {
      ...row,
      myApplication: key ? statusMap.get(key) || null : null,
    };
  });
}
async function resolvePublicFeedTenantDbNames() {
  const names = new Set();

  const fromEnv = String(
    process.env.PHASE2_PUBLIC_FEED_TENANT_DBS ||
      process.env.PHASE2_PUBLIC_FEED_TENANT_DB ||
      '',
  )
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  for (const tenant of fromEnv) names.add(tenant);

  try {
    const tenants = await headquartersAuthService.listTenants();
    for (const tenant of tenants || []) {
      const db = String(tenant?.tenantDbName || '').trim();
      if (db) names.add(db);
    }
  } catch (error) {
    console.warn(
      '[interview-applications] HQ tenant registry unavailable:',
      error?.message || error,
    );
  }

  try {
    const portal = getJobPortalPrismaClient();
    const jobs = await portal.job.findMany({
      where: { tenantDbName: { not: null }, isDeleted: { not: true } },
      select: { tenantDbName: true },
    });
    for (const job of jobs) {
      const tenant = String(job.tenantDbName || '').trim();
      if (tenant) names.add(tenant);
    }
  } catch {
    // Portal DB may be unavailable in some environments.
  }

  return Array.from(names);
}

async function findPublishedFormByToken(token) {
  const normalized = String(token || '').trim();
  if (!normalized) return null;
  return prisma.interviewApplicationForm.findFirst({
    where: { publicToken: normalized, status: 'PUBLISHED' },
  });
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
    if (label.includes('phone') || label.includes('mobile')) {
      const v = String(answers[field.id] ?? '').trim();
      if (v) return v;
    }
  }
  return '';
}

function schemaRequiresEmail(schema) {
  return (schema?.fields || []).some((field) => {
    if (field.type === 'section_title') return false;
    const label = String(field.label || '').toLowerCase();
    const isEmail = field.type === 'email' || label.includes('email');
    return isEmail && Boolean(field.required);
  });
}

function formatFormRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    schema: row.schema,
    status: row.status,
    publicToken: row.publicToken,
    publishedAt: row.publishedAt,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    applicationCount: row._count?.applications ?? row.applicationCount ?? undefined,
  };
}

function formatApplicationRow(row) {
  const candidate = row.candidate || {};
  const form = row.form || {};
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    interviewFormId: row.interviewFormId,
    formName: form.title || 'Interview form',
    candidateId: row.candidateId,
    candidateName: name || candidate.email || 'Candidate',
    candidateEmail: candidate.email || null,
    candidatePhone: candidate.phone || null,
    resumeUrl: row.resumeUrl || candidate.resumeUrl || candidate.resume || null,
    responses: row.responses,
    status: row.status,
    assignedInterviewerIds: row.assignedInterviewerIds || [],
    interviewNotes: row.interviewNotes,
    rating: row.rating,
    feedback: row.feedback,
    recommendation: row.recommendation,
    phase1SubmissionId: row.phase1SubmissionId,
    reviewedAt: row.reviewedAt,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    source: 'Phase 1 Portal',
    formSchema: form.schema || null,
    candidate,
  };
}

export const interviewApplicationService = {
  async listForms() {
    const rows = await prisma.interviewApplicationForm.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
    return rows.map(formatFormRow);
  },

  async getForm(id) {
    const row = await prisma.interviewApplicationForm.findUnique({
      where: { id },
      include: { _count: { select: { applications: true } } },
    });
    if (!row) throw Object.assign(new Error('Interview form not found'), { statusCode: 404 });
    return formatFormRow(row);
  },

  async createForm(req) {
    const title = String(req.body?.title || '').trim() || 'Untitled interview form';
    const description = req.body?.description != null ? String(req.body.description).trim() : null;
    const schema =
      normalizeApplicationFormSchema(req.body?.schema) || defaultApplicationFormSchema();
    const row = await prisma.interviewApplicationForm.create({
      data: {
        title,
        description: description || undefined,
        schema,
        status: 'DRAFT',
        publicToken: generateApplyLinkToken(),
        createdById: req.user?.id || null,
      },
    });
    return formatFormRow(row);
  },

  async updateForm(id, req) {
    const existing = await prisma.interviewApplicationForm.findUnique({ where: { id } });
    if (!existing) throw Object.assign(new Error('Interview form not found'), { statusCode: 404 });
    const title = req.body?.title != null ? String(req.body.title).trim() : undefined;
    const description =
      req.body?.description != null ? String(req.body.description).trim() : undefined;
    const schema =
      req.body?.schema != null
        ? normalizeApplicationFormSchema(req.body.schema) || defaultApplicationFormSchema()
        : undefined;
    const row = await prisma.interviewApplicationForm.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(schema ? { schema } : {}),
      },
    });
    return formatFormRow(row);
  },

  async publishForm(id) {
    const row = await prisma.interviewApplicationForm.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    return formatFormRow(row);
  },

  async unpublishForm(id) {
    const row = await prisma.interviewApplicationForm.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null },
    });
    return formatFormRow(row);
  },

  async archiveForm(id) {
    const row = await prisma.interviewApplicationForm.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    return formatFormRow(row);
  },

  async deleteForm(id) {
    await prisma.interviewApplicationForm.delete({ where: { id } });
    return { deleted: true };
  },

  async listPublishedFormsPublic() {
    const rows = await prisma.interviewApplicationForm.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        publicToken: true,
        publishedAt: true,
      },
    });
    const tenantDbName = getActiveTenantDbName() || null;
    return rows.map((r) => ({
      ...r,
      tenantDbName,
    }));
  },

  async listPublishedFormsPublicAllTenants() {
    const merged = [];
    const seen = new Set();
    const tenants = await resolvePublicFeedTenantDbNames();

    const pushRows = (rows) => {
      for (const row of rows || []) {
        const key = `${row?.tenantDbName || 'default'}:${row?.id}`;
        if (!row?.id || seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
    };

    const batches = await Promise.all([
      runWithTenantContext('', () => this.listPublishedFormsPublic()).catch(() => []),
      ...tenants.map((tenant) =>
        runWithTenantContext(tenant, () => this.listPublishedFormsPublic()).catch((error) => {
          console.warn(
            `[interview-applications] failed to list forms for ${tenant}:`,
            error?.message || error,
          );
          return [];
        }),
      ),
    ]);

    for (const rows of batches) pushRows(rows);

    return enrichPublishedFormRows(
      merged.sort(
        (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime(),
      ),
    );
  },

  async enrichPublishedFormsForPublic(rows, applicant = {}) {
    const enriched = await enrichPublishedFormRows(rows);
    return attachApplicantStatusToForms(enriched, applicant);
  },

  async listPublishedFormsPublicForApplicant(applicant = {}) {
    const rows = await this.listPublishedFormsPublicAllTenants();
    return attachApplicantStatusToForms(rows, applicant);
  },

  async resolveTenantForPublishedToken(token) {
    const normalized = String(token || '').trim();
    if (!normalized) return null;

    const defaultFound = await runWithTenantContext('', () => findPublishedFormByToken(normalized));
    if (defaultFound) return '';

    for (const tenant of await resolvePublicFeedTenantDbNames()) {
      const found = await runWithTenantContext(tenant, () => findPublishedFormByToken(normalized));
      if (found) return tenant;
    }

    return null;
  },

  async getPublicFormPage(token) {
    const form = await findPublishedFormByToken(token);
    if (!form) {
      throw Object.assign(new Error('Interview form not found or not published'), {
        statusCode: 404,
      });
    }
    return {
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
      },
      formSchema: form.schema,
      tenantDbName: getActiveTenantDbName() || null,
    };
  },

  async getPublicFormPageAcrossTenants(token) {
    const tenantDbName = await this.resolveTenantForPublishedToken(token);
    if (tenantDbName == null) {
      throw Object.assign(new Error('Interview form not found or not published'), {
        statusCode: 404,
      });
    }
    return runWithTenantContext(tenantDbName, () => this.getPublicFormPage(token));
  },

  async submitPublicForm(token, { answers = {}, files = {}, phase1CandidateId = '' } = {}) {
    const form = await prisma.interviewApplicationForm.findFirst({
      where: {
        publicToken: String(token || '').trim(),
        status: 'PUBLISHED',
      },
    });
    if (!form) {
      throw Object.assign(new Error('Interview form not found'), { statusCode: 404 });
    }

    const schema = normalizeApplicationFormSchema(form.schema) || defaultApplicationFormSchema();
    const parsedAnswers =
      typeof answers === 'string'
        ? JSON.parse(answers)
        : answers && typeof answers === 'object'
          ? answers
          : {};

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
    if (schemaRequiresEmail(schema) && !email) {
      throw Object.assign(new Error('Email is required'), { statusCode: 400 });
    }

    const { firstName, lastName } = splitNameParts(parsedAnswers, schema);
    const phone = extractPhone(parsedAnswers, schema);

    if (!email && !phone && !firstName && !lastName) {
      throw Object.assign(
        new Error('Please provide your name and at least email or phone'),
        { statusCode: 400 },
      );
    }

    const existingApplication = await findExistingApplicationForApplicant(form.id, {
      email,
      phones: [phone].filter(Boolean),
      phase1CandidateId,
      firstName,
      lastName,
    });
    if (existingApplication) {
      throw Object.assign(new Error('You have already applied to this interview form'), {
        statusCode: 409,
        existingStatus: existingApplication.status,
      });
    }

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
        field.type === 'photo' ? 'jobportal/interview-apply-photos' : 'jobportal/interview-apply-resumes';
      const ext = path.extname(String(file.originalname || '')).toLowerCase();
      const uploaded = await uploadBufferToCloudinary(file.buffer, {
        folder,
        resourceType: field.type === 'photo' ? 'image' : 'raw',
        publicId: `${form.id}_${field.id}_${Date.now()}${ext || (field.type === 'resume' ? '.pdf' : '')}`,
        contentType: mime,
        originalFilename: file.originalname,
      });
      if (field.type === 'photo') avatarUrl = uploaded.secure_url || uploaded.url;
      if (field.type === 'resume') resumeUrl = uploaded.secure_url || uploaded.url;
    }

    let candidate = null;
    if (email) {
      candidate = await prisma.candidate.findFirst({
        where: { email },
        select: { id: true },
      });
    }
    if (!candidate && phone) {
      candidate = await prisma.candidate.findFirst({
        where: { phone },
        select: { id: true },
      });
    }

    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const candidatePayload = {
      firstName: firstName || displayName.split(' ')[0] || 'Applicant',
      lastName: lastName || displayName.split(' ').slice(1).join(' ') || '',
      email: email || undefined,
      phone: phone || undefined,
      avatar: avatarUrl || undefined,
      resume: resumeUrl || undefined,
      resumeUrl: resumeUrl || undefined,
      source: 'Interview Form',
      stage: 'Applied',
      status: 'ACTIVE',
      lastActivity: new Date(),
      cvEducationEntries: educationJson || undefined,
      cvWorkExperienceEntries: workJson || undefined,
    };

    if (candidate) {
      candidate = await prisma.candidate.update({
        where: { id: candidate.id },
        data: candidatePayload,
      });
    } else {
      candidate = await prisma.candidate.create({ data: candidatePayload });
    }

    const submissionId = `p1_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const application = await prisma.interviewApplication.create({
      data: {
        interviewFormId: form.id,
        candidateId: candidate.id,
        phase1SubmissionId: submissionId,
        responses: {
          schemaVersion: 1,
          answers: parsedAnswers,
          submittedVia: 'phase1_interview_form',
          phase1CandidateId: String(phase1CandidateId || '').trim() || undefined,
        },
        resumeUrl: resumeUrl || undefined,
        status: 'PENDING_REVIEW',
      },
      include: {
        candidate: true,
        form: true,
      },
    });

    return {
      message: 'Application submitted — waiting for interview review',
      applicationId: application.id,
      phase1SubmissionId: submissionId,
      status: 'PENDING_REVIEW',
      candidateId: candidate.id,
      tenantDbName: getActiveTenantDbName() || null,
      application: formatApplicationRow(application),
    };
  },

  async listApplications(query = {}) {
    const where = {};
    if (query.formId) where.interviewFormId = String(query.formId);
    if (query.status) where.status = String(query.status);
    if (query.search) {
      const q = String(query.search).trim();
      where.OR = [
        { candidate: { firstName: { contains: q, mode: 'insensitive' } } },
        { candidate: { lastName: { contains: q, mode: 'insensitive' } } },
        { candidate: { email: { contains: q, mode: 'insensitive' } } },
        { form: { title: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const rows = await prisma.interviewApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: true,
        form: true,
      },
      take: Math.min(Number(query.limit) || 200, 500),
    });
    return rows.map(formatApplicationRow);
  },

  async listInterviewerApplications(userId, query = {}) {
    const where = {
      OR: [
        { assignedInterviewerIds: { has: String(userId) } },
        {
          AND: [
            { assignedInterviewerIds: { isEmpty: true } },
            { status: { in: ['PENDING_REVIEW', 'IN_INTERVIEW'] } },
          ],
        },
      ],
    };
    if (query.status) where.status = String(query.status);
    const rows = await prisma.interviewApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { candidate: true, form: true },
      take: Math.min(Number(query.limit) || 200, 500),
    });
    return rows.map(formatApplicationRow);
  },

  async getApplication(id) {
    const row = await prisma.interviewApplication.findUnique({
      where: { id },
      include: { candidate: true, form: true },
    });
    if (!row) throw Object.assign(new Error('Interview application not found'), { statusCode: 404 });
    return formatApplicationRow(row);
  },

  async updateApplication(id, payload, userId) {
    const existing = await prisma.interviewApplication.findUnique({ where: { id } });
    if (!existing) throw Object.assign(new Error('Interview application not found'), { statusCode: 404 });

    const data = {};
    if (payload.status) data.status = payload.status;
    if (payload.interviewNotes !== undefined) data.interviewNotes = payload.interviewNotes;
    if (payload.rating !== undefined) data.rating = payload.rating;
    if (payload.feedback !== undefined) data.feedback = payload.feedback;
    if (payload.recommendation !== undefined) data.recommendation = payload.recommendation;
    if (Array.isArray(payload.assignedInterviewerIds)) {
      data.assignedInterviewerIds = payload.assignedInterviewerIds.map(String);
    }
    if (payload.status === 'IN_INTERVIEW' || payload.status === 'INTERVIEW_COMPLETED') {
      data.reviewedAt = new Date();
    }
    if (payload.status === 'APPROVED' || payload.status === 'REJECTED') {
      data.decidedAt = new Date();
      if (userId && !data.assignedInterviewerIds) {
        const ids = new Set(existing.assignedInterviewerIds || []);
        ids.add(String(userId));
        data.assignedInterviewerIds = Array.from(ids);
      }
    }

    const row = await prisma.interviewApplication.update({
      where: { id },
      data,
      include: { candidate: true, form: true },
    });

    if (payload.status === 'APPROVED' && row.candidateId) {
      await prisma.candidate.update({
        where: { id: row.candidateId },
        data: { stage: 'Shortlist', lastActivity: new Date() },
      }).catch(() => {});
    }
    if (payload.status === 'REJECTED' && row.candidateId) {
      await prisma.candidate.update({
        where: { id: row.candidateId },
        data: { stage: 'Rejected', lastActivity: new Date() },
      }).catch(() => {});
    }

    return formatApplicationRow(row);
  },
};
