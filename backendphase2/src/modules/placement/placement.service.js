import { prisma } from '../../config/prisma.js';
import { getCandidateOrThrow } from '../candidate/candidate.service.js';
import {
  sendJoiningScheduledCandidateEmail,
  sendJoiningScheduledReportingContactEmail,
  sendOfferReleasedEmail,
} from '../../services/emailService.js';
import {
  PIPELINE_STAGES,
  clearApplicationPlacementDetails,
  resetApplicationOfferResponse,
  syncApplicationJoiningDetails,
  syncApplicationOfferLetter,
  syncApplicationOfferResponse,
  mapPlacementStatusToCrmStageSync,
  updateCandidateStage,
} from '../stage/candidateStage.service.js';
import { pushPortalNotification } from '../notification/notification.service.js';
import {
  createAlertNotification,
  dispatchScheduledAlert,
} from '../setting/alert-dispatch.service.js';
import {
  notifyPlacementCreated,
  notifyPlacementOfferResponse,
} from '../setting/alert-notify.helpers.js';
import { prepareListWithAuditMeta } from '../../utils/listAuditMeta.js';
import { ENTITY_TYPES } from '../../services/activityService.js';
import { attachAuditMetaToEntity } from '../../utils/listAuditMeta.js';
import {
  queueAiEntryRecommendation,
  buildEntitySnapshot,
} from '../../services/aiEntryRecommendation.service.js';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const DEFAULT_LIMIT = 20;
const VALID_SORT_FIELDS = new Set([
  'offerDate',
  'joiningDate',
  'createdAt',
  'updatedAt',
  'placementFee',
  'salaryOffered',
  'status',
]);

function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value);
}

