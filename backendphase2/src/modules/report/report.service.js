import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';

const EXPORT_DIR = path.join(process.cwd(), 'uploads', 'reports');
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

function ensureExportDir() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

function fileSlug(value) {
  return String(value || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report';
}

function toPublicUploadUrl(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  const uploadsIndex = normalized.lastIndexOf('/uploads/');
  return uploadsIndex >= 0 ? normalized.slice(uploadsIndex) : normalized;
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createSimplePdfBuffer(title, lines) {
  const safeLines = [title, ...lines].filter(Boolean).slice(0, 40);
  const contentLines = ['BT', '/F1 13 Tf', '45 790 Td'];

  safeLines.forEach((line, index) => {
    if (index === 0) {
      contentLines.push(`(${escapePdfText(line)}) Tj`);
    } else {
      contentLines.push('0 -18 Td');
      contentLines.push(`(${escapePdfText(line)}) Tj`);
    }
  });

  contentLines.push('ET');
  const stream = contentLines.join('\n');

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objects.push(`5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function userHasFullDbAccess(user) {
  if (env.ASSISTANT_FULL_DB_ACCESS === 'true') return true;
  const role = user?.role;
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER';
}

function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value.trim());
}

async function resolveUserId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (isValidObjectId(normalized)) return normalized;

  const lowered = normalized.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: normalized }, { email: lowered }, { name: normalized }],
    },
    select: { id: true },
  });
  return user?.id || null;
}

function dateRangeFilter(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;

  const now = new Date();
  if (normalized === 'last_7_days') {
    return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  }
  if (normalized === 'last_30_days') {
    return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }
  if (normalized === 'this_month') {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  return null;
}

function searchContains(value) {
  const normalized = String(value || '').trim();
  return normalized ? { contains: normalized, mode: 'insensitive' } : null;
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTextSearchConditions(fields, rawValue, arrayFields = []) {
  const normalized = normalizeSearchText(rawValue);
  if (!normalized) return [];

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 6);

  const fullPhraseConditions = fields
    .map((field) => {
      const condition = searchContains(rawValue);
      return condition ? { [field]: condition } : null;
    })
    .filter(Boolean);

  const fullPhraseArrayConditions = arrayFields
    .map((field) => {
      const condition = searchContains(rawValue);
      return condition ? { [field]: { has: String(rawValue || '').trim() } } : null;
    })
    .filter(Boolean);

  const tokenConditions = tokens.flatMap((token) =>
    fields.map((field) => ({
      [field]: { contains: token, mode: 'insensitive' },
    }))
  );

  const tokenArrayConditions = tokens.flatMap((token) =>
    arrayFields.map((field) => ({
      [field]: { has: token },
    }))
  );

  return [...fullPhraseConditions, ...fullPhraseArrayConditions, ...tokenConditions, ...tokenArrayConditions];
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
}

function formatDateTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function formatArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : '';
}

function formatJson(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeEntity(entity) {
  const normalized = String(entity || '').trim().toLowerCase();
  if (['lead', 'leads'].includes(normalized)) return 'leads';
  if (['client', 'clients'].includes(normalized)) return 'clients';
  if (['candidate', 'candidates'].includes(normalized)) return 'candidates';
  if (['job', 'jobs'].includes(normalized)) return 'jobs';
  if (['pipeline'].includes(normalized)) return 'pipeline';
  if (['interview', 'interviews'].includes(normalized)) return 'interviews';
  if (['placement', 'placements'].includes(normalized)) return 'placements';
  if (['task', 'tasks'].includes(normalized)) return 'tasks';
  if (['team', 'team-performance', 'team_performance'].includes(normalized)) return 'team';
  return normalized;
}

function normalizeFormat(format) {
  const normalized = String(format || '').trim().toLowerCase();
  if (normalized === 'xlsx') return 'excel';
  return normalized;
}

function combineWhere(...parts) {
  const filtered = parts.filter((part) => part && Object.keys(part).length > 0);
  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];
  return { AND: filtered };
}

function candidateScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ assignedToId: uid }, { createdById: uid }] };
}

function jobScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ assignedToId: uid }, { createdById: uid }] };
}

function clientScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { assignedToId: uid };
}

function leadScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { assignedToId: uid };
}

function interviewScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ createdById: uid }, { interviewerId: uid }, { panelIds: { has: uid } }] };
}

function placementScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return {
    OR: [
      { recruiterId: uid },
      { job: { OR: [{ createdById: uid }, { assignedToId: uid }] } },
      { candidate: { OR: [{ assignedToId: uid }, { createdById: uid }] } },
    ],
  };
}

function taskScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ assignedToId: uid }, { createdById: uid }] };
}

function activityScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { performedById: uid };
}

function parseSummaryFilters(query = {}) {
  const rangeKey = String(query.dateRange || 'last_30_days').trim().toLowerCase();
  const now = new Date();
  let start = null;
  let end = now;

  if (query.startDate && query.endDate) {
    start = new Date(query.startDate);
    end = new Date(query.endDate);
  } else if (rangeKey === 'last_7_days') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (rangeKey === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (rangeKey === 'this_quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), quarterStartMonth, 1);
  } else if (rangeKey === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (Number.isNaN(start?.getTime?.())) {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (Number.isNaN(end?.getTime?.())) {
    end = now;
  }

  return {
    dateRange: rangeKey,
    start,
    end,
    clientId: isValidObjectId(query.clientId) ? String(query.clientId) : null,
    jobId: isValidObjectId(query.jobId) ? String(query.jobId) : null,
    recruiterId: isValidObjectId(query.recruiterId) ? String(query.recruiterId) : null,
  };
}

function dateBetween(field, filters) {
  if (!filters?.start || !filters?.end) return {};
  return { [field]: { gte: filters.start, lte: filters.end } };
}

function buildTimeBuckets(start, end) {
  const buckets = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay));

  if (diffDays <= 45) {
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor);
      bucketEnd.setHours(23, 59, 59, 999);
      buckets.push({
        key: bucketStart.toISOString().slice(0, 10),
        label: bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        start: bucketStart,
        end: bucketEnd,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    buckets.push({
      key: `${bucketStart.getFullYear()}-${String(bucketStart.getMonth() + 1).padStart(2, '0')}`,
      label: bucketStart.toLocaleDateString('en-US', { month: 'short' }),
      start: bucketStart,
      end: bucketEnd,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function buildSeriesRows(buckets, keys) {
  return buckets.map((bucket) => {
    const row = { label: bucket.label };
    keys.forEach((key) => {
      row[key] = 0;
    });
    return row;
  });
}

function incrementBucket(series, buckets, dateValue, key) {
  if (!dateValue) return;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return;
  const index = buckets.findIndex((bucket) => date >= bucket.start && date <= bucket.end);
  if (index >= 0) {
    series[index][key] = Number(series[index][key] || 0) + 1;
  }
}

function addBucketValue(series, buckets, dateValue, key, value) {
  if (!dateValue) return;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return;
  const index = buckets.findIndex((bucket) => date >= bucket.start && date <= bucket.end);
  if (index >= 0) {
    series[index][key] = Number(series[index][key] || 0) + Number(value || 0);
  }
}

function diffDaysFromNow(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  return `${diff} days`;
}

function classifyActivityRecord(activity) {
  const text = `${activity?.action || ''} ${activity?.description || ''} ${activity?.category || ''}`.toLowerCase();
  if (text.includes('call')) return 'calls';
  if (text.includes('mail') || text.includes('email')) return 'emails';
  if (text.includes('task')) return 'tasks';
  return null;
}

function countBy(items, keyGetter) {
  const map = new Map();
  for (const item of items) {
    const key = keyGetter(item);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

async function getReportsSummary(query = {}, user = null) {
  const filters = parseSummaryFilters(query);

  const clientsFilterForOptions = combineWhere(clientScope(user));
  const jobsFilterForOptions = combineWhere(jobScope(user));
  const recruitersFilterForOptions = userHasFullDbAccess(user)
    ? { isActive: true }
    : { id: user?.id || '__none__' };

  const jobsWhere = combineWhere(
    jobScope(user),
    dateBetween('createdAt', filters),
    filters.clientId ? { clientId: filters.clientId } : {},
    filters.jobId ? { id: filters.jobId } : {},
    filters.recruiterId ? { OR: [{ assignedToId: filters.recruiterId }, { createdById: filters.recruiterId }] } : {}
  );

  const clientsWhere = combineWhere(
    clientScope(user),
    dateBetween('createdAt', filters),
    filters.clientId ? { id: filters.clientId } : {},
    filters.recruiterId ? { assignedToId: filters.recruiterId } : {}
  );

  const candidatesWhere = combineWhere(
    candidateScope(user),
    dateBetween('createdAt', filters),
    filters.recruiterId ? { OR: [{ assignedToId: filters.recruiterId }, { createdById: filters.recruiterId }] } : {},
    filters.jobId
      ? {
          OR: [
            { assignedJobs: { has: filters.jobId } },
            { pipelineEntries: { some: { jobId: filters.jobId } } },
            { matches: { some: { jobId: filters.jobId } } },
            { interviews: { some: { jobId: filters.jobId } } },
            { placements: { some: { jobId: filters.jobId } } },
          ],
        }
      : {},
    filters.clientId
      ? {
          OR: [{ interviews: { some: { clientId: filters.clientId } } }, { placements: { some: { clientId: filters.clientId } } }],
        }
      : {}
  );

  const interviewsWhere = combineWhere(
    interviewScope(user),
    dateBetween('scheduledAt', filters),
    filters.clientId ? { clientId: filters.clientId } : {},
    filters.jobId ? { jobId: filters.jobId } : {},
    filters.recruiterId
      ? { OR: [{ interviewerId: filters.recruiterId }, { createdById: filters.recruiterId }, { panelIds: { has: filters.recruiterId } }] }
      : {}
  );

  const placementsWhere = combineWhere(
    placementScope(user),
    { deletedAt: null },
    dateBetween('createdAt', filters),
    filters.clientId ? { clientId: filters.clientId } : {},
    filters.jobId ? { jobId: filters.jobId } : {},
    filters.recruiterId ? { recruiterId: filters.recruiterId } : {}
  );

  const tasksWhere = combineWhere(
    taskScope(user),
    dateBetween('createdAt', filters),
    filters.recruiterId ? { OR: [{ assignedToId: filters.recruiterId }, { createdById: filters.recruiterId }] } : {}
  );

  const activitiesWhere = combineWhere(
    activityScope(user),
    dateBetween('createdAt', filters),
    filters.clientId ? { OR: [{ clientId: filters.clientId }, { entityId: filters.clientId }, { relatedId: filters.clientId }] } : {},
    filters.jobId ? { OR: [{ entityId: filters.jobId }, { relatedId: filters.jobId }] } : {},
    filters.recruiterId ? { performedById: filters.recruiterId } : {}
  );

  const leadsWhere = combineWhere(
    leadScope(user),
    dateBetween('createdAt', filters),
    filters.recruiterId ? { assignedToId: filters.recruiterId } : {},
    filters.clientId ? { convertedToClientId: filters.clientId } : {}
  );

  const matchesWhere = combineWhere(
    filters.jobId ? { jobId: filters.jobId } : {},
    filters.recruiterId ? { createdById: filters.recruiterId } : {},
    dateBetween('createdAt', filters)
  );

  const pipelineWhere = combineWhere(
    filters.jobId ? { jobId: filters.jobId } : {},
    dateBetween('movedAt', filters)
  );

  const billingWhere = combineWhere(
    dateBetween('createdAt', filters),
    filters.clientId ? { clientId: filters.clientId } : {},
    filters.jobId ? { placement: { jobId: filters.jobId } } : {}
  );

  const [
    jobs,
    clients,
    candidates,
    interviews,
    placements,
    tasks,
    activities,
    leads,
    matches,
    pipelineEntries,
    billingRecords,
    recruiters,
    clientOptions,
    jobOptions,
  ] = await Promise.all([
    prisma.job.findMany({
      where: jobsWhere,
      select: {
        id: true,
        title: true,
        status: true,
        location: true,
        openings: true,
        createdAt: true,
        postedDate: true,
        clientId: true,
        assignedToId: true,
        createdById: true,
        client: { select: { companyName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.client.findMany({
      where: clientsWhere,
      select: { id: true, companyName: true, status: true, industry: true, location: true, assignedToId: true, createdAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.candidate.findMany({
      where: candidatesWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        source: true,
        skills: true,
        status: true,
        createdAt: true,
        assignedToId: true,
        createdById: true,
        assignedJobs: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.interview.findMany({
      where: interviewsWhere,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        interviewerId: true,
        createdById: true,
      },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.placement.findMany({
      where: placementsWhere,
      select: {
        id: true,
        status: true,
        createdAt: true,
        joiningDate: true,
        offerDate: true,
        revenue: true,
        placementFee: true,
        fee: true,
        recruiterId: true,
        jobId: true,
        clientId: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.task.findMany({
      where: tasksWhere,
      select: { id: true, status: true, dueDate: true, createdAt: true, assignedToId: true, createdById: true },
    }),
    prisma.activity.findMany({
      where: activitiesWhere,
      select: { id: true, action: true, description: true, category: true, createdAt: true, performedById: true },
    }),
    prisma.lead.findMany({
      where: leadsWhere,
      select: { id: true, status: true, source: true, createdAt: true, assignedToId: true, companyName: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.match.findMany({
      where: matchesWhere,
      select: { id: true, jobId: true, createdById: true, createdAt: true, candidateId: true },
    }),
    prisma.pipelineEntry.findMany({
      where: pipelineWhere,
      select: { id: true, jobId: true, candidateId: true, movedAt: true, stage: { select: { name: true } } },
      orderBy: { movedAt: 'desc' },
    }),
    prisma.billingRecord.findMany({
      where: billingWhere,
      select: { id: true, amount: true, status: true, createdAt: true, invoiceDate: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: recruitersFilterForOptions,
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      where: clientsFilterForOptions,
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
      take: 200,
    }),
    prisma.job.findMany({
      where: jobsFilterForOptions,
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
      take: 200,
    }),
  ]);

  const recruiterMap = new Map(recruiters.map((userRow) => [userRow.id, userRow.name || userRow.email || 'Unknown']));
  const buckets = buildTimeBuckets(filters.start, filters.end);

  const recruitmentTrend = buildSeriesRows(buckets, ['openJobs', 'placements', 'candidates', 'interviews']);
  jobs.forEach((job) => incrementBucket(recruitmentTrend, buckets, job.createdAt || job.postedDate, 'openJobs'));
  placements.forEach((placement) => incrementBucket(recruitmentTrend, buckets, placement.createdAt, 'placements'));
  candidates.forEach((candidate) => incrementBucket(recruitmentTrend, buckets, candidate.createdAt, 'candidates'));
  interviews.forEach((interview) => incrementBucket(recruitmentTrend, buckets, interview.scheduledAt, 'interviews'));

  const latestPipelineByCandidateJob = new Map();
  pipelineEntries.forEach((entry) => {
    const key = `${entry.candidateId || ''}:${entry.jobId || ''}`;
    const previous = latestPipelineByCandidateJob.get(key);
    const currentDate = new Date(entry.movedAt || 0).getTime();
    const previousDate = previous ? new Date(previous.movedAt || 0).getTime() : -1;
    if (!previous || currentDate > previousDate) {
      latestPipelineByCandidateJob.set(key, entry);
    }
  });

  const funnelCounters = {
    Applied: 0,
    Shortlisted: 0,
    Submitted: 0,
    Interviewed: 0,
    Offered: 0,
    Joined: 0,
  };
  const stageCounts = new Map();

  [...latestPipelineByCandidateJob.values()].forEach((entry) => {
    const stageName = String(entry?.stage?.name || '').trim() || 'Unknown';
    const lower = stageName.toLowerCase();
    stageCounts.set(stageName, (stageCounts.get(stageName) || 0) + 1);
    if (lower.includes('appl') || lower.includes('new')) funnelCounters.Applied += 1;
    else if (lower.includes('short')) funnelCounters.Shortlisted += 1;
    else if (lower.includes('submit')) funnelCounters.Submitted += 1;
    else if (lower.includes('interview') || lower.includes('screen')) funnelCounters.Interviewed += 1;
    else if (lower.includes('offer')) funnelCounters.Offered += 1;
    else if (lower.includes('join') || lower.includes('hire') || lower.includes('placed')) funnelCounters.Joined += 1;
  });

  if ([...latestPipelineByCandidateJob.values()].length === 0) {
    candidates.forEach((candidate) => {
      const stage = String(candidate.status || 'NEW').toUpperCase();
      funnelCounters.Applied += 1;
      if (stage === 'ACTIVE') funnelCounters.Shortlisted += 1;
      if (stage === 'PLACED') funnelCounters.Joined += 1;
    });
  }

  const funnel = [
    { name: 'Applied', value: funnelCounters.Applied, fill: '#94a3b8' },
    { name: 'Shortlisted', value: funnelCounters.Shortlisted, fill: '#64748b' },
    { name: 'Submitted', value: funnelCounters.Submitted, fill: '#475569' },
    { name: 'Interviewed', value: funnelCounters.Interviewed, fill: '#334155' },
    { name: 'Offered', value: funnelCounters.Offered, fill: '#1e293b' },
    { name: 'Joined', value: funnelCounters.Joined, fill: '#0f172a' },
  ];

  const pipelineStageDistribution = [...stageCounts.entries()]
    .map(([name, value]) => ({ name, value, fill: '#2563eb' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const candidateCountByJob = new Map();
  pipelineEntries.forEach((entry) => {
    if (!entry.jobId || !entry.candidateId) return;
    const key = `${entry.jobId}:${entry.candidateId}`;
    candidateCountByJob.set(key, true);
  });
  const matchCountByJob = countBy(matches, (match) => match.jobId);

  const jobsTable = jobs.slice(0, 8).map((job) => {
    const pipelineUniqueCandidates = [...candidateCountByJob.keys()].filter((key) => key.startsWith(`${job.id}:`)).length;
    const candidateVolume = Math.max(pipelineUniqueCandidates, matchCountByJob.get(job.id) || 0);
    return {
      id: job.id,
      title: job.title || 'Untitled Job',
      client: job.client?.companyName || 'Unassigned Client',
      status: job.status || 'UNKNOWN',
      count: candidateVolume,
      aging: diffDaysFromNow(job.postedDate || job.createdAt),
    };
  });

  const topClients = [...countBy(jobs.filter((job) => job.client?.companyName), (job) => job.client?.companyName).entries()]
    .map(([name, volume]) => ({ name, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  const candidateSources = [...countBy(candidates, (candidate) => candidate.source || 'Unknown').entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const skillCounts = new Map();
  candidates.forEach((candidate) => {
    (candidate.skills || []).forEach((skill) => {
      const normalized = String(skill || '').trim();
      if (!normalized) return;
      skillCounts.set(normalized, (skillCounts.get(normalized) || 0) + 1);
    });
  });
  const topSkills = [...skillCounts.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxSkillCount = topSkills[0]?.count || 1;
  const candidateSkills = topSkills.map((entry) => ({
    ...entry,
    percentage: Math.round((entry.count / maxSkillCount) * 100),
  }));

  const interviewTrend = buildSeriesRows(buckets, ['scheduled', 'completed']);
  interviews.forEach((interview) => {
    incrementBucket(interviewTrend, buckets, interview.scheduledAt, 'scheduled');
    if (['COMPLETED', 'FEEDBACK_SUBMITTED'].includes(String(interview.status || '').toUpperCase())) {
      incrementBucket(interviewTrend, buckets, interview.scheduledAt, 'completed');
    }
  });

  const pendingFeedbackMap = new Map();
  interviews.forEach((interview) => {
    if (String(interview.status || '').toUpperCase() !== 'FEEDBACK_PENDING') return;
    const key = interview.interviewerId || interview.createdById;
    if (!key) return;
    pendingFeedbackMap.set(key, (pendingFeedbackMap.get(key) || 0) + 1);
  });
  const feedbackPending = [...pendingFeedbackMap.entries()]
    .map(([userId, pending]) => ({ userId, name: recruiterMap.get(userId) || 'Unknown', pending }))
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 8);

  const totalRevenue = placements.reduce((sum, placement) => sum + Number(placement.revenue || 0), 0);
  const totalPlacements = placements.filter((placement) => !['CANCELLED', 'FAILED', 'DROPPED', 'WITHDRAWN'].includes(String(placement.status || '').toUpperCase())).length;
  const avgBilling = billingRecords.length
    ? billingRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0) / billingRecords.length
    : 0;
  const placementRevenueTrend = buildSeriesRows(buckets, ['revenue']);
  placements.forEach((placement) => addBucketValue(placementRevenueTrend, buckets, placement.createdAt || placement.joiningDate, 'revenue', placement.revenue || 0));

  const jobsHandledByRecruiter = new Map();
  jobs.forEach((job) => {
    [job.assignedToId, job.createdById].filter(Boolean).forEach((uid) => {
      jobsHandledByRecruiter.set(uid, (jobsHandledByRecruiter.get(uid) || 0) + 1);
    });
  });
  const submissionsByRecruiter = countBy(matches, (match) => match.createdById);
  const interviewsByRecruiter = new Map();
  interviews.forEach((interview) => {
    [interview.interviewerId, interview.createdById].filter(Boolean).forEach((uid) => {
      interviewsByRecruiter.set(uid, (interviewsByRecruiter.get(uid) || 0) + 1);
    });
  });
  const placementsByRecruiter = countBy(placements, (placement) => placement.recruiterId);

  const leaderboard = recruiters
    .map((recruiter) => ({
      id: recruiter.id,
      name: recruiter.name || recruiter.email || 'Unknown',
      jobs: jobsHandledByRecruiter.get(recruiter.id) || 0,
      submissions: submissionsByRecruiter.get(recruiter.id) || 0,
      interviews: interviewsByRecruiter.get(recruiter.id) || 0,
      placements: placementsByRecruiter.get(recruiter.id) || 0,
    }))
    .sort((a, b) => b.placements - a.placements || b.submissions - a.submissions || b.jobs - a.jobs)
    .map((row, index) => ({ ...row, rank: index + 1 }))
    .slice(0, 12);

  const activityTrend = buildSeriesRows(buckets, ['calls', 'emails', 'tasks']);
  let callsMade = 0;
  let emailsSent = 0;
  activities.forEach((activity) => {
    const kind = classifyActivityRecord(activity);
    if (!kind) return;
    if (kind === 'calls') callsMade += 1;
    if (kind === 'emails') emailsSent += 1;
    incrementBucket(activityTrend, buckets, activity.createdAt, kind);
  });
  tasks.forEach((task) => {
    incrementBucket(activityTrend, buckets, task.createdAt, 'tasks');
  });
  const tasksCompleted = tasks.filter((task) => String(task.status || '').toUpperCase() === 'DONE').length;
  const overdueTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    return due < new Date() && !['DONE', 'CANCELLED'].includes(String(task.status || '').toUpperCase());
  }).length;

  const openJobsCount = jobs.filter((job) => ['OPEN', 'DRAFT', 'ON_HOLD'].includes(String(job.status || '').toUpperCase())).length;
  const activeCandidatesCount = candidates.filter((candidate) => ['ACTIVE', 'NEW'].includes(String(candidate.status || '').toUpperCase())).length;
  const interviewCount = interviews.length;
  const offersReleased = placements.filter((placement) => placement.offerDate).length;
  const conversionPct = activeCandidatesCount > 0 ? ((totalPlacements / activeCandidatesCount) * 100).toFixed(1) : '0.0';

  return {
    filters,
    options: {
      dateRanges: [
        { value: 'last_7_days', label: 'Last 7 Days' },
        { value: 'last_30_days', label: 'Last 30 Days' },
        { value: 'this_month', label: 'This Month' },
        { value: 'this_quarter', label: 'This Quarter' },
        { value: 'this_year', label: 'This Year' },
      ],
      clients: clientOptions.map((client) => ({ id: client.id, name: client.companyName })),
      jobs: jobOptions.map((job) => ({ id: job.id, name: job.title })),
      recruiters: recruiters.map((recruiter) => ({ id: recruiter.id, name: recruiter.name || recruiter.email || 'Unknown' })),
    },
    recruitmentPerformance: {
      kpis: {
        totalOpenJobs: openJobsCount,
        activeCandidates: activeCandidatesCount,
        interviews: interviewCount,
        offersReleased,
        placements: totalPlacements,
        conversionPct: Number(conversionPct),
      },
      trend: recruitmentTrend,
    },
    pipelineFunnel: {
      funnel,
      stageDistribution: pipelineStageDistribution,
    },
    jobsClients: {
      jobs: jobsTable,
      topClients,
    },
    candidates: {
      sources: candidateSources,
      skills: candidateSkills,
    },
    interviews: {
      trend: interviewTrend,
      feedbackPending,
    },
    placementsRevenue: {
      kpis: {
        totalPlacements,
        totalRevenue,
        avgBilling,
      },
      trend: placementRevenueTrend,
    },
    teamPerformance: {
      leaderboard,
    },
    activityProductivity: {
      kpis: {
        callsMade,
        emailsSent,
        tasksCompleted,
        overdueTasks,
      },
      trend: activityTrend,
    },
  };
}

function tabToDatasetRows(tabKey, summary) {
  switch (String(tabKey || '').toLowerCase()) {
    case 'recruitment-performance':
      return {
        title: 'Recruitment Performance',
        columns: ['Label', 'Open Jobs', 'Placements', 'Candidates', 'Interviews'],
        rows: (summary.recruitmentPerformance?.trend || []).map((row) => ({
          Label: row.label,
          'Open Jobs': row.openJobs,
          Placements: row.placements,
          Candidates: row.candidates,
          Interviews: row.interviews,
        })),
      };
    case 'pipeline-funnel':
      return {
        title: 'Pipeline & Funnel',
        columns: ['Stage', 'Count'],
        rows: (summary.pipelineFunnel?.funnel || []).map((row) => ({
          Stage: row.name,
          Count: row.value,
        })),
      };
    case 'jobs-clients':
      return {
        title: 'Jobs & Clients',
        columns: ['Title', 'Client', 'Status', 'Candidates', 'Aging'],
        rows: (summary.jobsClients?.jobs || []).map((row) => ({
          Title: row.title,
          Client: row.client,
          Status: row.status,
          Candidates: row.count,
          Aging: row.aging,
        })),
      };
    case 'candidates':
      return {
        title: 'Candidates',
        columns: ['Source', 'Count'],
        rows: (summary.candidates?.sources || []).map((row) => ({
          Source: row.name,
          Count: row.value,
        })),
      };
    case 'interviews':
      return {
        title: 'Interviews',
        columns: ['Label', 'Scheduled', 'Completed'],
        rows: (summary.interviews?.trend || []).map((row) => ({
          Label: row.label,
          Scheduled: row.scheduled,
          Completed: row.completed,
        })),
      };
    case 'placements-revenue':
      return {
        title: 'Placements & Revenue',
        columns: ['Label', 'Revenue'],
        rows: (summary.placementsRevenue?.trend || []).map((row) => ({
          Label: row.label,
          Revenue: row.revenue,
        })),
      };
    case 'team-performance':
      return {
        title: 'Team Performance',
        columns: ['Rank', 'Recruiter', 'Jobs Handled', 'Submissions', 'Interviews', 'Placements'],
        rows: (summary.teamPerformance?.leaderboard || []).map((row) => ({
          Rank: row.rank,
          Recruiter: row.name,
          'Jobs Handled': row.jobs,
          Submissions: row.submissions,
          Interviews: row.interviews,
          Placements: row.placements,
        })),
      };
    case 'activity-productivity':
      return {
        title: 'Activity & Productivity',
        columns: ['Label', 'Calls', 'Emails', 'Tasks'],
        rows: (summary.activityProductivity?.trend || []).map((row) => ({
          Label: row.label,
          Calls: row.calls,
          Emails: row.emails,
          Tasks: row.tasks,
        })),
      };
    default:
      return {
        title: 'Report',
        columns: [],
        rows: [],
      };
  }
}

function buildFileFromDataset(dataset, entity, format) {
  const normalizedEntity = normalizeEntity(entity);
  const normalizedFormat = normalizeFormat(format);

  if (!Array.isArray(dataset.rows) || dataset.rows.length === 0) {
    return {
      ok: false,
      error: 'No data available for this report',
      entity: normalizedEntity,
      format: normalizedFormat,
    };
  }

  ensureExportDir();
  const fileBase = `${fileSlug(normalizedEntity)}-${normalizedFormat}-${Date.now()}`;

  if (normalizedFormat === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(dataset.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    const filePath = path.join(EXPORT_DIR, `${fileBase}.xlsx`);
    XLSX.writeFile(workbook, filePath);
    return {
      ok: true,
      entity: normalizedEntity,
      format: normalizedFormat,
      fileName: `${fileBase}.xlsx`,
      filePath,
      fileUrl: toPublicUploadUrl(filePath),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: dataset.title,
      summary: `Total records: ${dataset.rows.length}`,
      columns: dataset.columns,
      rowCount: dataset.rows.length,
    };
  }

  if (normalizedFormat === 'csv') {
    const headers = Object.keys(dataset.rows[0] || {});
    const csv = [
      headers.join(','),
      ...dataset.rows.map((row) =>
        headers.map((header) => `"${String(row?.[header] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    const filePath = path.join(EXPORT_DIR, `${fileBase}.csv`);
    fs.writeFileSync(filePath, csv, 'utf8');
    return {
      ok: true,
      entity: normalizedEntity,
      format: normalizedFormat,
      fileName: `${fileBase}.csv`,
      filePath,
      fileUrl: toPublicUploadUrl(filePath),
      contentType: 'text/csv',
      title: dataset.title,
      summary: `Total records: ${dataset.rows.length}`,
      columns: dataset.columns,
      rowCount: dataset.rows.length,
    };
  }

  if (normalizedFormat === 'pdf') {
    const lines = [
      `Summary: Total records ${dataset.rows.length}`,
      'Table preview:',
      ...dataset.rows.slice(0, 20).map((row, index) => `${index + 1}. ${JSON.stringify(row)}`),
    ];
    const buffer = createSimplePdfBuffer(dataset.title, lines);
    const filePath = path.join(EXPORT_DIR, `${fileBase}.pdf`);
    fs.writeFileSync(filePath, buffer);
    return {
      ok: true,
      entity: normalizedEntity,
      format: normalizedFormat,
      fileName: `${fileBase}.pdf`,
      filePath,
      fileUrl: toPublicUploadUrl(filePath),
      contentType: 'application/pdf',
      title: dataset.title,
      summary: `Total records: ${dataset.rows.length}`,
      columns: dataset.columns,
      rowCount: dataset.rows.length,
    };
  }

  return {
    ok: false,
    error: 'File generation service is not configured yet',
    entity: normalizedEntity,
    format: normalizedFormat,
  };
}

async function buildWhereForEntity(entity, query, user) {
  const assignedToId = await resolveUserId(query.assignedTo || query.assignedToId || query.owner);
  const createdAt = dateRangeFilter(query.dateRange);
  const search = String(query.search || '').trim();
  const location = String(query.location || '').trim();
  const status = String(query.status || '').trim();

  switch (entity) {
    case 'leads': {
      const where = userHasFullDbAccess(user) ? {} : { assignedToId: user?.id || '__none__' };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status) where.status = status;
      if (search || location) {
        where.OR = [
          ...buildTextSearchConditions(
            ['companyName', 'contactPerson', 'email', 'website', 'linkedIn', 'directorName'],
            search,
            ['companyLinks']
          ),
          ...buildTextSearchConditions(['location', 'city', 'country'], location),
        ].filter(Boolean);
      }
      return where;
    }
    case 'clients': {
      const where = userHasFullDbAccess(user) ? {} : { assignedToId: user?.id || '__none__' };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status) where.status = status;
      if (search || location) {
        where.OR = [
          ...buildTextSearchConditions(['companyName', 'industry', 'website', 'linkedin', 'hiringLocations'], search),
          ...buildTextSearchConditions(['location'], location),
        ].filter(Boolean);
      }
      return where;
    }
    case 'candidates': {
      const where = userHasFullDbAccess(user)
        ? {}
        : { OR: [{ assignedToId: user?.id || '__none__' }, { createdById: user?.id || '__none__' }] };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status) where.status = status;
      if (search || location) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          ...buildTextSearchConditions(['firstName', 'lastName', 'email', 'currentTitle', 'currentCompany'], search),
          ...buildTextSearchConditions(['location', 'city', 'country'], location),
        ].filter(Boolean);
      }
      return where;
    }
    case 'jobs': {
      const where = userHasFullDbAccess(user)
        ? {}
        : { OR: [{ assignedToId: user?.id || '__none__' }, { createdById: user?.id || '__none__' }] };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status) where.status = status;
      if (search || location) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          ...buildTextSearchConditions(['title', 'department', 'overview', 'hiringManager'], search),
          ...buildTextSearchConditions(['location'], location),
        ].filter(Boolean);
      }
      return where;
    }
    case 'tasks': {
      const where = userHasFullDbAccess(user)
        ? {}
        : { OR: [{ assignedToId: user?.id || '__none__' }, { createdById: user?.id || '__none__' }] };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          { title: searchContains(search) },
          { description: searchContains(search) },
        ];
      }
      return where;
    }
    case 'placements': {
      const where = userHasFullDbAccess(user)
        ? { deletedAt: null }
        : {
            deletedAt: null,
            OR: [
              { recruiterId: user?.id || '__none__' },
              { job: { OR: [{ createdById: user?.id || '__none__' }, { assignedToId: user?.id || '__none__' }] } },
            ],
          };
      if (assignedToId) where.recruiterId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status) where.status = status.toUpperCase();
      return where;
    }
    case 'interviews': {
      const where = userHasFullDbAccess(user)
        ? {}
        : { OR: [{ createdById: user?.id || '__none__' }, { interviewerId: user?.id || '__none__' }] };
      if (assignedToId) where.interviewerId = assignedToId;
      if (createdAt) where.scheduledAt = createdAt;
      if (status) where.status = status.toUpperCase();
      if (search || location) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          search ? { round: searchContains(search) } : null,
          search ? { notes: searchContains(search) } : null,
          location ? { location: searchContains(location) } : null,
        ].filter(Boolean);
      }
      return where;
    }
    case 'pipeline': {
      const where = {};
      if (createdAt) where.createdAt = createdAt;
      if (search) {
        where.OR = [
          { notes: searchContains(search) },
          { stage: { name: searchContains(search) } },
          { candidate: { firstName: searchContains(search) } },
          { candidate: { lastName: searchContains(search) } },
        ];
      }
      return where;
    }
    case 'team': {
      const where = { isActive: true };
      if (search || location) {
        where.OR = [
          search ? { name: searchContains(search) } : null,
          search ? { email: searchContains(search) } : null,
          search ? { department: searchContains(search) } : null,
          location ? { location: searchContains(location) } : null,
        ].filter(Boolean);
      }
      return where;
    }
    default:
      throw new Error(`Unsupported export entity: ${entity}`);
  }
}

