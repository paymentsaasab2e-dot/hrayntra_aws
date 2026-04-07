import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { leadService } from '../lead/lead.service.js';
import { clientService } from '../client/client.service.js';
import { jobService } from '../job/job.service.js';
import { candidateService } from '../candidate/candidate.service.js';
import { pipelineService } from '../pipeline/pipeline.service.js';
import { taskService } from '../task/task.service.js';
import { placementService } from '../placement/placement.service.js';

const MAX_ROWS = 80;
const DEFAULT_ROWS = 28;
const MAX_JSON_CHARS = 16000;
const REPORTS_DIR = path.join(process.cwd(), 'uploads', 'assistant-reports');

/**
 * When `ASSISTANT_FULL_DB_ACCESS=true`, any authenticated user can read all rows (single-tenant / demo only).
 * Otherwise: SUPER_ADMIN & ADMIN see org-wide data; other roles see records they own, are assigned to, or created.
 */
export function userHasFullDbAccess(user) {
  if (env.ASSISTANT_FULL_DB_ACCESS === 'true') return true;
  const r = user?.role;
  return r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'MANAGER';
}

function limitRows(n) {
  const x = parseInt(String(n), 10);
  if (Number.isNaN(x)) return DEFAULT_ROWS;
  return Math.min(Math.max(x, 1), MAX_ROWS);
}

export function safeSerialize(obj) {
  const str = JSON.stringify(obj, (_, v) => (v instanceof Date ? v.toISOString() : v));
  if (str.length <= MAX_JSON_CHARS) return str;
  return `${str.slice(0, MAX_JSON_CHARS)}\n...[truncated ${str.length - MAX_JSON_CHARS} chars]`;
}

function ensureReportsDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
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
  const safeLines = [title, ...lines].filter(Boolean).slice(0, 30);
  const contentLines = ['BT', '/F1 14 Tf', '50 780 Td'];

  safeLines.forEach((line, index) => {
    if (index === 0) {
      contentLines.push(`(${escapePdfText(line)}) Tj`);
    } else {
      contentLines.push('0 -22 Td');
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

function mergeScope(scope, extra) {
  if (!extra || Object.keys(extra).length === 0) return scope || {};
  if (!scope || Object.keys(scope).length === 0) return extra;
  return { AND: [scope, extra] };
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
  return { OR: [{ createdById: uid }, { assignedToId: uid }] };
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

function interviewScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return {
    OR: [{ createdById: uid }, { interviewerId: uid }, { panelIds: { has: uid } }],
  };
}

function taskScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ assignedToId: uid }, { createdById: uid }] };
}

function textOr(fields, term) {
  if (!term || !String(term).trim()) return {};
  const q = String(term).trim();
  return {
    OR: fields.map((field) => ({
      [field]: { contains: q },
    })),
  };
}

const LEAD_FULL_SELECT = {
  id: true,
  companyName: true,
  contactPerson: true,
  directorName: true,
  email: true,
  phone: true,
  type: true,
  source: true,
  status: true,
  priority: true,
  interestedNeeds: true,
  servicesNeeded: true,
  notes: true,
  expectedBusinessValue: true,
  industry: true,
  sector: true,
  companySize: true,
  teamName: true,
  website: true,
  companyLinks: true,
  linkedIn: true,
  location: true,
  designation: true,
  country: true,
  city: true,
  campaignName: true,
  campaignLink: true,
  referralName: true,
  sourceWebsiteUrl: true,
  sourceLinkedInUrl: true,
  sourceEmail: true,
  otherDetails: true,
  lastFollowUp: true,
  nextFollowUp: true,
  lostReason: true,
  assignedToId: true,
  convertedToClientId: true,
  convertedToCandidateId: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  client: { select: { id: true, companyName: true, status: true } },
  noteList: {
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  files: {
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileUrl: true,
      uploadDate: true,
    },
    take: 10,
    orderBy: { uploadDate: 'desc' },
  },
};