function assertObjectId(value, fieldName) {
  if (!isValidObjectId(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
}

function parseNumber(value, fieldName, { required = false, min } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (typeof min === 'number' && parsed < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }
  return parsed;
}

function parseDate(value, fieldName, { required = false } = {}) {
  if (!value) {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }
  return parsed;
}

function normalizeEmploymentType(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (!['PERMANENT', 'CONTRACT', 'FREELANCE'].includes(normalized)) {
    throw new Error('Invalid employment type');
  }
  return normalized;
}

function normalizePlacementStatus(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (
    ![
      'OFFER_SENT',
      'OFFER_ACCEPTED',
      'OFFER_REJECTED',
      'FAILED',
      'NO_SHOW',
      'WITHDRAWN',
      'REPLACEMENT_REQUIRED',
      'REPLACED',
      'JOINED',
      'JOINING_SCHEDULED',
    ].includes(normalized)
  ) {
    throw new Error('Invalid placement status');
  }
  return normalized;
}

function resolveCandidateStageFromPlacementStatus(placementStatus) {
  return mapPlacementStatusToCrmStageSync(placementStatus);
}

async function syncCandidateStageFromPlacementStatus(placement, placementStatus, userId, source = 'placement-status') {
  const syncConfig = resolveCandidateStageFromPlacementStatus(placementStatus);
  if (!syncConfig || !placement?.candidateId) return;

  try {
    await updateCandidateStage({
      candidateId: placement.candidateId,
      jobId: placement.jobId || null,
      stage: syncConfig.stage,
      stageLabel: syncConfig.stageLabel,
      performedById: userId,
      skipStageActivity: true,
      metadata: {
        source,
        placementId: placement.id,
        placementStatus: String(placementStatus || '').toUpperCase(),
      },
    });
  } catch (stageErr) {
    console.warn(
      '[placement] candidate stage sync failed:',
      stageErr?.message || stageErr,
    );
  }

  const normalizedStatus = String(placementStatus || '').toUpperCase();
  if (
    placement.candidateId &&
    placement.jobId &&
    (normalizedStatus === 'OFFER_ACCEPTED' || normalizedStatus === 'OFFER_REJECTED')
  ) {
    try {
      await syncApplicationOfferResponse(placement.candidateId, placement.jobId, {
        decision: normalizedStatus === 'OFFER_ACCEPTED' ? 'accept' : 'reject',
        placementStatus: normalizedStatus,
      });
    } catch (portalErr) {
      console.warn(
        '[placement] portal offer response sync failed:',
        portalErr?.message || portalErr,
      );
    }
  }
}

async function revertCandidateAfterPlacementRemoval(placement, userId, source = 'placement-revert') {
  if (!placement?.candidateId) return;

  const otherPlacement = await prisma.placement.findFirst({
    where: {
      candidateId: placement.candidateId,
      jobId: placement.jobId,
      deletedAt: null,
      id: { not: placement.id },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (otherPlacement) {
    await syncCandidateStageFromPlacementStatus(
      otherPlacement,
      otherPlacement.status,
      userId,
      source,
    );
    return;
  }

  if (placement.jobId) {
    try {
      await clearApplicationPlacementDetails(placement.candidateId, placement.jobId);
    } catch (portalErr) {
      console.warn(
        '[placement] clear portal placement details failed:',
        portalErr?.message || portalErr,
      );
    }
  }

  await updateCandidateStage({
    candidateId: placement.candidateId,
    jobId: placement.jobId || null,
    stage: PIPELINE_STAGES.INTERVIEW,
    stageLabel: 'Interviewing',
    performedById: userId,
    skipStageActivity: false,
    metadata: {
      source,
      placementId: placement.id,
      revertedToInterview: true,
    },
  });
}

async function removePlacementWithInterviewRevert(id, userId, activityAction) {
  const existing = await fetchPlacementOrThrow(id);
  if (existing.status === 'JOINED') {
    throw new Error('Cannot revert a confirmed placement');
  }

  await prisma.$transaction(async (tx) => {
    await tx.placement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createPlacementActivity(tx, id, activityAction, userId, {
      previousStatus: existing.status,
      revertedToInterview: true,
    });
  });

  await revertCandidateAfterPlacementRemoval(existing, userId, activityAction);

  return existing;
}

function buildPagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || DEFAULT_LIMIT), 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildRangeFilter(minValue, maxValue) {
  const range = {};
  if (minValue !== undefined && minValue !== null && minValue !== '') {
    range.gte = Number(minValue);
  }
  if (maxValue !== undefined && maxValue !== null && maxValue !== '') {
    range.lte = Number(maxValue);
  }
  return Object.keys(range).length ? range : undefined;
}

function buildDateRange(from, to) {
  const range = {};
  if (from) {
    range.gte = parseDate(from, 'date from');
  }
  if (to) {
    const endDate = parseDate(to, 'date to');
    endDate.setHours(23, 59, 59, 999);
    range.lte = endDate;
  }
  return Object.keys(range).length ? range : undefined;
}

function csvEscape(value) {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function getPublicFileUrl(filePath) {
  if (!filePath) return null;
  const normalized = String(filePath).replace(/\\/g, '/');
  const uploadsIndex = normalized.lastIndexOf('/uploads/');
  return uploadsIndex >= 0 ? normalized.slice(uploadsIndex) : normalized;
}

function formatPlacementListItem(placement) {
  const latestBilling = placement.billing?.[0] || null;
  // The list query already filters `documents` to documentType OFFER_LETTER
  // (and doesn't `select: { documentType: true }`), so a `.find()` by
  // documentType here would always miss. Just take the first row — at most
  // one is fetched.
  const offerLetter = (placement.documents || [])[0] || null;

  return attachPlacementDerivedFields({
    ...placement,
    paymentStatus: latestBilling?.paymentStatus || 'PENDING',
    invoiceNumber: latestBilling?.invoiceNumber || null,
    offerLetterUrl: offerLetter?.fileUrl || null,
  });
}

function resolveCandidateOfferRemark(placement) {
  const direct = placement?.candidateOfferRemark;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const logs = Array.isArray(placement?.activityLog) ? placement.activityLog : [];
  for (const entry of logs) {
    const remark = entry?.details?.candidateRemark;
    if (typeof remark === 'string' && remark.trim()) return remark.trim();
  }
  return null;
}

function attachPlacementDerivedFields(placement) {
  if (!placement) return placement;
  const candidateOfferRemark = resolveCandidateOfferRemark(placement);
  if (!candidateOfferRemark) return placement;
  return { ...placement, candidateOfferRemark };
}

async function createPlacementActivity(tx, placementId, action, performedBy, details = {}) {
  await tx.placementActivityLog.create({
    data: {
      placementId,
      action,
      performedBy,
      details,
    },
  });
}

/** Unique across placement_billing (unique index) and billing_records. */
async function allocatePlacementInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = 'INV';
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);

  const [placementBillings, billingRecords] = await Promise.all([
    tx.placementBilling.findMany({
      where: { invoiceNumber: { startsWith: `${prefix}-${year}-` } },
      select: { invoiceNumber: true },
    }),
    tx.billingRecord.findMany({
      where: { invoiceNumber: { startsWith: `${prefix}-${year}-` } },
      select: { invoiceNumber: true },
    }),
  ]);

  let max = 0;
  for (const row of [...placementBillings, ...billingRecords]) {
    const match = String(row.invoiceNumber || '').match(pattern);
    if (match) {
      max = Math.max(max, Number(match[1]) || 0);
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${prefix}-${year}-${String(max + 1 + attempt).padStart(4, '0')}`;
    const exists = await tx.placementBilling.findFirst({
      where: { invoiceNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  throw new Error('Unable to allocate invoice number. Please try again.');
}

async function buildSearchFilter(search) {
  if (!search) return null;

  const [candidates, clients, jobs] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 100,
    }),
    prisma.client.findMany({
      where: {
        companyName: { contains: search, mode: 'insensitive' },
      },
      select: { id: true },
      take: 100,
    }),
    prisma.job.findMany({
      where: {
        title: { contains: search, mode: 'insensitive' },
      },
      select: { id: true },
      take: 100,
    }),
  ]);

  const candidateIds = candidates.map((item) => item.id);
  const clientIds = clients.map((item) => item.id);
  const jobIds = jobs.map((item) => item.id);

  if (!candidateIds.length && !clientIds.length && !jobIds.length) {
    return { id: { in: [] } };
  }

  return {
    OR: [
      candidateIds.length ? { candidateId: { in: candidateIds } } : null,
      clientIds.length ? { clientId: { in: clientIds } } : null,
      jobIds.length ? { jobId: { in: jobIds } } : null,
    ].filter(Boolean),
  };
}

async function buildPlacementWhere(query) {
  const where = { deletedAt: null };
  const searchFilter = await buildSearchFilter(query.search);

  if (query.ids) {
    const idList = String(query.ids)
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^[a-fA-F0-9]{24}$/.test(value));
    if (idList.length) {
      where.id = { in: idList };
    }
  }

  const companyId = query.companyId || query.clientId;
  if (query.status) where.status = String(query.status).trim().toUpperCase();
  if (companyId) {
    assertObjectId(companyId, 'companyId');
    where.clientId = companyId;
  }
  if (query.candidateId) {
    assertObjectId(query.candidateId, 'candidateId');
    where.candidateId = query.candidateId;
  }
  if (query.jobId) {
    assertObjectId(query.jobId, 'jobId');
    where.jobId = query.jobId;
  }
  if (query.recruiterId) {
    assertObjectId(query.recruiterId, 'recruiterId');
    where.recruiterId = query.recruiterId;
  }
  if (query.employmentType) {
    where.employmentType = normalizeEmploymentType(query.employmentType);
  }

  const offerDate = buildDateRange(query.offerDateFrom, query.offerDateTo);
  if (offerDate) where.offerDate = offerDate;

  const joiningDate = buildDateRange(query.joiningDateFrom, query.joiningDateTo);
  if (joiningDate) where.joiningDate = joiningDate;

  const revenueRange = buildRangeFilter(query.revenueMin, query.revenueMax);
  if (revenueRange) where.revenue = revenueRange;

  const feeRange = buildRangeFilter(query.feeMin, query.feeMax);
  if (feeRange) where.placementFee = feeRange;

  if (searchFilter) {
    Object.assign(where, searchFilter);
  }

  return where;
}

async function fetchPlacementOrThrow(id) {
  assertObjectId(id, 'placement id');
  const placement = await prisma.placement.findFirst({
    where: { id, deletedAt: null },
    include: {
      candidate: true,
      job: true,
      client: {
        select: {
          id: true,
          companyName: true,
          emails: true,
          teamMemberEmail: true,
          contacts: {
            where: { status: 'ACTIVE' },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: { email: true, contactType: true },
          },
        },
      },
      recruiter: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      billing: {
        orderBy: { createdAt: 'desc' },
      },
      commission: {
        include: {
          recruiter: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      documents: {
        include: {
          uploader: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { uploadedAt: 'desc' },
      },
      activityLog: {
        include: {
          actor: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      billingRecords: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!placement) {
    throw new Error('Placement not found');
  }

  return attachPlacementDerivedFields(
    attachAuditMetaToEntity(placement, ENTITY_TYPES.PLACEMENT, { useRecruiterAsCreator: true })
  );
}

export const placementService = {
  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, thisMonth, pending, joined, revenue] = await Promise.all([
      prisma.placement.count({ where: { deletedAt: null } }),
      prisma.placement.count({
        where: {
          deletedAt: null,
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.placement.count({
        where: {
          deletedAt: null,
          status: { in: ['OFFER_SENT', 'OFFER_ACCEPTED', 'JOINING_SCHEDULED'] },
        },
      }),
      prisma.placement.count({
        where: {
          deletedAt: null,
          status: 'JOINED',
        },
      }),
      prisma.placement.aggregate({
        where: {
          deletedAt: null,
          status: { notIn: ['FAILED', 'NO_SHOW', 'WITHDRAWN'] },
        },
        _sum: { placementFee: true },
      }),
    ]);

    return {
      totalPlacements: total,
      placementsThisMonth: thisMonth,
      joiningPending: pending,
      joined,
      revenueGenerated: revenue._sum.placementFee ?? 0,
    };
  },

  async getAll(req) {
    const { page, limit, skip } = buildPagination(req.query);
    const sortBy = VALID_SORT_FIELDS.has(req.query.sortBy) ? req.query.sortBy : 'offerDate';
    const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const where = await buildPlacementWhere(req.query);

    const [placements, total] = await Promise.all([
      prisma.placement.findMany({
        where,
        skip,
        take: limit,
        include: {
          candidate: {
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
          },
          job: {
            select: { id: true, title: true },
          },
          client: {
            select: {
              id: true,
              companyName: true,
              emails: true,
              teamMemberEmail: true,
              contacts: {
                where: { status: 'ACTIVE' },
                orderBy: { updatedAt: 'desc' },
                take: 10,
                select: { email: true, contactType: true },
              },
            },
          },
          recruiter: {
            select: { id: true, name: true, email: true },
          },
          billing: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              paymentStatus: true,
              invoiceNumber: true,
            },
          },
          documents: {
            where: { documentType: 'OFFER_LETTER' },
            take: 1,
            select: {
              fileUrl: true,
              fileName: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.placement.count({ where }),
    ]);

    const list = placements.map(formatPlacementListItem);
    const withAudit = await prepareListWithAuditMeta(list, ENTITY_TYPES.PLACEMENT, {
      useRecruiterAsCreator: true,
    });
    console.log('[Placement] getAll: total=', total, 'list length=', list.length, 'where deletedAt=', where.deletedAt);
    return {
      data: withAudit,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(id) {
    return fetchPlacementOrThrow(id);
  },

  async create(data, userId, file) {
    assertObjectId(data.candidateId, 'candidateId');
    assertObjectId(data.jobId, 'jobId');
    if (data.recruiterId) {
      assertObjectId(data.recruiterId, 'recruiterId');
    }

    const salaryOffered = parseNumber(data.salaryOffered ?? data.offerSalary ?? data.salary, 'Offer salary', { required: true, min: 0 });
    const placementFee = parseNumber(data.placementFee ?? data.fee, 'Placement fee', { required: true, min: 0 });
    const commissionPercentage = parseNumber(data.commissionPercentage, 'Commission percentage', { min: 0 }) ?? 20;
    const currency = String(data.currency || 'USD').trim().toUpperCase() || 'USD';
    const offerDate = parseDate(data.offerDate, 'Offer date', { required: true });
    const expectedJoining = parseDate(data.expectedJoiningDate ?? data.joiningDate, 'Expected joining date');
    const initialStatus = data.status ? normalizePlacementStatus(data.status) : 'OFFER_SENT';
    if (!initialStatus) {
      throw new Error('Invalid placement status');
    }
    if (initialStatus === 'JOINING_SCHEDULED' && !expectedJoining) {
      throw new Error('Expected joining date is required when status is Joining Scheduled');
    }
    const employmentType = normalizeEmploymentType(data.employmentType);
    if (!employmentType) {
      throw new Error('Employment type is required');
    }

    const [candidate, job, recruiter] = await Promise.all([
      getCandidateOrThrow(data.candidateId),
      prisma.job.findUnique({
        where: { id: data.jobId },
        select: { id: true, title: true, clientId: true },
      }),
      prisma.user.findUnique({
        where: { id: data.recruiterId || userId },
        select: { id: true, name: true },
      }),
    ]);
    if (!job) throw new Error('Job not found');
    if (!recruiter) throw new Error('Recruiter not found');

    const clientId = String(data.companyId || data.clientId || job.clientId || '').trim();
    if (!isValidObjectId(clientId)) {
      throw new Error(
        'This job is not linked to a client. Open the job, assign a client company, then create the placement.'
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, companyName: true },
    });
    if (!client) throw new Error('Client not found');

    const placement = await prisma.$transaction(async (tx) => {
      const createdPlacement = await tx.placement.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          clientId: client.id,
          recruiterId: recruiter.id,
          startDate: initialStatus === 'JOINING_SCHEDULED' && expectedJoining ? expectedJoining : offerDate,
          offerDate,
          joiningDate: initialStatus === 'JOINING_SCHEDULED' ? expectedJoining : null,
          salary: salaryOffered,
          salaryOffered,
          fee: placementFee,
          placementFee,
          feeType: 'PERCENTAGE',
          commissionPercentage,
          revenue: placementFee,
          employmentType,
          status: initialStatus,
          notes: data.notes?.trim() || null,
          deletedAt: null,
        },
      });

      const invoiceNumber = await allocatePlacementInvoiceNumber(tx);

      await tx.placementBilling.create({
        data: {
          placementId: createdPlacement.id,
          invoiceNumber,
          invoiceDate: new Date(),
          amount: placementFee,
          taxPercentage: 0,
          taxAmount: 0,
          totalAmount: placementFee,
          paymentStatus: 'PENDING',
        },
      });

      await tx.billingRecord.create({
        data: {
          clientId: client.id,
          placementId: createdPlacement.id,
          amount: placementFee,
          currency,
          status: 'DRAFT',
          invoiceNumber,
          invoiceDate: new Date(),
          notes: `Placement invoice for ${candidate.firstName} ${candidate.lastName}`,
      },
    });

      await tx.placementCommission.create({
        data: {
          placementId: createdPlacement.id,
          recruiterId: recruiter.id,
          commissionPercentage,
          commissionAmount: (placementFee * commissionPercentage) / 100,
          paymentStatus: 'PENDING',
        },
      });

      let offerLetterSync = null;
      if (file?.path) {
        const fileUrl = getPublicFileUrl(file.path);
        await tx.placementDocument.create({
          data: {
            placementId: createdPlacement.id,
            documentType: 'OFFER_LETTER',
            fileUrl,
            fileName: file.originalname,
            uploadedBy: userId,
          },
        });
        offerLetterSync = { fileUrl, fileName: file.originalname };
      } else {
        // Recruiter didn't attach a fresh offer letter at placement time.
        // The client may have already uploaded one through the public
        // submit-to-client review link — that gets stored as a
        // CandidateFile of type 'Offer'. Pull the most recent one for this
        // candidate and attach it as the placement's OFFER_LETTER so the
        // Placements tab "View offer letter" button enables immediately.
        const existingOffer = await tx.candidateFile.findFirst({
          where: {
            candidateId: candidate.id,
            fileType: 'Offer',
            fileUrl: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { fileUrl: true, fileName: true, uploadedById: true },
        });
        if (existingOffer?.fileUrl) {
          await tx.placementDocument.create({
            data: {
              placementId: createdPlacement.id,
              documentType: 'OFFER_LETTER',
              fileUrl: existingOffer.fileUrl,
              fileName: existingOffer.fileName,
              uploadedBy: existingOffer.uploadedById || userId,
            },
          });
          offerLetterSync = {
            fileUrl: existingOffer.fileUrl,
            fileName: existingOffer.fileName,
          };
        }
      }

      await createPlacementActivity(tx, createdPlacement.id, 'Placement created', userId, {
        candidateId: candidate.id,
        jobId: job.id,
        clientId: client.id,
        status: 'OFFER_SENT',
      });

      await tx.activity.create({
        data: {
          action: 'Placement created',
          description: `${candidate.firstName} ${candidate.lastName} was added to placements for ${job.title}.`,
          performedById: userId,
          entityType: 'PLACEMENT',
          entityId: createdPlacement.id,
          category: 'Placements',
          relatedType: 'candidate',
          relatedId: candidate.id,
          relatedLabel: `${candidate.firstName} ${candidate.lastName}`,
          metadata: {
            jobId: job.id,
            clientId: client.id,
            status: 'OFFER_SENT',
          },
        },
      });

      return { createdPlacement, offerLetterSync };
    });

    const placementResult = placement?.createdPlacement || placement;
    const offerLetterToMirror = placement?.offerLetterSync || null;

    // Push the offer letter to the candidate's portal Application so it
    // appears on the job-portal `/applications/[id]` page with View +
    // Download. Out-of-transaction because the portal lives on a separate
    // Prisma client; we never want a portal-write failure to roll back the
    // CRM placement.
    if (offerLetterToMirror?.fileUrl) {
      try {
        await syncApplicationOfferLetter(candidate.id, job.id, {
          ...offerLetterToMirror,
          placementId: placementResult.id,
          placementStatus: initialStatus,
        });
      } catch (offerSyncError) {
        console.warn(
          '[placement.create] portal offer letter sync failed:',
          offerSyncError?.message || offerSyncError
        );
      }
    }

    if (candidate.email && offerLetterToMirror?.fileUrl) {
      await sendOfferReleasedEmail({
        toEmail: candidate.email,
        candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
        jobTitle: job.title,
        companyName: client.companyName,
        offerDate: offerDate || new Date(),
        senderUserId: userId,
      });
    }

    await updateCandidateStage({
      candidateId: candidate.id,
      jobId: job.id,
      stage: PIPELINE_STAGES.OFFER,
      metadata: { placementId: placementResult.id, jobTitle: job.title, offerDate: offerDate?.toISOString?.() || String(offerDate) },
      performedById: userId,
      skipStageActivity: true,
    });

    // CRM bell + portal bell notifications. Best-effort.
    try {
      const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`
        .trim() || 'Candidate';
      const recipients = new Set([userId, recruiter.id].filter(Boolean));
      await notifyPlacementCreated({
        placementId: placementResult.id,
        candidateName,
        clientName: client.companyName,
        jobTitle: job.title,
        userIds: Array.from(recipients),
        hasOfferLetter: !!offerLetterToMirror?.fileUrl,
        senderUserId: userId,
      });
      void pushPortalNotification(candidate.id, {
        type: 'application',
        title: offerLetterToMirror?.fileUrl
          ? 'Offer letter received'
          : 'You have been placed',
        description: `Congratulations! ${
          offerLetterToMirror?.fileUrl
            ? 'Your offer letter is available'
            : `You've been placed`
        } for ${job.title} at ${client.companyName}.`,
        actionButton: 'View applications',
        actionPath: '/applications',
        metadata: {
          status: 'PLACED',
          jobId: job.id,
          placementId: placementResult.id,
          offerLetterUrl: offerLetterToMirror?.fileUrl || null,
        },
      });
    } catch (bellErr) {
      console.warn(
        '[placement.create] notification failed (non-fatal):',
        bellErr?.message || bellErr
      );
    }

    const placementCandidateName =
      `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Candidate';
    queueAiEntryRecommendation({
      entityType: 'PLACEMENT',
      entityId: placementResult.id,
      entityLabel: `${placementCandidateName} — ${job.title}`,
      snapshot: buildEntitySnapshot('PLACEMENT', {
        ...placementResult,
        candidate,
        job,
        client,
        recruiter,
      }),
      recipientUserId: recruiter.id || userId,
      actorUserId: userId,
      trigger: 'create',
    });

    // Placement was just created successfully; return it directly instead of
    // re-fetching, which was occasionally throwing "Placement not found".
    return placementResult;
  },

  async update(id, data, userId) {
    const existing = await fetchPlacementOrThrow(id);
    if (data.recruiterId) {
      assertObjectId(data.recruiterId, 'recruiterId');
    }

    const salaryOffered = data.salaryOffered ?? data.offerSalary ?? data.salary;
    const placementFee = data.placementFee ?? data.fee;
    const commissionPercentage = data.commissionPercentage;

    const updateData = {
      joiningDate: data.joiningDate ? parseDate(data.joiningDate, 'Joining date') : undefined,
      offerDate: data.offerDate ? parseDate(data.offerDate, 'Offer date') : undefined,
      salary: salaryOffered !== undefined ? parseNumber(salaryOffered, 'Offer salary', { min: 0 }) : undefined,
      salaryOffered: salaryOffered !== undefined ? parseNumber(salaryOffered, 'Offer salary', { min: 0 }) : undefined,
      fee: placementFee !== undefined ? parseNumber(placementFee, 'Placement fee', { min: 0 }) : undefined,
      placementFee: placementFee !== undefined ? parseNumber(placementFee, 'Placement fee', { min: 0 }) : undefined,
      revenue: placementFee !== undefined ? parseNumber(placementFee, 'Placement fee', { min: 0 }) : undefined,
      commissionPercentage:
        commissionPercentage !== undefined ? parseNumber(commissionPercentage, 'Commission percentage', { min: 0 }) : undefined,
      notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
      employmentType: data.employmentType ? normalizeEmploymentType(data.employmentType) : undefined,
      recruiterId: data.recruiterId || undefined,
    };

    if (data.status !== undefined && data.status !== null && data.status !== '') {
      updateData.status = normalizePlacementStatus(data.status);
      if (!updateData.status) {
        throw new Error('Invalid placement status');
      }
      if (updateData.status === 'JOINING_SCHEDULED' && !updateData.joiningDate && !existing.joiningDate) {
        const fallbackJoin = parseDate(data.expectedJoiningDate, 'Expected joining date');
        if (!fallbackJoin) {
          throw new Error('Joining date is required when status is Joining Scheduled');
        }
        updateData.joiningDate = fallbackJoin;
        updateData.startDate = fallbackJoin;
      }
    }

    const updatedPlacement = await prisma.$transaction(async (tx) => {
      const updated = await tx.placement.update({
      where: { id },
      data: updateData,
    });

      if (updateData.placementFee !== undefined) {
        const latestBilling = await tx.placementBilling.findFirst({
          where: { placementId: id, paymentStatus: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });
        if (latestBilling) {
          await tx.placementBilling.update({
            where: { id: latestBilling.id },
            data: {
              amount: updateData.placementFee,
              totalAmount: updateData.placementFee,
            },
          });
        }

        const latestInvoice = await tx.billingRecord.findFirst({
          where: { placementId: id, status: { in: ['DRAFT', 'SENT'] } },
          orderBy: { createdAt: 'desc' },
        });
        if (latestInvoice) {
          await tx.billingRecord.update({
            where: { id: latestInvoice.id },
            data: {
              amount: updateData.placementFee,
            },
          });
        }
      }

      if (updateData.placementFee !== undefined || updateData.commissionPercentage !== undefined || updateData.recruiterId !== undefined) {
        const latestCommission = await tx.placementCommission.findFirst({
          where: { placementId: id, paymentStatus: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });

        const effectiveFee = updateData.placementFee ?? existing.placementFee ?? existing.fee ?? 0;
        const effectivePct = updateData.commissionPercentage ?? existing.commissionPercentage ?? 20;
        const effectiveRecruiterId = updateData.recruiterId ?? existing.recruiterId;

        if (latestCommission) {
          await tx.placementCommission.update({
            where: { id: latestCommission.id },
            data: {
              recruiterId: effectiveRecruiterId,
              commissionPercentage: effectivePct,
              commissionAmount: (effectiveFee * effectivePct) / 100,
            },
          });
        } else if (effectiveRecruiterId) {
          await tx.placementCommission.create({
            data: {
              placementId: id,
              recruiterId: effectiveRecruiterId,
              commissionPercentage: effectivePct,
              commissionAmount: (effectiveFee * effectivePct) / 100,
              paymentStatus: 'PENDING',
            },
          });
        }
      }

      await createPlacementActivity(tx, id, 'Placement updated', userId, {
        updatedFields: Object.keys(updateData).filter((key) => updateData[key] !== undefined),
      });

    return updated;
    });

    if (userId && Object.keys(updateData).filter((k) => updateData[k] !== undefined).length) {
      try {
        await prisma.activity.create({
          data: {
            action: 'Placement updated',
            description: `Placement record was updated (${Object.keys(updateData).filter((k) => updateData[k] !== undefined).join(', ')}).`,
            performedById: userId,
            entityType: 'PLACEMENT',
            entityId: id,
            category: 'Placements',
            relatedType: 'placement',
            relatedId: id,
            metadata: {
              updatedFields: Object.keys(updateData).filter((k) => updateData[k] !== undefined),
            },
          },
        });
      } catch (activityErr) {
        console.warn('[placement.update] activity log failed:', activityErr?.message || activityErr);
      }
    }

    if (updateData.status && updateData.status !== existing.status) {
      await syncCandidateStageFromPlacementStatus(
        { id, candidateId: existing.candidateId, jobId: existing.jobId },
        updateData.status,
        userId,
        'placement-update',
      );
    }

    const refreshedPlacement = await fetchPlacementOrThrow(updatedPlacement.id);
    queueAiEntryRecommendation({
      entityType: 'PLACEMENT',
      entityId: refreshedPlacement.id,
      entityLabel: refreshedPlacement.candidate
        ? `${refreshedPlacement.candidate.firstName || ''} ${refreshedPlacement.candidate.lastName || ''}`.trim() +
          (refreshedPlacement.job?.title ? ` — ${refreshedPlacement.job.title}` : '')
        : 'Placement',
      snapshot: buildEntitySnapshot('PLACEMENT', refreshedPlacement),
      recipientUserId: refreshedPlacement.recruiterId || userId,
      actorUserId: userId,
      trigger: 'update',
    });

    return refreshedPlacement;
  },

  /**
   * Change placement status from the placements table dropdown.
   * Reuses mark-joined / mark-failed flows when those side effects apply.
   */
  async updateStatus(id, data, userId) {
    const nextStatus = normalizePlacementStatus(data.status);
    if (!nextStatus) {
      throw new Error('Status is required');
    }

    const existing = await fetchPlacementOrThrow(id);
    if (existing.status === nextStatus) {
      await syncCandidateStageFromPlacementStatus(
        existing,
        nextStatus,
        userId,
        'placement-status-reconcile',
      );
      return fetchPlacementOrThrow(id);
    }

    if (nextStatus === 'JOINED') {
      const joiningDate =
        data.actualJoiningDate ||
        existing.actualJoiningDate ||
        existing.joiningDate ||
        new Date().toISOString();
      return this.markJoined(
        id,
        {
          actualJoiningDate: joiningDate,
          confirmationNote:
            data.confirmationNote?.trim() || 'Status updated to Joined from placements table',
        },
        userId,
        null,
      );
    }

    if (['FAILED', 'NO_SHOW', 'WITHDRAWN'].includes(nextStatus)) {
      return this.markFailed(id, {
        status: nextStatus,
        reason:
          data.reason?.trim() ||
          `Status changed to ${nextStatus.replace(/_/g, ' ').toLowerCase()} from placements table`,
        notes: data.notes,
      }, userId);
    }

    if (nextStatus === 'REPLACEMENT_REQUIRED') {
      return this.requestReplacement(id, {
        reason: data.reason?.trim() || 'Replacement requested from placements table',
        expectedReplacementDate: data.expectedReplacementDate,
      }, userId);
    }

    if (nextStatus === 'JOINING_SCHEDULED') {
      throw new Error('Use Schedule Joining to set joining date and reporting contact');
    }

    if (nextStatus === 'OFFER_SENT' || nextStatus === 'OFFER_ACCEPTED' || nextStatus === 'OFFER_REJECTED') {
      await prisma.$transaction(async (tx) => {
        await tx.placement.update({
          where: { id },
          data: { status: nextStatus },
        });
        await createPlacementActivity(tx, id, `Status changed to ${nextStatus}`, userId, {
          previousStatus: existing.status,
          nextStatus,
        });
      });
      await syncCandidateStageFromPlacementStatus(existing, nextStatus, userId, 'placement-update-status');
      return fetchPlacementOrThrow(id);
    }

    await prisma.$transaction(async (tx) => {
      await tx.placement.update({
        where: { id },
        data: { status: nextStatus },
      });
      await createPlacementActivity(tx, id, `Status changed to ${nextStatus}`, userId, {
        previousStatus: existing.status,
        nextStatus,
      });
    });

    await syncCandidateStageFromPlacementStatus(existing, nextStatus, userId, 'placement-update-status');
    return fetchPlacementOrThrow(id);
  },

  async markJoined(id, data, userId, file) {
    const actualJoiningDate = parseDate(data.actualJoiningDate, 'Actual joining date', { required: true });
    const confirmationNote = data.confirmationNote?.trim() || null;

    await fetchPlacementOrThrow(id);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.placement.update({
        where: { id },
        data: {
          status: 'JOINED',
          actualJoiningDate,
          joiningDate: actualJoiningDate,
          notes: confirmationNote || undefined,
        },
      });

      await tx.candidate.update({
        where: { id: updated.candidateId },
        data: { status: 'PLACED', stage: 'Hired' },
      });

      if (file?.path) {
        await tx.placementDocument.create({
          data: {
            placementId: id,
            documentType: 'JOINING_LETTER',
            fileUrl: getPublicFileUrl(file.path),
            fileName: file.originalname,
            uploadedBy: userId,
          },
        });
      }

      await createPlacementActivity(tx, id, 'Candidate joined confirmed', userId, {
        actualJoiningDate,
        note: confirmationNote,
      });
    });

    const joined = await fetchPlacementOrThrow(id);
    try {
      await updateCandidateStage({
        candidateId: joined.candidateId,
        jobId: joined.jobId,
        stage: PIPELINE_STAGES.HIRED,
        performedById: userId,
        skipStageActivity: true,
        metadata: { source: 'placement-mark-joined', placementId: id },
      });
    } catch (stageErr) {
      console.warn('[placement.markJoined] stage sync failed:', stageErr?.message || stageErr);
    }

    return fetchPlacementOrThrow(id);
  },

  async markFailed(id, data, userId) {
    const reason = String(data.reason || '').trim();
    if (!reason) {
      throw new Error('Reason is required');
    }

    const status = normalizePlacementStatus(
      data.status || (reason.toLowerCase().includes('no show') ? 'NO_SHOW' : 'FAILED')
    );
    if (!['FAILED', 'NO_SHOW', 'WITHDRAWN'].includes(status)) {
      throw new Error('Status must be FAILED, NO_SHOW, or WITHDRAWN');
    }

    await prisma.$transaction(async (tx) => {
      await tx.placement.update({
        where: { id },
        data: {
          status,
          failureReason: reason,
          notes: data.notes?.trim() || null,
        },
      });

      await createPlacementActivity(tx, id, `Placement marked as ${status}`, userId, {
        reason,
        notes: data.notes?.trim() || null,
      });
    });

    const failed = await fetchPlacementOrThrow(id);
    await syncCandidateStageFromPlacementStatus(failed, status, userId, 'placement-mark-failed');
    try {
      const candidateName =
        `${failed.candidate?.firstName || ''} ${failed.candidate?.lastName || ''}`.trim() ||
        'Candidate';
      const jobTitle = failed.job?.title || 'the role';
      const notifyIds = new Set([failed.recruiterId, userId].filter(Boolean));
      await Promise.allSettled(
        Array.from(notifyIds).map((uid) =>
          dispatchScheduledAlert({
            alertId: 'placement.failed',
            userId: uid,
            dedupHours: 1,
            payload: {
              category: 'PLACEMENT',
              title: 'Placement failed / no-show',
              description: `${candidateName} — ${status.replace(/_/g, ' ').toLowerCase()} for ${jobTitle}. Reason: ${reason}.`,
              actionLabel: 'View placement',
              actionPath: `/placement?placementId=${id}`,
              entityType: 'PLACEMENT',
              entityId: id,
            },
          })
        )
      );
    } catch (notifyErr) {
      console.warn('[placement.markFailed] alert failed:', notifyErr?.message || notifyErr);
    }

    return failed;
  },

  async requestReplacement(id, data, userId) {
    const reason = String(data.reason || '').trim();
    const expectedReplacementDate = data.expectedReplacementDate
      ? parseDate(data.expectedReplacementDate, 'Expected replacement date')
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.placement.update({
        where: { id },
        data: {
          status: 'REPLACEMENT_REQUIRED',
        },
      });

      await createPlacementActivity(tx, id, 'Replacement requested', userId, {
        reason,
        expectedReplacementDate,
      });
    });

    const replacement = await fetchPlacementOrThrow(id);
    try {
      const candidateName =
        `${replacement.candidate?.firstName || ''} ${replacement.candidate?.lastName || ''}`.trim() ||
        'Candidate';
      const jobTitle = replacement.job?.title || 'the role';
      const clientName = replacement.client?.companyName || 'the client';
      const notifyIds = new Set([replacement.recruiterId, userId].filter(Boolean));
      await Promise.allSettled(
        Array.from(notifyIds).map((uid) =>
          dispatchScheduledAlert({
            alertId: 'placement.replacement_required',
            userId: uid,
            dedupHours: 1,
            payload: {
              category: 'PLACEMENT',
              title: 'Replacement required',
              description: `Replacement needed for ${candidateName} at ${clientName} (${jobTitle}).${reason ? ` Reason: ${reason}` : ''}`,
              actionLabel: 'View placement',
              actionPath: `/placement?placementId=${id}`,
              entityType: 'PLACEMENT',
              entityId: id,
            },
          })
        )
      );
    } catch (notifyErr) {
      console.warn('[placement.requestReplacement] alert failed:', notifyErr?.message || notifyErr);
    }

    return replacement;
  },

  async scheduleJoining(id, data, userId) {
    const joiningDate = parseDate(data.joiningDate, 'Joining date', { required: true });
    const reportingToName = String(data.reportingToName || '').trim();
    const reportingToTitle = String(data.reportingToTitle || '').trim();
    const reportingToEmail = String(data.reportingToEmail || '').trim();
    const joiningNotes = String(data.joiningNotes || data.notes || '').trim();

    if (!reportingToName) {
      throw new Error('Reporting contact name is required');
    }

    const existing = await fetchPlacementOrThrow(id);
    if (!['OFFER_ACCEPTED', 'JOINING_SCHEDULED'].includes(existing.status)) {
      throw new Error('Joining can only be scheduled after the offer is accepted');
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: existing.candidateId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        location: true,
        currentTitle: true,
        currentCompany: true,
      },
    });
    const job = await prisma.job.findUnique({
      where: { id: existing.jobId },
      select: { id: true, title: true },
    });
    const client = await prisma.client.findUnique({
      where: { id: existing.clientId },
      select: { companyName: true },
    });
    const scheduler = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        }).catch(() => null)
      : null;
    const recruiterUser = existing.recruiterId
      ? await prisma.user.findUnique({
          where: { id: existing.recruiterId },
          select: { name: true, email: true },
        }).catch(() => null)
      : null;
    const recruiterName = scheduler?.name || recruiterUser?.name || null;
    const recruiterEmail = scheduler?.email || recruiterUser?.email || null;
    const candidateName =
      `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate';

    await prisma.$transaction(async (tx) => {
      await tx.placement.update({
        where: { id },
        data: {
          status: 'JOINING_SCHEDULED',
          joiningDate,
          startDate: joiningDate,
          reportingToName,
          reportingToTitle: reportingToTitle || null,
          reportingToEmail: reportingToEmail || null,
          notes: joiningNotes || existing.notes || null,
        },
      });
      await createPlacementActivity(tx, id, 'Joining scheduled', userId, {
        joiningDate,
        reportingToName,
        reportingToTitle,
        reportingToEmail,
      });
    });

    const joiningDateLabel = joiningDate.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    try {
      await syncApplicationJoiningDetails(existing.candidateId, existing.jobId, {
        joiningDate: joiningDateLabel,
        reportingToName,
        reportingToTitle,
        reportingToEmail,
        joiningNotes,
      });
    } catch (syncErr) {
      console.warn('[placement.scheduleJoining] portal sync failed:', syncErr?.message || syncErr);
    }

    const emailBase = {
      jobTitle: job?.title || null,
      companyName: client?.companyName || null,
      joiningDateLabel,
      reportingToName,
      reportingToTitle: reportingToTitle || null,
      reportingToEmail: reportingToEmail || null,
      joiningNotes: joiningNotes || null,
      recruiterName,
      recruiterEmail,
      senderUserId: userId,
    };

    if (candidate?.email) {
      try {
        await sendJoiningScheduledCandidateEmail({
          ...emailBase,
          toEmail: candidate.email,
          candidateName,
        });
      } catch (mailErr) {
        console.warn('[placement.scheduleJoining] candidate email failed:', mailErr?.message || mailErr);
      }
    }

    if (reportingToEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reportingToEmail)) {
      try {
        await sendJoiningScheduledReportingContactEmail({
          ...emailBase,
          toEmail: reportingToEmail,
          recipientName: reportingToName,
          candidateName,
          candidateEmail: candidate?.email || null,
          candidatePhone: candidate?.phone || null,
          candidateLocation: candidate?.location || null,
          currentTitle: candidate?.currentTitle || null,
          currentCompany: candidate?.currentCompany || null,
        });
      } catch (mailErr) {
        console.warn(
          '[placement.scheduleJoining] reporting contact email failed:',
          mailErr?.message || mailErr
        );
      }
    }

    try {
      const recipients = new Set([userId, existing.recruiterId].filter(Boolean));
      await Promise.allSettled(
        Array.from(recipients).map((uid) =>
          createAlertNotification(uid, 'placement.joining_scheduled', {
            category: 'PLACEMENT',
            title: 'Joining scheduled',
            description: `${candidateName} — ${joiningDateLabel}. Report to ${reportingToName}.`,
            actionLabel: 'View placement',
            actionPath: `/placement?placementId=${id}`,
          })
        )
      );
      await pushPortalNotification(existing.candidateId, {
        title: 'Joining date scheduled',
        body: `Your joining for ${job?.title || 'the role'} is scheduled on ${joiningDateLabel}.`,
      });
    } catch (notifyErr) {
      console.warn('[placement.scheduleJoining] notifications failed:', notifyErr?.message || notifyErr);
    }

    await syncCandidateStageFromPlacementStatus(existing, 'JOINING_SCHEDULED', userId, 'placement-schedule-joining');

    return fetchPlacementOrThrow(id);
  },

  /**
   * Candidate accepted or rejected offer on Phase 1 portal (internal webhook).
   */
  async respondToPortalOffer({ candidateId, jobId, decision, remark }, userId = null) {
    const normalized = String(decision || '').trim().toLowerCase();
    if (!['accept', 'reject', 'accepted', 'rejected'].includes(normalized)) {
      throw new Error('Invalid offer decision');
    }
    const isAccept = normalized === 'accept' || normalized === 'accepted';
    const nextStatus = isAccept ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED';
    const trimmedRemark = String(remark || '').trim();

    if (!isAccept && !trimmedRemark) {
      throw new Error('A remark is required when declining an offer');
    }
    if (!isAccept && trimmedRemark.length > 2000) {
      throw new Error('Remark must be 2000 characters or fewer');
    }

    const placement = await prisma.placement.findFirst({
      where: {
        candidateId,
        jobId,
        deletedAt: null,
        status: { in: ['OFFER_SENT', 'OFFER_ACCEPTED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!placement) {
      throw new Error('Placement not found for this application');
    }
    if (placement.status !== 'OFFER_SENT') {
      throw new Error('Offer has already been responded to');
    }

    await prisma.$transaction(async (tx) => {
      await tx.placement.update({
        where: { id: placement.id },
        data: {
          status: nextStatus,
          ...(isAccept ? {} : { candidateOfferRemark: trimmedRemark }),
        },
      });
      await createPlacementActivity(
        tx,
        placement.id,
        isAccept ? 'Offer accepted by candidate' : 'Offer rejected by candidate',
        userId,
        {
          decision: isAccept ? 'accept' : 'reject',
          source: 'portal',
          ...(isAccept ? {} : { candidateRemark: trimmedRemark }),
        }
      );
    });

    try {
      await syncApplicationOfferResponse(candidateId, jobId, {
        decision: isAccept ? 'accept' : 'reject',
        placementStatus: nextStatus,
        remark: isAccept ? undefined : trimmedRemark,
      });
    } catch (syncErr) {
      console.warn('[placement.respondToPortalOffer] portal sync failed:', syncErr?.message || syncErr);
    }

    if (isAccept) {
      try {
        await updateCandidateStage({
          candidateId,
          jobId,
          stage: PIPELINE_STAGES.OFFER,
          stageLabel: 'Offer Accepted',
          performedById: userId,
          skipStageActivity: true,
          metadata: { source: 'portal-offer-accept', placementId: placement.id },
        });
      } catch (stageErr) {
        console.warn('[placement.respondToPortalOffer] stage sync failed:', stageErr?.message || stageErr);
      }
    } else {
      try {
        await updateCandidateStage({
          candidateId,
          jobId,
          stage: PIPELINE_STAGES.REJECTED,
          stageLabel: 'Offer Rejected',
          performedById: userId,
          skipStageActivity: true,
          metadata: { source: 'portal-offer-reject', placementId: placement.id },
        });
      } catch (stageErr) {
        console.warn('[placement.respondToPortalOffer] stage sync failed:', stageErr?.message || stageErr);
      }
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { firstName: true, lastName: true },
    });
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { title: true },
    });
    const candidateName = `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate';
    const notifyIds = new Set([placement.recruiterId].filter(Boolean));
    await notifyPlacementOfferResponse({
      placementId: placement.id,
      candidateName,
      jobTitle: job?.title || 'the role',
      isAccept,
      userIds: Array.from(notifyIds),
    });

    return fetchPlacementOrThrow(placement.id);
  },

  async resendOffer(id, userId, file) {
    const existing = await fetchPlacementOrThrow(id);
    if (existing.status !== 'OFFER_REJECTED') {
      throw new Error('Only rejected offers can be resent');
    }

    let offerLetterSync = null;

    await prisma.$transaction(async (tx) => {
      await tx.placement.update({
        where: { id },
        data: {
          status: 'OFFER_SENT',
          candidateOfferRemark: null,
        },
      });

      if (file?.path) {
        const fileUrl = getPublicFileUrl(file.path);
        await tx.placementDocument.create({
          data: {
            placementId: id,
            documentType: 'OFFER_LETTER',
            fileUrl,
            fileName: file.originalname,
            uploadedBy: userId,
          },
        });
        offerLetterSync = { fileUrl, fileName: file.originalname };
      } else {
        const latestOffer = (existing.documents || []).find(
          (doc) => String(doc.documentType || '').toUpperCase() === 'OFFER_LETTER'
        );
        if (latestOffer?.fileUrl) {
          offerLetterSync = {
            fileUrl: latestOffer.fileUrl,
            fileName: latestOffer.fileName || 'offer-letter.pdf',
          };
        }
      }

      await createPlacementActivity(tx, id, 'Offer letter resent', userId, {
        previousStatus: existing.status,
        hasNewLetter: Boolean(offerLetterSync?.fileUrl),
      });
    });

    try {
      await resetApplicationOfferResponse(existing.candidateId, existing.jobId, {
        placementStatus: 'OFFER_SENT',
        placementId: id,
      });
    } catch (portalErr) {
      console.warn('[placement.resendOffer] portal reset failed:', portalErr?.message || portalErr);
    }

    if (offerLetterSync?.fileUrl) {
      try {
        await syncApplicationOfferLetter(existing.candidateId, existing.jobId, {
          ...offerLetterSync,
          placementId: id,
          placementStatus: 'OFFER_SENT',
          resetResponse: true,
        });
      } catch (offerSyncErr) {
        console.warn('[placement.resendOffer] portal offer letter sync failed:', offerSyncErr?.message || offerSyncErr);
      }
    }

    await syncCandidateStageFromPlacementStatus(
      { ...existing, id },
      'OFFER_SENT',
      userId,
      'placement-resend-offer'
    );

    const candidate = await prisma.candidate.findUnique({
      where: { id: existing.candidateId },
      select: { firstName: true, lastName: true, email: true },
    });
    const job = await prisma.job.findUnique({
      where: { id: existing.jobId },
      select: { title: true, client: { select: { companyName: true } } },
    });

    if (candidate?.email && offerLetterSync?.fileUrl) {
      try {
        await sendOfferReleasedEmail({
          toEmail: candidate.email,
          candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
          jobTitle: job?.title || 'the role',
          companyName: job?.client?.companyName || 'the company',
          offerDate: existing.offerDate || new Date(),
          senderUserId: userId,
        });
      } catch (emailErr) {
        console.warn('[placement.resendOffer] email failed:', emailErr?.message || emailErr);
      }
    }

    try {
      void pushPortalNotification(existing.candidateId, {
        type: 'application',
        title: 'Revised offer letter',
        description: `A new offer letter is available for ${job?.title || 'your role'}. Please review and respond.`,
        actionButton: 'View applications',
        actionPath: '/applications',
        metadata: {
          status: 'OFFER_SENT',
          jobId: existing.jobId,
          placementId: id,
          offerLetterUrl: offerLetterSync?.fileUrl || null,
          resent: true,
        },
      });
    } catch (notifyErr) {
      console.warn('[placement.resendOffer] notification failed:', notifyErr?.message || notifyErr);
    }

    return fetchPlacementOrThrow(id);
  },

  async delete(id, userId) {
    await removePlacementWithInterviewRevert(id, userId, 'Placement deleted');
    return { message: 'Placement deleted. Candidate moved back to Interviewing.' };
  },

  async undo(id, userId) {
    await removePlacementWithInterviewRevert(id, userId, 'Placement undone');
    return { message: 'Placement undone. Candidate moved back to Interviewing.' };
  },

  async exportCsv(req) {
    const where = await buildPlacementWhere(req.query);
    const placements = await prisma.placement.findMany({
      where,
      include: {
        candidate: {
          select: { firstName: true, lastName: true },
        },
        client: {
          select: { companyName: true },
        },
        job: {
          select: { title: true },
        },
        recruiter: {
          select: { name: true },
        },
        billing: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { paymentStatus: true },
        },
      },
      orderBy: { offerDate: 'desc' },
    });

    const headers = [
      'Placement ID',
      'Candidate',
      'Company',
      'Job',
      'Recruiter',
      'Salary',
      'Placement Fee',
      'Commission %',
      'Revenue',
      'Offer Date',
      'Joining Date',
      'Status',
      'Payment Status',
    ];

    const rows = placements.map((placement) => [
      placement.id,
      `${placement.candidate.firstName} ${placement.candidate.lastName}`.trim(),
      placement.client.companyName,
      placement.job.title,
      placement.recruiter?.name || '',
      placement.salaryOffered ?? placement.salary ?? '',
      placement.placementFee ?? placement.fee ?? '',
      placement.commissionPercentage ?? '',
      placement.revenue ?? placement.placementFee ?? placement.fee ?? '',
      placement.offerDate ? placement.offerDate.toISOString() : '',
      placement.joiningDate ? placement.joiningDate.toISOString() : '',
      placement.status,
      placement.billing?.[0]?.paymentStatus || 'PENDING',
    ]);

    return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  },

  async createInvoice(id, data = {}, userId) {
    const placement = await fetchPlacementOrThrow(id);

    const { recalcInvoiceTotals } = await import('../../utils/invoiceCalculations.js');

    const rawLineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
    const rawCharges = Array.isArray(data.additionalCharges) ? data.additionalCharges : [];
    const taxRate = Math.max(Number(data.taxRate) || 0, 0);

    const {
      lineItems,
      subtotal,
      taxAmount,
      total,
    } = recalcInvoiceTotals(rawLineItems, rawCharges, taxRate);

    const filteredLineItems = lineItems.filter((item) => item.name && item.quantity > 0);
    const additionalCharges = rawCharges
      .map((charge) => ({
        name: String(charge?.name || '').trim(),
        amount: Math.max(Number(charge?.amount) || 0, 0),
      }))
      .filter((charge) => charge.name && charge.amount > 0);

    if (!filteredLineItems.length) {
      throw new Error('At least one line item with a description is required');
    }

    if (!Number.isFinite(total) || total <= 0) {
      throw new Error('Invoice total must be greater than zero');
    }

    const currency = String(data.currency || 'USD').trim() || 'USD';
    const status = String(data.status || 'DRAFT').trim().toUpperCase() === 'SENT' ? 'SENT' : 'DRAFT';
    const invoiceDate = data.invoiceDate ? parseDate(data.invoiceDate, 'Invoice date') : new Date();
    const dueDate = data.dueDate
      ? parseDate(data.dueDate, 'Due date')
      : (() => {
          const next = new Date();
          next.setDate(next.getDate() + 30);
          return next;
        })();

    const candidateName = `${placement.candidate?.firstName || ''} ${placement.candidate?.lastName || ''}`.trim();
    const defaultPlacementSummary = {
      candidateName,
      jobTitle: placement.job?.title || '',
      clientName: placement.client?.companyName || '',
      offerDate: placement.offerDate,
      joiningDate: placement.joiningDate,
    };
    const invoicePayload = {
      lineItems: filteredLineItems,
      additionalCharges,
      subtotal,
      taxRate,
      taxAmount,
      total,
      buyer: data.buyer || null,
      seller: data.seller || null,
      placementSummary:
        data.placementSummary && typeof data.placementSummary === 'object'
          ? data.placementSummary
          : defaultPlacementSummary,
      ...(data.termsAndConditions ? { termsAndConditions: data.termsAndConditions } : {}),
      ...(data.legalTerms ? { legalTerms: data.legalTerms } : {}),
      ...(data.sellerBank ? { sellerBank: data.sellerBank } : {}),
      ...(data.buyerBank ? { buyerBank: data.buyerBank } : {}),
      ...(data.clientSignatory ? { clientSignatory: data.clientSignatory } : {}),
      ...(data.agencySignatory ? { agencySignatory: data.agencySignatory } : {}),
    };

    let createdBillingRecordId = null;

    await prisma.$transaction(async (tx) => {
      let invoiceNumber = String(data.invoiceNo || data.invoiceNumber || '').trim();
      if (!invoiceNumber) {
        const billingCount = await tx.placementBilling.count();
        invoiceNumber = `INV-${new Date().getFullYear()}-${String(billingCount + 1).padStart(4, '0')}`;
      }

      const duplicate = await tx.billingRecord.findFirst({
        where: { invoiceNumber },
        select: { id: true },
      });
      if (duplicate) {
        const billingCount = await tx.placementBilling.count();
        invoiceNumber = `INV-${new Date().getFullYear()}-${String(billingCount + 1).padStart(4, '0')}`;
      }

      await tx.placementBilling.create({
        data: {
          placementId: id,
          invoiceNumber,
          invoiceDate,
          amount: subtotal || total,
          taxPercentage: taxRate,
          taxAmount,
          totalAmount: total,
          paymentStatus: 'PENDING',
        },
      });

      const billingRecord = await tx.billingRecord.create({
        data: {
          clientId: placement.clientId,
          placementId: id,
          amount: total,
          subtotal,
          taxAmount,
          currency,
          status,
          dueDate,
          invoiceNumber,
          invoiceDate,
          invoicePayload,
          notes:
            data.notes?.trim() ||
            `Placement invoice for ${candidateName || placement.job?.title || 'candidate'}`,
        },
      });
      createdBillingRecordId = billingRecord.id;

      await createPlacementActivity(tx, id, 'Invoice created', userId, {
        invoiceNumber,
        amount: total,
        currency,
        status,
        billingRecordId: createdBillingRecordId,
      });
    });

    const refreshed = await fetchPlacementOrThrow(id);
    return {
      ...refreshed,
      createdInvoice: {
        id: createdBillingRecordId,
        invoiceNumber: refreshed.billing?.[0]?.invoiceNumber || data.invoiceNo,
      },
    };
  },
};
