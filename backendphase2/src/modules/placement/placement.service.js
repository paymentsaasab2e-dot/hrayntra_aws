import { prisma } from '../../config/prisma.js';
import { sendPlacementEmail } from '../../emails/email.service.js';
import {
  PIPELINE_STAGES,
  syncApplicationOfferLetter,
  updateCandidateStage,
} from '../stage/candidateStage.service.js';
import {
  createUserNotification,
  pushPortalNotification,
} from '../notification/notification.service.js';

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
  if (!['FAILED', 'NO_SHOW', 'WITHDRAWN', 'REPLACEMENT_REQUIRED', 'JOINED', 'JOINING_SCHEDULED', 'OFFER_ACCEPTED'].includes(normalized)) {
    throw new Error('Invalid placement status');
  }
  return normalized;
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

  return {
    ...placement,
    paymentStatus: latestBilling?.paymentStatus || 'PENDING',
    invoiceNumber: latestBilling?.invoiceNumber || null,
    offerLetterUrl: offerLetter?.fileUrl || null,
  };
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
      client: true,
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

  return placement;
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
          status: { in: ['OFFER_ACCEPTED', 'JOINING_SCHEDULED'] },
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
            select: { id: true, companyName: true },
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
    console.log('[Placement] getAll: total=', total, 'list length=', list.length, 'where deletedAt=', where.deletedAt);
    return {
      data: list,
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
    const joiningDate = parseDate(data.expectedJoiningDate ?? data.joiningDate, 'Expected joining date');
    const employmentType = normalizeEmploymentType(data.employmentType);
    if (!employmentType) {
      throw new Error('Employment type is required');
    }

    const [candidate, job, recruiter] = await Promise.all([
      prisma.candidate.findUnique({
        where: { id: data.candidateId },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      prisma.job.findUnique({
        where: { id: data.jobId },
        select: { id: true, title: true, clientId: true },
      }),
      prisma.user.findUnique({
        where: { id: data.recruiterId || userId },
        select: { id: true, name: true },
      }),
    ]);

    if (!candidate) throw new Error('Candidate not found');
    if (!job) throw new Error('Job not found');
    if (!recruiter) throw new Error('Recruiter not found');

    const clientId = data.companyId || data.clientId || job.clientId;
    assertObjectId(clientId, 'companyId');

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
          startDate: joiningDate || offerDate,
          offerDate,
          joiningDate,
          salary: salaryOffered,
          salaryOffered,
          fee: placementFee,
          placementFee,
          feeType: 'PERCENTAGE',
          commissionPercentage,
          revenue: placementFee,
          employmentType,
          status: joiningDate ? 'JOINING_SCHEDULED' : 'OFFER_ACCEPTED',
          notes: data.notes?.trim() || null,
          deletedAt: null,
        },
      });

      const billingCount = await tx.placementBilling.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(billingCount + 1).padStart(4, '0')}`;

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
        status: joiningDate ? 'JOINING_SCHEDULED' : 'OFFER_ACCEPTED',
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
            status: joiningDate ? 'JOINING_SCHEDULED' : 'OFFER_ACCEPTED',
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
        await syncApplicationOfferLetter(candidate.id, job.id, offerLetterToMirror);
      } catch (offerSyncError) {
        console.warn(
          '[placement.create] portal offer letter sync failed:',
          offerSyncError?.message || offerSyncError
        );
      }
    }

    if (candidate.email) {
      await sendPlacementEmail(
        candidate.email,
        `${candidate.firstName} ${candidate.lastName}`,
        job.title,
        joiningDate || offerDate,
        client.companyName
      );
    }

    await updateCandidateStage({
      candidateId: candidate.id,
      jobId: job.id,
      stage: PIPELINE_STAGES.HIRED,
      metadata: { placementId: placementResult.id, jobTitle: job.title, offerDate: offerDate?.toISOString?.() || String(offerDate) },
      performedById: userId,
      skipStageActivity: true,
    });

    // CRM bell + portal bell notifications. Best-effort.
    try {
      const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`
        .trim() || 'Candidate';
      const recipients = new Set([userId, recruiter.id].filter(Boolean));
      await Promise.allSettled(
        Array.from(recipients).map((uid) =>
          createUserNotification(uid, {
            category: 'PLACEMENT',
            title: 'Placement created',
            description: `${candidateName} placed at ${client.companyName} for ${job.title}.`,
            actionLabel: 'View placement',
            actionPath: `/placement?placementId=${placementResult.id}`,
            entityType: 'PLACEMENT',
            entityId: placementResult.id,
            metadata: {
              candidateId: candidate.id,
              jobId: job.id,
              clientId: client.id,
              hasOfferLetter: !!offerLetterToMirror?.fileUrl,
            },
          })
        )
      );
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

    return fetchPlacementOrThrow(updatedPlacement.id);
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

    return fetchPlacementOrThrow(id);
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

    return fetchPlacementOrThrow(id);
  },

  async delete(id, userId) {
    const existing = await fetchPlacementOrThrow(id);
    if (existing.status === 'JOINED') {
      throw new Error('Cannot delete a confirmed placement');
    }

    await prisma.$transaction(async (tx) => {
      await tx.placement.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await createPlacementActivity(tx, id, 'Placement deleted', userId, {});
    });

    return { message: 'Placement deleted successfully' };
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
};