const CLIENT_FULL_SELECT = {
  id: true,
  companyName: true,
  industry: true,
  website: true,
  logo: true,
  location: true,
  status: true,
  assignedToId: true,
  companySize: true,
  hiringLocations: true,
  linkedin: true,
  timezone: true,
  clientSince: true,
  servicesNeeded: true,
  expectedBusinessValue: true,
  leadStatus: true,
  priority: true,
  sla: true,
  nextFollowUpDue: true,
  avgTimeToFill: true,
  healthStatus: true,
  revenueGenerated: true,
  billingTotalRevenue: true,
  billingOutstanding: true,
  billingPaid: true,
  lastActivity: true,
  staleJobsCount: true,
  pendingInvoicesCount: true,
  billingOverdueCount: true,
  candidatesInProgress: true,
  interviewsThisWeek: true,
  placementsThisMonth: true,
  address: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  contacts: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      designation: true,
      contactType: true,
      status: true,
    },
    take: 10,
  },
  jobs: {
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
      location: true,
      openings: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  leads: {
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
      status: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  placements: {
    select: {
      id: true,
      status: true,
      joiningDate: true,
      revenue: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  billingRecords: {
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      dueDate: true,
      paidAt: true,
      invoiceNumber: true,
      invoiceDate: true,
      createdAt: true,
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  },
  interviews: {
    select: {
      id: true,
      status: true,
      type: true,
      round: true,
      scheduledAt: true,
    },
    take: 10,
    orderBy: { scheduledAt: 'desc' },
  },
  notes: {
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  files: {
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileUrl: true,
      uploadDate: true,
    },
    take: 10,
    orderBy: { uploadDate: 'desc' },
  },
};

const JOB_FULL_SELECT = {
  id: true,
  title: true,
  description: true,
  requirements: true,
  skills: true,
  location: true,
  type: true,
  status: true,
  clientId: true,
  assignedToId: true,
  createdById: true,
  openings: true,
  overview: true,
  keyResponsibilities: true,
  preferredSkills: true,
  experienceRequired: true,
  education: true,
  benefits: true,
  postedDate: true,
  hiringManager: true,
  hiringManagerId: true,
  department: true,
  jobCategory: true,
  jobLocationType: true,
  hot: true,
  aiMatch: true,
  noCandidates: true,
  slaRisk: true,
  expectedClosureDate: true,
  jdFileName: true,
  workMode: true,
  priority: true,
  visibility: true,
  distributionPlatforms: true,
  supportingRecruiters: true,
  applicationFormEnabled: true,
  applicationFormLogo: true,
  applicationFormQuestions: true,
  applicationFormNote: true,
  salary: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, companyName: true, status: true, industry: true, location: true } },
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  matches: {
    select: {
      id: true,
      score: true,
      status: true,
      createdAt: true,
      candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  interviews: {
    select: {
      id: true,
      status: true,
      type: true,
      round: true,
      scheduledAt: true,
      candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 10,
    orderBy: { scheduledAt: 'desc' },
  },
  placements: {
    select: {
      id: true,
      status: true,
      joiningDate: true,
      revenue: true,
      candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  notes: {
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  files: {
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileUrl: true,
      uploadDate: true,
    },
    take: 10,
    orderBy: { uploadDate: 'desc' },
  },
};

const CANDIDATE_FULL_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  linkedIn: true,
  resume: true,
  skills: true,
  experience: true,
  currentTitle: true,
  currentCompany: true,
  location: true,
  address: true,
  city: true,
  country: true,
  status: true,
  source: true,
  assignedToId: true,
  createdById: true,
  rating: true,
  availability: true,
  noticePeriod: true,
  hotlist: true,
  avatar: true,
  designation: true,
  expectedSalary: true,
  currentSalary: true,
  education: true,
  certifications: true,
  languages: true,
  portfolio: true,
  website: true,
  notes: true,
  cvSummary: true,
  cvEducationEntries: true,
  cvWorkExperienceEntries: true,
  cvPortfolioLinks: true,
  preferredLocation: true,
  assignedJobs: true,
  stage: true,
  lastActivity: true,
  salary: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  interviews: {
    select: {
      id: true,
      status: true,
      type: true,
      round: true,
      scheduledAt: true,
      job: { select: { id: true, title: true } },
      client: { select: { id: true, companyName: true } },
    },
    take: 10,
    orderBy: { scheduledAt: 'desc' },
  },
  placements: {
    select: {
      id: true,
      status: true,
      joiningDate: true,
      revenue: true,
      job: { select: { id: true, title: true } },
      client: { select: { id: true, companyName: true } },
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  matches: {
    select: {
      id: true,
      score: true,
      status: true,
      createdAt: true,
      job: { select: { id: true, title: true } },
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  },
  pipelineEntries: {
    select: {
      id: true,
      movedAt: true,
      notes: true,
      stage: { select: { id: true, name: true, order: true } },
    },
    take: 10,
    orderBy: { movedAt: 'desc' },
  },
  files: {
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileUrl: true,
      uploadDate: true,
    },
    take: 10,
    orderBy: { uploadDate: 'desc' },
  },
};

function getSelectForEntity(entity, detailLevel = 'summary') {
  const detail = String(detailLevel || 'summary').trim().toLowerCase();
  const wantsFull = detail === 'full';

  switch (entity) {
    case 'leads':
      return wantsFull
        ? LEAD_FULL_SELECT
        : {
            id: true,
            companyName: true,
            contactPerson: true,
            email: true,
            phone: true,
            status: true,
            source: true,
            type: true,
            priority: true,
            location: true,
            industry: true,
            companySize: true,
            assignedToId: true,
            lastFollowUp: true,
            nextFollowUp: true,
            createdAt: true,
            updatedAt: true,
          };
    case 'clients':
      return wantsFull
        ? CLIENT_FULL_SELECT
        : {
            id: true,
            companyName: true,
            industry: true,
            website: true,
            location: true,
            status: true,
            priority: true,
            assignedToId: true,
            createdAt: true,
            updatedAt: true,
          };
    case 'jobs':
      return wantsFull
        ? JOB_FULL_SELECT
        : {
            id: true,
            title: true,
            status: true,
            type: true,
            location: true,
            department: true,
            openings: true,
            clientId: true,
            assignedToId: true,
            createdAt: true,
            updatedAt: true,
          };
    case 'candidates':
      return wantsFull
        ? CANDIDATE_FULL_SELECT
        : {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            stage: true,
            currentTitle: true,
            currentCompany: true,
            location: true,
            assignedToId: true,
            createdAt: true,
            updatedAt: true,
          };
    default:
      return null;
  }
}

export async function fetchAssistantReportDataset(user, dataset, search, detailLevel = 'summary') {
  const normalizedDataset = String(dataset || '').trim().toLowerCase();

  switch (normalizedDataset) {
    case 'leads': {
      const where = mergeScope(
        leadScope(user),
        textOr(['companyName', 'contactPerson', 'email', 'phone'], search)
      );
      const rows = await prisma.lead.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: getSelectForEntity('leads', detailLevel),
      });
      return rows;
    }
    case 'clients': {
      const where = mergeScope(clientScope(user), textOr(['companyName', 'industry', 'location'], search));
      return prisma.client.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: getSelectForEntity('clients', detailLevel),
      });
    }
    case 'jobs': {
      const where = mergeScope(jobScope(user), textOr(['title', 'department', 'location'], search));
      return prisma.job.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: getSelectForEntity('jobs', detailLevel),
      });
    }
    case 'candidates': {
      const where = mergeScope(candidateScope(user), textOr(['firstName', 'lastName', 'email', 'currentTitle'], search));
      return prisma.candidate.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: getSelectForEntity('candidates', detailLevel),
      });
    }
    case 'placements': {
      const where = mergeScope(placementScope(user), { deletedAt: null });
      return prisma.placement.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          status: true,
          offerDate: true,
          joiningDate: true,
          actualJoiningDate: true,
          salary: true,
          placementFee: true,
          revenue: true,
          recruiterId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }
    case 'interviews': {
      const where = mergeScope(interviewScope(user), {});
      return prisma.interview.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        select: {
          id: true,
          status: true,
          type: true,
          mode: true,
          round: true,
          scheduledAt: true,
          duration: true,
          meetingLink: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }
    case 'pipeline': {
      const where = mergeScope(pipelineScope(user), {});
      return prisma.pipelineEntry.findMany({
        where,
        orderBy: { movedAt: 'desc' },
        select: {
          id: true,
          notes: true,
          movedAt: true,
          createdAt: true,
          updatedAt: true,
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          stage: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          movedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }
    case 'tasks': {
      const where = mergeScope(taskScope(user), textOr(['title', 'description'], search));
      return prisma.task.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          taskType: true,
          assignedToId: true,
          linkedEntityType: true,
          linkedEntityId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }
    case 'team':
    case 'team-performance':
    case 'team_performance': {
      const where = userHasFullDbAccess(user)
        ? mergeScope({ isActive: true }, textOr(['name', 'email', 'department', 'designation'], search))
        : mergeScope({ id: user?.id }, textOr(['name', 'email', 'department', 'designation'], search));
      return prisma.user.findMany({
        where,
        orderBy: { name: 'asc' },
        select:
          detailLevel === 'full'
            ? {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                designation: true,
                location: true,
                status: true,
                joiningDate: true,
                assignedClients: true,
                assignedJobs: true,
                activeCandidates: true,
                placements: true,
                monthlyTarget: true,
                revenueTarget: true,
                activityTarget: true,
                revenueGenerated: true,
                commissionEarned: true,
                commissionRate: true,
                performanceData: true,
                createdAt: true,
                updatedAt: true,
              }
            : {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                designation: true,
                assignedClients: true,
                assignedJobs: true,
                activeCandidates: true,
                placements: true,
                revenueGenerated: true,
              },
      });
    }
    default:
      throw new Error(`Unsupported report dataset: ${dataset}`);
  }
}

/**
 * @param {import('@prisma/client').User | any} user - req.user from auth middleware
 * @param {object} rawArgs - parsed function arguments from OpenAI
 */
export async function executeAssistantDataTool(user, rawArgs) {
  let args = rawArgs;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return { ok: false, error: 'Invalid tool arguments JSON' };
    }
  }

  const queryType = args?.query_type;
  const search = args?.search;
  const recordId = args?.record_id;
  const lim = limitRows(args?.limit);
  const detailLevel = String(args?.detail_level || 'summary').trim().toLowerCase();

  try {
    switch (queryType) {
      case 'counts': {
        const [candidates, jobs, clients, leads, placements, interviews, tasks, users] = await Promise.all([
          prisma.candidate.count({ where: candidateScope(user) }),
          prisma.job.count({ where: jobScope(user) }),
          prisma.client.count({ where: clientScope(user) }),
          prisma.lead.count({ where: leadScope(user) }),
          prisma.placement.count({
            where: mergeScope(placementScope(user), { deletedAt: null }),
          }),
          prisma.interview.count({ where: interviewScope(user) }),
          prisma.task.count({ where: taskScope(user) }),
          userHasFullDbAccess(user)
            ? prisma.user.count({ where: { isActive: true } })
            : prisma.user.count({ where: { id: user.id } }),
        ]);
        return {
          ok: true,
          scope: userHasFullDbAccess(user) ? 'organization' : 'assigned_or_created',
          data: {
            candidates,
            jobs,
            clients,
            leads,
            placements,
            interviews,
            tasks,
            activeUsers: users,
          },
        };
      }

      case 'candidates': {
        const where = mergeScope(candidateScope(user), textOr(['firstName', 'lastName', 'email', 'currentTitle'], search));
        const rows = await prisma.candidate.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: getSelectForEntity('candidates', detailLevel),
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'jobs': {
        const where = mergeScope(jobScope(user), textOr(['title', 'department', 'location'], search));
        const rows = await prisma.job.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: getSelectForEntity('jobs', detailLevel),
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'clients': {
        const where = mergeScope(clientScope(user), textOr(['companyName', 'industry', 'location'], search));
        const rows = await prisma.client.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: getSelectForEntity('clients', detailLevel),
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'leads': {
        const where = mergeScope(
          leadScope(user),
          textOr(['companyName', 'contactPerson', 'email', 'phone'], search)
        );
        const rows = await prisma.lead.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: getSelectForEntity('leads', detailLevel),
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'placements': {
        const where = mergeScope(placementScope(user), { deletedAt: null });
        const rows = await prisma.placement.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            status: true,
            offerDate: true,
            joiningDate: true,
            salary: true,
            fee: true,
            revenue: true,
            recruiterId: true,
            candidate: { select: { firstName: true, lastName: true, email: true } },
            job: { select: { title: true } },
            client: { select: { companyName: true } },
            createdAt: true,
            updatedAt: true,
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'interviews': {
        const where = mergeScope(interviewScope(user), {});
        const rows = await prisma.interview.findMany({
          where,
          take: lim,
          orderBy: { scheduledAt: 'desc' },
          select: {
            id: true,
            status: true,
            type: true,
            mode: true,
            round: true,
            scheduledAt: true,
            duration: true,
            meetingLink: true,
            createdById: true,
            candidate: { select: { firstName: true, lastName: true, email: true } },
            job: { select: { title: true } },
            client: { select: { companyName: true } },
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'tasks': {
        const where = mergeScope(taskScope(user), textOr(['title', 'description'], search));
        const rows = await prisma.task.findMany({
          where,
          take: lim,
          orderBy: { dueDate: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            taskType: true,
            assignedToId: true,
            createdById: true,
            linkedEntityType: true,
            linkedEntityId: true,
            createdAt: true,
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'team_users': {
        if (userHasFullDbAccess(user)) {
          const rows = await prisma.user.findMany({
            take: lim,
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              designation: true,
              isActive: true,
            },
          });
          return { ok: true, count: rows.length, data: rows };
        }
        const selfUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            designation: true,
            isActive: true,
          },
        });
        return { ok: true, count: 1, data: selfUser ? [selfUser] : [], note: 'Non-admin: only your profile is listed.' };
      }

      case 'candidate_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.candidate.findFirst({
          where: mergeScope(candidateScope(user), { id: recordId }),
          select: getSelectForEntity('candidates', 'full'),
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Candidate not found or not accessible' };
      }

      case 'job_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.job.findFirst({
          where: mergeScope(jobScope(user), { id: recordId }),
          select: getSelectForEntity('jobs', 'full'),
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Job not found or not accessible' };
      }

      case 'client_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.client.findFirst({
          where: mergeScope(clientScope(user), { id: recordId }),
          select: getSelectForEntity('clients', 'full'),
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Client not found or not accessible' };
      }

      case 'lead_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.lead.findFirst({
          where: mergeScope(leadScope(user), { id: recordId }),
          select: getSelectForEntity('leads', 'full'),
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Lead not found or not accessible' };
      }

      case 'placement_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.placement.findFirst({
          where: mergeScope(placementScope(user), { id: recordId, deletedAt: null }),
          include: {
            candidate: true,
            job: { select: { id: true, title: true, status: true } },
            client: { select: { id: true, companyName: true } },
            recruiter: { select: { id: true, name: true, email: true } },
          },
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Placement not found or not accessible' };
      }

      default:
        return {
          ok: false,
          error: `Unknown query_type: ${queryType}. Use counts, candidates, jobs, clients, leads, placements, interviews, tasks, team_users, or *_by_id variants.`,
        };
    }
  } catch (e) {
    console.error('[executeAssistantDataTool]', queryType, e);
    return { ok: false, error: e.message || 'Database query failed' };
  }
}

export async function executeAssistantActionTool(user, rawArgs) {
  let args = rawArgs;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return { ok: false, error: 'Invalid action tool arguments JSON' };
    }
  }

  const actionType = String(args?.action_type || '').trim();
  const payload = args?.payload && typeof args.payload === 'object' ? args.payload : {};

  if (!actionType) {
    return { ok: false, error: 'action_type is required' };
  }

  if (actionType.toLowerCase().includes('delete')) {
    return { ok: false, error: 'DELETE operations are forbidden for the AI operator.' };
  }

  try {
    switch (actionType) {
      case 'create_lead': {
        const lead = await leadService.create({ ...payload, performedById: user?.id });
        return { ok: true, action: actionType, entity: 'Lead', data: lead };
      }
      case 'update_lead': {
        const lead = await leadService.update(String(args.record_id || payload.id || ''), {
          ...payload,
          performedById: user?.id,
        });
        return { ok: true, action: actionType, entity: 'Lead', data: lead };
      }
      case 'convert_lead_to_client': {
        const client = await leadService.convertToClient(String(args.record_id || payload.id || ''), payload);
        return { ok: true, action: actionType, entity: 'Client', data: client };
      }
      case 'create_client': {
        const client = await clientService.create({ ...payload, performedById: user?.id });
        return { ok: true, action: actionType, entity: 'Client', data: client };
      }
      case 'update_client': {
        const client = await clientService.update(String(args.record_id || payload.id || ''), {
          ...payload,
          performedById: user?.id,
        });
        return { ok: true, action: actionType, entity: 'Client', data: client };
      }
      case 'create_job': {
        const job = await jobService.create(payload, user?.id);
        return { ok: true, action: actionType, entity: 'Job', data: job };
      }
      case 'update_job': {
        const job = await jobService.update(String(args.record_id || payload.id || ''), payload);
        return { ok: true, action: actionType, entity: 'Job', data: job };
      }
      case 'update_candidate': {
        const candidate = await candidateService.update(String(args.record_id || payload.id || ''), payload);
        return { ok: true, action: actionType, entity: 'Candidate', data: candidate };
      }
      case 'move_candidate_stage': {
        const result = await pipelineService.moveCandidate(
          String(payload.candidateId || ''),
          String(payload.jobId || ''),
          String(payload.stageId || ''),
          user?.id,
          payload.notes
        );
        return { ok: true, action: actionType, entity: 'Pipeline', data: result };
      }
      case 'schedule_interview': {
        const result = await candidateService.scheduleInterview(String(payload.candidateId || ''), payload, user?.id);
        return { ok: true, action: actionType, entity: 'Interview', data: result };
      }
      case 'create_task': {
        const result = await taskService.create({ ...payload, createdById: user?.id });
        return { ok: true, action: actionType, entity: 'Task', data: result };
      }
      case 'update_task': {
        const result = await taskService.update(String(args.record_id || payload.id || ''), payload);
        return { ok: true, action: actionType, entity: 'Task', data: result };
      }
      case 'complete_task': {
        const result = await taskService.update(String(args.record_id || payload.id || ''), { status: 'DONE' });
        return { ok: true, action: actionType, entity: 'Task', data: result };
      }
      case 'create_placement': {
        const result = await placementService.create(payload, user?.id, null);
        return { ok: true, action: actionType, entity: 'Placement', data: result };
      }
      case 'update_placement': {
        const result = await placementService.update(String(args.record_id || payload.id || ''), payload, user?.id);
        return { ok: true, action: actionType, entity: 'Placement', data: result };
      }
      case 'mark_placement_joined': {
        const result = await placementService.markJoined(
          String(args.record_id || payload.id || ''),
          payload,
          user?.id,
          null
        );
        return { ok: true, action: actionType, entity: 'Placement', data: result };
      }
      default:
        return { ok: false, error: `Unsupported action_type: ${actionType}` };
    }
  } catch (error) {
    console.error('[executeAssistantActionTool]', actionType, error);
    return { ok: false, error: error.message || 'Action execution failed' };
  }
}

export async function generateAssistantReportTool(user, rawArgs) {
  let args = rawArgs;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return { ok: false, error: 'Invalid report tool arguments JSON' };
    }
  }

  const reportType = String(args?.report_type || 'csv').trim().toLowerCase();
  const fileNameBase = fileSlug(args?.file_name || args?.title || `assistant-${reportType}-report`);
  const columns = Array.isArray(args?.columns) ? args.columns.map((column) => String(column || '').trim()).filter(Boolean) : [];
  const data = Array.isArray(args?.data) ? args.data : [];
  const title = String(args?.title || 'Assistant Report').trim();

  if (!data.length) {
    return { ok: false, error: 'Report data is required' };
  }

  ensureReportsDir();

  try {
    if (reportType === 'excel' || reportType === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
      const filePath = path.join(REPORTS_DIR, `${fileNameBase}.xlsx`);
      XLSX.writeFile(workbook, filePath);
      return {
        ok: true,
        type: 'excel',
        fileName: `${fileNameBase}.xlsx`,
        fileUrl: toPublicUploadUrl(filePath),
        columns,
        rowCount: data.length,
      };
    }

    if (reportType === 'csv') {
      const headers = columns.length ? columns : Object.keys(data[0] || {});
      const rows = [
        headers.join(','),
        ...data.map((row) =>
          headers
            .map((header) => `"${String(row?.[header] ?? '').replace(/"/g, '""')}"`)
            .join(',')
        ),
      ].join('\n');
      const filePath = path.join(REPORTS_DIR, `${fileNameBase}.csv`);
      fs.writeFileSync(filePath, rows, 'utf8');
      return {
        ok: true,
        type: 'csv',
        fileName: `${fileNameBase}.csv`,
        fileUrl: toPublicUploadUrl(filePath),
        columns: headers,
        rowCount: data.length,
      };
    }

    if (reportType === 'pdf') {
      const lines = data.slice(0, 20).map((row, index) => `${index + 1}. ${JSON.stringify(row)}`);
      const buffer = createSimplePdfBuffer(title, lines);
      const filePath = path.join(REPORTS_DIR, `${fileNameBase}.pdf`);
      fs.writeFileSync(filePath, buffer);
      return {
        ok: true,
        type: 'pdf',
        fileName: `${fileNameBase}.pdf`,
        fileUrl: toPublicUploadUrl(filePath),
        rowCount: data.length,
      };
    }

    return { ok: false, error: `Unsupported report_type: ${reportType}` };
  } catch (error) {
    console.error('[generateAssistantReportTool]', error);
    return { ok: false, error: error.message || 'Report generation failed' };
  }
}