export async function fetchReportDataset(entity, query = {}, user = null) {
  const normalizedEntity = normalizeEntity(entity);
  const where = await buildWhereForEntity(normalizedEntity, query, user);

  switch (normalizedEntity) {
    case 'leads': {
      const rows = await prisma.lead.findMany({
        where,
        include: {
          assignedTo: { select: { name: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Leads Report',
        columns: ['Name', 'Email', 'Phone', 'Location', 'Status', 'Assigned To', 'Created Date'],
        rows: rows.map((lead) => ({
          Name: lead.contactPerson || lead.companyName || '',
          Email: lead.email || '',
          Phone: lead.phone || '',
          Location: lead.location || lead.city || '',
          Status: lead.status || '',
          'Assigned To': lead.assignedTo?.name || '',
          'Created Date': formatDate(lead.createdAt),
          'Updated Date': formatDate(lead.updatedAt),
          'Company Name': lead.companyName || '',
          'Contact Person': lead.contactPerson || '',
          'Director Name': lead.directorName || '',
          Source: lead.source || '',
          Priority: lead.priority || '',
          Type: lead.type || '',
          Industry: lead.industry || '',
          Sector: lead.sector || '',
          'Company Size': lead.companySize || '',
          'Team Name': lead.teamName || '',
          Website: lead.website || '',
          'Company Links': formatArray(lead.companyLinks),
          LinkedIn: lead.linkedIn || '',
          Designation: lead.designation || '',
          Country: lead.country || '',
          City: lead.city || '',
          'Interested Needs': lead.interestedNeeds || '',
          'Services Needed': lead.servicesNeeded || '',
          Notes: lead.notes || '',
          'Expected Business Value': lead.expectedBusinessValue || '',
          'Campaign Name': lead.campaignName || '',
          'Campaign Link': lead.campaignLink || '',
          'Referral Name': lead.referralName || '',
          'Source Website URL': lead.sourceWebsiteUrl || '',
          'Source LinkedIn URL': lead.sourceLinkedInUrl || '',
          'Source Email': lead.sourceEmail || '',
          'Other Details': formatJson(lead.otherDetails),
          'Last Follow Up': formatDate(lead.lastFollowUp),
          'Next Follow Up': formatDate(lead.nextFollowUp),
          'Lost Reason': lead.lostReason || '',
          'Converted To Client Id': lead.convertedToClientId || '',
          'Converted To Candidate Id': lead.convertedToCandidateId || '',
          'Converted At': formatDate(lead.convertedAt),
        })),
      };
    }
    case 'clients': {
      const rows = await prisma.client.findMany({
        where,
        include: {
          assignedTo: { select: { name: true, email: true } },
          contacts: {
            select: { firstName: true, lastName: true, email: true, phone: true, designation: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Clients Report',
        columns: ['Company Name', 'Contact', 'Email', 'Owner'],
        rows: rows.map((client) => {
          const contactNames = (client.contacts || [])
            .map((contact) => `${contact.firstName || ''} ${contact.lastName || ''}`.trim())
            .filter(Boolean);
          return {
            'Company Name': client.companyName || '',
            Contact: contactNames.join(', '),
            Email: (client.contacts || []).map((contact) => contact.email).filter(Boolean).join(', '),
            Owner: client.assignedTo?.name || '',
            Industry: client.industry || '',
            Location: client.location || '',
            Status: client.status || '',
            Website: client.website || '',
            Priority: client.priority || '',
            'Created Date': formatDate(client.createdAt),
            'Updated Date': formatDate(client.updatedAt),
            'Company Size': client.companySize || '',
            'Hiring Locations': client.hiringLocations || '',
            LinkedIn: client.linkedin || '',
            Timezone: client.timezone || '',
            'Client Since': formatDate(client.clientSince),
            'Services Needed': client.servicesNeeded || '',
            'Expected Business Value': client.expectedBusinessValue || '',
            'Lead Status': client.leadStatus || '',
            SLA: client.sla || '',
            'Next Follow Up Due': formatDate(client.nextFollowUpDue),
            'Avg Time To Fill': client.avgTimeToFill || '',
            'Health Status': client.healthStatus || '',
            'Revenue Generated': client.revenueGenerated || '',
            'Billing Total Revenue': client.billingTotalRevenue || '',
            'Billing Outstanding': client.billingOutstanding || '',
            'Billing Paid': client.billingPaid || '',
            'Last Activity': formatDateTime(client.lastActivity),
            'Stale Jobs Count': client.staleJobsCount || 0,
            'Pending Invoices Count': client.pendingInvoicesCount || 0,
            'Billing Overdue Count': client.billingOverdueCount || 0,
            'Candidates In Progress': client.candidatesInProgress || 0,
            'Interviews This Week': client.interviewsThisWeek || 0,
            'Placements This Month': client.placementsThisMonth || 0,
            Address: formatJson(client.address),
            'Contact Phones': (client.contacts || []).map((contact) => contact.phone).filter(Boolean).join(', '),
            'Contact Designations': (client.contacts || [])
              .map((contact) => contact.designation)
              .filter(Boolean)
              .join(', '),
          };
        }),
      };
    }
    case 'candidates': {
      const rows = await prisma.candidate.findMany({
        where,
        include: {
          assignedTo: { select: { name: true, email: true } },
          createdBy: { select: { name: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Candidates Report',
        columns: ['Name', 'Skills', 'Status', 'Job'],
        rows: rows.map((candidate) => ({
          Name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
          Skills: Array.isArray(candidate.skills) ? candidate.skills.join(', ') : '',
          Status: candidate.status || '',
          Job: Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs.join(', ') : '',
          Email: candidate.email || '',
          Phone: candidate.phone || '',
          LinkedIn: candidate.linkedIn || '',
          Stage: candidate.stage || '',
          Location: candidate.location || '',
          Title: candidate.currentTitle || '',
          Company: candidate.currentCompany || '',
          Experience: candidate.experience || '',
          Address: candidate.address || '',
          City: candidate.city || '',
          Country: candidate.country || '',
          Source: candidate.source || '',
          Rating: candidate.rating || '',
          Availability: candidate.availability || '',
          'Notice Period': candidate.noticePeriod || '',
          Hotlist: candidate.hotlist ? 'Yes' : 'No',
          Designation: candidate.designation || '',
          'Expected Salary': candidate.expectedSalary || '',
          'Current Salary': candidate.currentSalary || '',
          Education: candidate.education || '',
          Certifications: formatArray(candidate.certifications),
          Languages: formatArray(candidate.languages),
          Portfolio: candidate.portfolio || '',
          Website: candidate.website || '',
          Notes: candidate.notes || '',
          'CV Summary': candidate.cvSummary || '',
          'Preferred Location': candidate.preferredLocation || '',
          'Assigned Recruiter': candidate.assignedTo?.name || '',
          'Created By': candidate.createdBy?.name || '',
          'Created Date': formatDate(candidate.createdAt),
          'Updated Date': formatDate(candidate.updatedAt),
        })),
      };
    }
    case 'jobs': {
      const rows = await prisma.job.findMany({
        where,
        include: {
          client: { select: { companyName: true } },
          assignedTo: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Jobs Report',
        columns: ['Title', 'Client', 'Status', 'Location', 'Owner'],
        rows: rows.map((job) => ({
          Title: job.title || '',
          Client: job.client?.companyName || '',
          Status: job.status || '',
          Location: job.location || '',
          Owner: job.assignedTo?.name || '',
          Type: job.type || '',
          Openings: job.openings || '',
          Department: job.department || '',
          Description: job.description || '',
          Requirements: formatArray(job.requirements),
          Skills: formatArray(job.skills),
          Overview: job.overview || '',
          'Key Responsibilities': formatArray(job.keyResponsibilities),
          'Preferred Skills': formatArray(job.preferredSkills),
          'Experience Required': job.experienceRequired || '',
          Education: job.education || '',
          Benefits: formatArray(job.benefits),
          'Posted Date': formatDate(job.postedDate),
          'Hiring Manager': job.hiringManager || '',
          'Job Category': job.jobCategory || '',
          'Location Type': job.jobLocationType || '',
          Hot: job.hot ? 'Yes' : 'No',
          'AI Match': job.aiMatch ? 'Yes' : 'No',
          'No Candidates': job.noCandidates ? 'Yes' : 'No',
          'SLA Risk': job.slaRisk ? 'Yes' : 'No',
          'Expected Closure Date': formatDate(job.expectedClosureDate),
          'JD File Name': job.jdFileName || '',
          'Work Mode': job.workMode || '',
          Priority: job.priority || '',
          Visibility: job.visibility || '',
          'Distribution Platforms': formatJson(job.distributionPlatforms),
          'Supporting Recruiters': formatArray(job.supportingRecruiters),
          'Application Form Enabled': job.applicationFormEnabled ? 'Yes' : 'No',
          'Application Form Logo': job.applicationFormLogo || '',
          'Application Form Questions': formatArray(job.applicationFormQuestions),
          'Application Form Note': job.applicationFormNote || '',
          Salary: formatJson(job.salary),
          'Created Date': formatDate(job.createdAt),
          'Updated Date': formatDate(job.updatedAt),
        })),
      };
    }
    case 'tasks': {
      const rows = await prisma.task.findMany({
        where,
        include: {
          assignedTo: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Tasks Report',
        columns: ['Title', 'Status', 'Priority', 'Assigned To', 'Due Date'],
        rows: rows.map((task) => ({
          Title: task.title || '',
          Status: task.status || '',
          Priority: task.priority || '',
          'Assigned To': task.assignedTo?.name || '',
          'Due Date': formatDate(task.dueDate),
          Type: task.taskType || '',
          Description: task.description || '',
          'Created By': task.createdBy?.name || '',
          'Due Time': task.dueTime || '',
          'Linked Entity Type': task.linkedEntityType || '',
          'Linked Entity Id': task.linkedEntityId || '',
          Reminder: task.reminder || '',
          'Reminder Channel': task.reminderChannel || '',
          Attachments: formatArray(task.attachments),
          'Notify Assignee': task.notifyAssignee ? 'Yes' : 'No',
          Notes: formatArray(task.notes),
          'Created Date': formatDate(task.createdAt),
          'Updated Date': formatDate(task.updatedAt),
        })),
      };
    }
    case 'placements': {
      const rows = await prisma.placement.findMany({
        where,
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          client: { select: { companyName: true } },
          job: { select: { title: true } },
          recruiter: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Placements Report',
        columns: ['Candidate', 'Client', 'Job', 'Status', 'Recruiter'],
        rows: rows.map((placement) => ({
          Candidate: `${placement.candidate?.firstName || ''} ${placement.candidate?.lastName || ''}`.trim(),
          Client: placement.client?.companyName || '',
          Job: placement.job?.title || '',
          Status: placement.status || '',
          Recruiter: placement.recruiter?.name || '',
          Salary: placement.salaryOffered || placement.salary || '',
          Fee: placement.placementFee || placement.fee || '',
          Revenue: placement.revenue || '',
          'Offer Date': formatDate(placement.offerDate),
          'Joining Date': formatDate(placement.joiningDate),
          'Start Date': formatDate(placement.startDate),
          'End Date': formatDate(placement.endDate),
          'Actual Joining Date': formatDate(placement.actualJoiningDate),
          'Fee Type': placement.feeType || '',
          'Commission Percentage': placement.commissionPercentage || '',
          'Failure Reason': placement.failureReason || '',
          'Billing Status': placement.billingStatus || '',
          'Warranty Days Left': placement.warrantyDaysLeft || '',
          'Employment Type': placement.employmentType || '',
          Notes: placement.notes || '',
          'Candidate Email': placement.candidate?.email || '',
        })),
      };
    }
    case 'interviews': {
      const rows = await prisma.interview.findMany({
        where,
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true } },
          interviewer: { select: { name: true } },
        },
        orderBy: { scheduledAt: 'desc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Interviews Report',
        columns: ['Candidate', 'Job', 'Status', 'Scheduled At', 'Interviewer'],
        rows: rows.map((interview) => ({
          Candidate: `${interview.candidate?.firstName || ''} ${interview.candidate?.lastName || ''}`.trim(),
          Job: interview.job?.title || '',
          Status: interview.status || '',
          'Scheduled At': formatDateTime(interview.scheduledAt),
          Interviewer: interview.interviewer?.name || '',
          Type: interview.type || '',
          Mode: interview.mode || '',
          Round: interview.round || '',
          Duration: interview.duration || '',
          Platform: interview.platform || '',
          Location: interview.location || '',
          'Meeting Link': interview.meetingLink || '',
          Notes: interview.notes || '',
          Timezone: interview.timezone || '',
          Instructions: interview.instructions || '',
          'Created Date': formatDate(interview.createdAt),
          'Updated Date': formatDate(interview.updatedAt),
        })),
      };
    }
    case 'pipeline': {
      const rows = await prisma.pipelineEntry.findMany({
        where,
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          stage: {
            select: {
              name: true,
              job: {
                select: {
                  title: true,
                  location: true,
                  status: true,
                },
              },
            },
          },
          movedBy: { select: { name: true } },
        },
        orderBy: { movedAt: 'desc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Pipeline Report',
        columns: ['Candidate', 'Stage', 'Moved By', 'Moved At'],
        rows: rows.map((entry) => ({
          Candidate: `${entry.candidate?.firstName || ''} ${entry.candidate?.lastName || ''}`.trim(),
          Stage: entry.stage?.name || '',
          'Moved By': entry.movedBy?.name || '',
          'Moved At': formatDateTime(entry.movedAt),
          Email: entry.candidate?.email || '',
          Job: entry.stage?.job?.title || '',
          'Job Status': entry.stage?.job?.status || '',
          'Job Location': entry.stage?.job?.location || '',
          Notes: entry.notes || '',
          'Created Date': formatDate(entry.createdAt),
          'Updated Date': formatDate(entry.updatedAt),
        })),
      };
    }
    case 'team': {
      const rows = await prisma.user.findMany({
        where,
        include: {
          _count: {
            select: { assignedLeads: true, assignedClientsRel: true, assignedTasks: true, assignedJobsRel: true },
          },
        },
        orderBy: { name: 'asc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Team Performance Report',
        columns: ['Name', 'Email', 'Role', 'Assigned Leads', 'Assigned Clients', 'Assigned Tasks', 'Assigned Jobs'],
        rows: rows.map((member) => ({
          Name: member.name || '',
          Email: member.email || '',
          Role: member.role || '',
          Department: member.department || '',
          Designation: member.designation || '',
          'Assigned Leads': member._count?.assignedLeads || 0,
          'Assigned Clients': member._count?.assignedClientsRel || 0,
          'Assigned Tasks': member._count?.assignedTasks || 0,
          'Assigned Jobs': member._count?.assignedJobsRel || 0,
        })),
      };
    }
    default:
      throw new Error(`Unsupported export entity: ${normalizedEntity}`);
  }
}

export async function buildReportFile(entity, format, query = {}, user = null) {
  const normalizedEntity = normalizeEntity(entity);
  const dataset = await fetchReportDataset(normalizedEntity, query, user);
  return buildFileFromDataset(dataset, normalizedEntity, format);
}

export const reportService = {
  async getSummary(query, user) {
    return getReportsSummary(query, user);
  },

  async getDataset(entity, query, user) {
    const dataset = await fetchReportDataset(entity, query, user);
    const selectedColumns = String(query?.columns || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!selectedColumns.length) return dataset;

    const columnSet = new Set(selectedColumns);
    return {
      ...dataset,
      columns: dataset.columns.filter((column) => columnSet.has(column)),
      rows: dataset.rows.map((row) =>
        Object.fromEntries(Object.entries(row).filter(([key]) => columnSet.has(key)))
      ),
    };
  },

  async exportSummaryTab(tab, format, query, user) {
    const summary = await getReportsSummary(query, user);
    const dataset = tabToDatasetRows(tab, summary);
    return buildFileFromDataset(dataset, `summary-${tab}`, format);
  },

  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { type, generatedById } = req.query;

    const where = {};
    if (type) where.type = type;
    if (generatedById) where.generatedById = generatedById;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        include: {
          generatedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.report.count({ where }),
    ]);

    return formatPaginationResponse(reports, page, limit, total);
  },

  async getById(id) {
    return prisma.report.findUnique({
      where: { id },
      include: {
        generatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(data) {
    return prisma.report.create({
      data: {
        name: data.name,
        type: data.type,
        filters: data.filters,
        generatedById: data.generatedById,
        result: data.result,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });
  },

  async update(id, data) {
    return prisma.report.update({
      where: { id },
      data: {
        name: data.name,
        filters: data.filters,
        result: data.result,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    });
  },

  async delete(id) {
    await prisma.report.delete({ where: { id } });
    return { message: 'Report deleted successfully' };
  },

  async exportEntity(entity, format, query, user) {
    return buildReportFile(entity, format, query, user);
  },
};
