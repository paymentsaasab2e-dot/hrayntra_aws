const { prisma, retryQuery } = require('../lib/prisma');
const { clampInterviewPrice, releaseInterviewerEarnings } = require('../services/interviewTokenBooking.service');
const { evaluateCandidateKyc } = require('../utils/candidateKyc.util');

const INTERNAL_ADMIN_KEY = process.env.INTERVIEW_ADMIN_KEY || process.env.INTERNAL_API_KEY || '';
const {
  recordAdminAudit,
  auditContextFromReq,
} = require('../services/audit.service');

function normalizeStatusLabel(status) {
  return String(status || '')
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function normalizeTextArray(value, limit = 50) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function toDateOrNull(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadCandidateKyc(candidateId) {
  if (!candidateId) return evaluateCandidateKyc();
  const [candidate, profile] = await Promise.all([
    retryQuery(async () =>
      prisma.candidate.findUnique({
        where: { id: candidateId },
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          whatsappNumber: true,
          avatar: true,
        },
      })
    ),
    retryQuery(async () =>
      prisma.candidateProfile.findUnique({
        where: { candidateId },
        select: {
          fullName: true,
          dateOfBirth: true,
          phoneNumber: true,
          passportNumber: true,
          profilePhotoUrl: true,
        },
      })
    ),
  ]);
  return evaluateCandidateKyc({ candidate, profile });
}

async function assertInterviewerKyc(candidateId) {
  const kyc = await loadCandidateKyc(candidateId);
  if (kyc.kycVerified) return kyc;
  const missing = kyc.missing.length ? ` Missing: ${kyc.missing.join(', ')}.` : '';
  const error = new Error(
    `Complete KYC / ID verification on your profile before applying as an interviewer.${missing}`,
  );
  error.status = 403;
  error.kyc = kyc;
  throw error;
}

async function getAccountProfilePhotoUrl(candidateId) {
  if (!candidateId) return null;
  const profile = await retryQuery(async () =>
    prisma.candidateProfile.findUnique({
      where: { candidateId },
      select: { profilePhotoUrl: true },
    })
  );
  const url = String(profile?.profilePhotoUrl || '').trim();
  return url || null;
}

const { parseSlotStart, mergePreferredSlot, encodeSlotProposal, decodeSlotProposal, assertFutureBookingDate, buildScheduledAtFromDateAndSlot } = require('../utils/interviewSlot.util');

function isAuthorizedForAdmin(req) {
  if (process.env.NODE_ENV !== 'production' && !INTERNAL_ADMIN_KEY) return true;
  const incoming = String(req.headers['x-internal-admin-key'] || '').trim();
  return Boolean(INTERNAL_ADMIN_KEY) && incoming === INTERNAL_ADMIN_KEY;
}

function readApplicationPayload(req) {
  const fullName = String(req.body?.fullName || '').trim();
  const currentCompany = String(req.body?.currentCompany || '').trim();
  const currentRole = String(req.body?.currentRole || '').trim();
  const yearsOfExperience = Number(req.body?.yearsOfExperience || 0);
  const expertiseAreas = normalizeTextArray(req.body?.expertiseAreas, 24);
  const interviewTypes = normalizeTextArray(req.body?.interviewTypes, 16);
  const languages = normalizeTextArray(req.body?.languages, 12);
  const weeklyAvailability = String(req.body?.weeklyAvailability || '').trim();
  const aboutYourself = String(req.body?.aboutYourself || '').trim();
  const feedbackStyle = String(req.body?.feedbackStyle || '').trim();
  const linkedinUrl = String(req.body?.linkedinUrl || '').trim();
  const resumeUrl = String(req.body?.resumeUrl || '').trim();
  const interviewPrice = clampInterviewPrice(req.body?.interviewPrice, 50);

  if (!fullName) return { error: 'Full name is required' };
  if (!currentRole) return { error: 'Current role is required' };
  if (!Number.isFinite(yearsOfExperience) || yearsOfExperience < 0) {
    return { error: 'Years of experience is invalid' };
  }
  if (!expertiseAreas.length) return { error: 'Select at least one expertise area' };
  if (!interviewTypes.length) return { error: 'Select at least one interview type' };
  if (!languages.length) return { error: 'Select at least one language' };
  if (weeklyAvailability.length < 5) return { error: 'Weekly availability is required' };
  if (aboutYourself.length < 20) return { error: 'About yourself must be at least 20 characters' };
  if (feedbackStyle.length < 10) return { error: 'Feedback style must be at least 10 characters' };

  return {
    data: {
      fullName,
      currentCompany: currentCompany || null,
      currentRole,
      yearsOfExperience: Math.floor(yearsOfExperience),
      expertiseAreas,
      interviewTypes,
      languages,
      weeklyAvailability,
      aboutYourself,
      feedbackStyle,
      interviewPrice,
      ...(linkedinUrl ? { linkedinUrl } : {}),
      ...(resumeUrl ? { resumeUrl } : {}),
    },
  };
}

async function submitInterviewerApplication(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Candidate authentication required' });
    }

    const parsed = readApplicationPayload(req);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    try {
      await assertInterviewerKyc(candidateId);
    } catch (kycError) {
      return res.status(kycError.status || 403).json({
        success: false,
        message: kycError.message,
        data: { kyc: kycError.kyc || { kycVerified: false, missing: [] } },
      });
    }

    const accountPhotoUrl = await getAccountProfilePhotoUrl(candidateId);

    const existingProfile = await retryQuery(async () =>
      prisma.interviewerProfile.findUnique({ where: { candidateId } })
    );
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Interviewer profile already exists for this candidate',
      });
    }

    const created = await retryQuery(async () =>
      prisma.interviewerApplication.create({
        data: {
          candidateId,
          ...parsed.data,
          profilePhotoUrl: accountPhotoUrl,
          status: 'SUBMITTED',
        },
      })
    );

    return res.status(201).json({
      success: true,
      message: 'Interviewer application submitted',
      data: {
        ...created,
        statusLabel: normalizeStatusLabel(created.status),
      },
    });
  } catch (error) {
    console.error('submitInterviewerApplication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit interviewer application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function updateMyInterviewerApplication(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Candidate authentication required' });
    }

    const parsed = readApplicationPayload(req);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    try {
      await assertInterviewerKyc(candidateId);
    } catch (kycError) {
      return res.status(kycError.status || 403).json({
        success: false,
        message: kycError.message,
        data: { kyc: kycError.kyc || { kycVerified: false, missing: [] } },
      });
    }

    const accountPhotoUrl = await getAccountProfilePhotoUrl(candidateId);

    const [latestApplication, existingProfile] = await Promise.all([
      retryQuery(async () =>
        prisma.interviewerApplication.findFirst({
          where: { candidateId },
          orderBy: { createdAt: 'desc' },
        })
      ),
      retryQuery(async () =>
        prisma.interviewerProfile.findUnique({
          where: { candidateId },
        })
      ),
    ]);

    if (!latestApplication && !existingProfile) {
      return res.status(404).json({
        success: false,
        message: 'No interviewer application found to update. Submit an application first.',
      });
    }

    const wasRejected = latestApplication?.status === 'REJECTED';
    let updatedApplication = latestApplication;

    if (latestApplication) {
      updatedApplication = await retryQuery(async () =>
        prisma.interviewerApplication.update({
          where: { id: latestApplication.id },
          data: {
            ...parsed.data,
            profilePhotoUrl: accountPhotoUrl,
            ...(wasRejected
              ? {
                  status: 'SUBMITTED',
                  reviewNotes: null,
                  reviewedBy: null,
                  reviewedAt: null,
                }
              : {}),
          },
        })
      );
    }

    let updatedProfile = existingProfile;
    if (existingProfile && !wasRejected) {
      updatedProfile = await retryQuery(async () =>
        prisma.interviewerProfile.update({
          where: { candidateId },
          data: {
            ...parsed.data,
            profilePhotoUrl: accountPhotoUrl,
          },
        })
      );
    } else if (wasRejected) {
      updatedProfile = null;
    }

    return res.json({
      success: true,
      message: wasRejected ? 'Interviewer application resubmitted' : 'Interviewer profile updated',
      data: {
        application: updatedApplication
          ? { ...updatedApplication, statusLabel: normalizeStatusLabel(updatedApplication.status) }
          : null,
        profile: updatedProfile,
      },
    });
  } catch (error) {
    console.error('updateMyInterviewerApplication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update interviewer application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function getMyInterviewerApplication(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Candidate authentication required' });
    }

    const [latestApplication, profile, kyc] = await Promise.all([
      retryQuery(async () =>
        prisma.interviewerApplication.findFirst({
          where: { candidateId },
          orderBy: { createdAt: 'desc' },
        })
      ),
      retryQuery(async () =>
        prisma.interviewerProfile.findUnique({
          where: { candidateId },
        })
      ),
      loadCandidateKyc(candidateId),
    ]);

    const liveProfile =
      profile &&
      String(profile.status || '').toUpperCase() !== 'INACTIVE' &&
      String(latestApplication?.status || '').toUpperCase() !== 'REJECTED'
        ? profile
        : null;

    return res.json({
      success: true,
      data: {
        application: latestApplication
          ? { ...latestApplication, statusLabel: normalizeStatusLabel(latestApplication.status) }
          : null,
        profile: liveProfile,
        kyc,
      },
    });
  } catch (error) {
    console.error('getMyInterviewerApplication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load interviewer application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function reviewInterviewerApplication(req, res) {
  try {
    if (!isAuthorizedForAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Not authorized for admin review' });
    }

    const applicationId = String(req.params?.applicationId || '').trim();
    const decision = String(req.body?.decision || '').trim().toUpperCase();
    const reviewNotes = String(req.body?.reviewNotes || '').trim();
    const reviewedBy = String(req.body?.reviewedBy || 'admin').trim();

    if (!applicationId) return res.status(400).json({ success: false, message: 'Application ID is required' });
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return res.status(400).json({ success: false, message: 'Decision must be APPROVE or REJECT' });
    }

    const application = await retryQuery(async () =>
      prisma.interviewerApplication.findUnique({
        where: { id: applicationId },
      })
    );
    if (!application) {
      return res.status(404).json({ success: false, message: 'Interviewer application not found' });
    }

    const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const reviewedAt = new Date();

    const updatedApplication = await retryQuery(async () =>
      prisma.interviewerApplication.update({
        where: { id: application.id },
        data: {
          status,
          reviewNotes: reviewNotes || null,
          reviewedBy,
          reviewedAt,
        },
      })
    );

    if (status === 'APPROVED') {
      const accountPhotoUrl =
        (await getAccountProfilePhotoUrl(application.candidateId)) || application.profilePhotoUrl || null;
      await retryQuery(async () =>
        prisma.interviewerProfile.upsert({
          where: { candidateId: application.candidateId },
          update: {
            fullName: application.fullName,
            currentCompany: application.currentCompany,
            currentRole: application.currentRole,
            yearsOfExperience: application.yearsOfExperience,
            expertiseAreas: application.expertiseAreas,
            interviewTypes: application.interviewTypes,
            languages: application.languages,
            weeklyAvailability: application.weeklyAvailability,
            aboutYourself: application.aboutYourself,
            feedbackStyle: application.feedbackStyle,
            linkedinUrl: application.linkedinUrl,
            resumeUrl: application.resumeUrl,
            profilePhotoUrl: accountPhotoUrl,
            interviewPrice: clampInterviewPrice(application.interviewPrice, 50),
            status: 'AVAILABLE',
          },
          create: {
            candidateId: application.candidateId,
            fullName: application.fullName,
            currentCompany: application.currentCompany,
            currentRole: application.currentRole,
            yearsOfExperience: application.yearsOfExperience,
            expertiseAreas: application.expertiseAreas,
            interviewTypes: application.interviewTypes,
            languages: application.languages,
            weeklyAvailability: application.weeklyAvailability,
            aboutYourself: application.aboutYourself,
            feedbackStyle: application.feedbackStyle,
            linkedinUrl: application.linkedinUrl,
            resumeUrl: application.resumeUrl,
            profilePhotoUrl: accountPhotoUrl,
            interviewPrice: clampInterviewPrice(application.interviewPrice, 50),
            status: 'AVAILABLE',
          },
        })
      );
    }

    await retryQuery(async () =>
      prisma.notification.create({
        data: {
          candidateId: application.candidateId,
          type: 'interview',
          title: status === 'APPROVED' ? 'Interviewer application approved' : 'Interviewer application rejected',
          description:
            status === 'APPROVED'
              ? 'You are now available as an interviewer.'
              : reviewNotes || 'Please update your application and try again.',
          actionButton: 'Open Interview Prep',
          actionPath: '/lms/interview-prep/become-interviewer',
          metadata: {
            applicationId: application.id,
            status,
          },
        },
      })
    ).catch(() => {});

    recordAdminAudit({
      ...auditContextFromReq(req, {
        source: 'interviewer.admin',
        actorLabel: reviewedBy || 'admin',
      }),
      action:
        status === 'APPROVED'
          ? 'interviewer.application_approve'
          : 'interviewer.application_reject',
      entityType: 'interviewer_application',
      entityId: application.id,
      status: 'success',
      metadata: {
        candidateId: application.candidateId,
        decision: status,
        reviewNotes: reviewNotes || null,
      },
    });

    return res.json({
      success: true,
      data: {
        ...updatedApplication,
        statusLabel: normalizeStatusLabel(updatedApplication.status),
      },
    });
  } catch (error) {
    console.error('reviewInterviewerApplication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to review interviewer application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function getInterviewerQueue(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Candidate authentication required' });
    }

    const profile = await retryQuery(async () =>
      prisma.interviewerProfile.findUnique({
        where: { candidateId },
      })
    );
    const latestApplication = await retryQuery(async () =>
      prisma.interviewerApplication.findFirst({
        where: { candidateId },
        orderBy: { createdAt: 'desc' },
      })
    );

    if (!profile && !latestApplication) {
      return res.status(403).json({ success: false, message: 'Submit interviewer application first' });
    }

    const requests = await retryQuery(async () =>
      prisma.interviewRequest.findMany({
        where: {
          OR: [
            {
              interviewerId: candidateId,
              status: { in: ['WAITING_FOR_ACCEPTANCE', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] },
            },
            ...(profile || latestApplication
              ? [
                  {
                    interviewerId: null,
                    status: { in: ['FINDING_INTERVIEWER', 'MATCHING'] },
                  },
                ]
              : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
      })
    );

    const candidateIds = [...new Set(requests.map((item) => item.candidateId))];
    const [profiles, resumes] = await Promise.all([
      candidateIds.length
        ? retryQuery(async () =>
            prisma.candidateProfile.findMany({
              where: { candidateId: { in: candidateIds } },
              select: { candidateId: true, fullName: true, email: true, phoneNumber: true },
            })
          )
        : [],
      candidateIds.length
        ? retryQuery(async () =>
            prisma.resume.findMany({
              where: { candidateId: { in: candidateIds } },
              select: { candidateId: true, fileUrl: true, atsScore: true },
            })
          )
        : [],
    ]);

    const profileByCandidateId = new Map(profiles.map((row) => [String(row.candidateId), row]));
    const resumeByCandidateId = new Map(resumes.map((row) => [String(row.candidateId), row]));

    return res.json({
      success: true,
      data: requests.map((row) => {
        const candidateProfile = profileByCandidateId.get(String(row.candidateId)) || null;
        const candidateResume = resumeByCandidateId.get(String(row.candidateId)) || null;
        const fromInterviewer = decodeSlotProposal(row.interviewerFeedback);
        const fromCandidate = decodeSlotProposal(row.candidateFeedback);
        const preferredTimes = Array.isArray(row.preferredTime) ? row.preferredTime : [];
        const latestCustomSlot =
          [...preferredTimes]
            .reverse()
            .map((item) => String(item || '').trim())
            .find((item) => /^\d{1,2}:\d{2}$/.test(item)) || null;
        const candidateSlot = fromCandidate.slot || latestCustomSlot;
        const waitingOnCandidate = String(row.status || '') === 'WAITING_FOR_ACCEPTANCE' && Boolean(candidateSlot);
        return {
          ...row,
          statusLabel: normalizeStatusLabel(row.status),
          proposedSlot: waitingOnCandidate
            ? candidateSlot
            : fromInterviewer.slot || candidateSlot || null,
          proposedDate: waitingOnCandidate
            ? fromCandidate.date
            : fromInterviewer.date || fromCandidate.date || null,
          candidateProposedSlot: candidateSlot || null,
          candidateProposedDate: fromCandidate.date || null,
          candidateProfile,
          candidateResume,
        };
      }),
    });
  } catch (error) {
    console.error('getInterviewerQueue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load interviewer request queue',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function respondToInterviewRequest(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    const requestId = String(req.params?.requestId || '').trim();
    const decision = String(req.body?.decision || '').trim().toUpperCase();
    const proposedSlot = String(req.body?.proposedSlot || '').trim();
    const proposedDate = toDateOrNull(req.body?.preferredDate || req.body?.proposedDate);
    if (!candidateId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request IDs are required' });
    }
    if (decision !== 'ACCEPT' && decision !== 'REJECT') {
      return res.status(400).json({ success: false, message: 'Decision must be ACCEPT or REJECT' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findUnique({
        where: { id: requestId },
      })
    );
    if (!request) {
      return res.status(404).json({ success: false, message: 'Interview request not found' });
    }

    const latestApplication = await retryQuery(async () =>
      prisma.interviewerApplication.findFirst({
        where: { candidateId },
        orderBy: { createdAt: 'desc' },
      })
    );
    const profile = await retryQuery(async () =>
      prisma.interviewerProfile.findUnique({ where: { candidateId } })
    );
    const canActAsInterviewer = Boolean(profile || latestApplication);
    if (!canActAsInterviewer) {
      return res.status(403).json({ success: false, message: 'Submit interviewer application first' });
    }

    const isAssignedToMe = String(request.interviewerId || '') === candidateId;
    const isOpenMarketplaceRequest =
      !request.interviewerId &&
      (request.status === 'FINDING_INTERVIEWER' || request.status === 'MATCHING');

    if (!isAssignedToMe && !isOpenMarketplaceRequest) {
      return res.status(404).json({ success: false, message: 'Interview request not found in your queue' });
    }

    if (decision === 'ACCEPT') {
      const fromCandidate = decodeSlotProposal(request.candidateFeedback);
      const preferredTimes = Array.isArray(request.preferredTime) ? request.preferredTime : [];
      const latestPreferred = [...preferredTimes].reverse().find((item) => parseSlotStart(item)) || '';
      const slotToUse =
        proposedSlot && parseSlotStart(proposedSlot)
          ? proposedSlot
          : fromCandidate.slot || latestPreferred || request.preferredTime?.[0] || '';
      if (proposedSlot && !parseSlotStart(proposedSlot)) {
        return res.status(400).json({ success: false, message: 'Proposed time is invalid. Use HH:MM or a listed slot.' });
      }
      const dateToUse = proposedDate || toDateOrNull(fromCandidate.date) || request.preferredDate;
      if (!dateToUse) {
        return res.status(400).json({ success: false, message: 'Please pick a valid date' });
      }
      const dateCheck = assertFutureBookingDate(dateToUse);
      if (dateCheck.error) {
        return res.status(400).json({ success: false, message: dateCheck.error });
      }
      const safeDate = dateCheck.date;
      const nextScheduledAt =
        buildScheduledAtFromDateAndSlot(safeDate, slotToUse) || safeDate;
      const alreadyPaid = Boolean(request.paymentHeldAt);
      const confirmingCandidateProposal =
        alreadyPaid && String(request.status) === 'WAITING_FOR_ACCEPTANCE';
      const nextStatus = confirmingCandidateProposal ? 'SCHEDULED' : 'ACCEPTED';
      const updated = await retryQuery(async () =>
        prisma.interviewRequest.update({
          where: { id: request.id },
          data: {
            interviewerId: candidateId,
            status: nextStatus,
            acceptedAt: request.acceptedAt || new Date(),
            scheduledAt: confirmingCandidateProposal
              ? nextScheduledAt
              : alreadyPaid
                ? request.scheduledAt
                : nextScheduledAt,
            preferredDate: safeDate,
            preferredTime: mergePreferredSlot(request.preferredTime, slotToUse),
            interviewPrice: clampInterviewPrice(
              request.interviewPrice ?? profile?.interviewPrice ?? latestApplication?.interviewPrice,
              50
            ),
            interviewerFeedback: slotToUse
              ? encodeSlotProposal(slotToUse, safeDate, '')
              : request.interviewerFeedback,
            candidateFeedback: String(request.candidateFeedback || '').startsWith('SLOT_PROPOSAL::')
              ? null
              : request.candidateFeedback,
          },
        })
      );

      await retryQuery(async () =>
        prisma.notification.create({
          data: {
            candidateId: request.candidateId,
            type: 'interview',
            title: confirmingCandidateProposal
              ? 'New interview time confirmed'
              : alreadyPaid
                ? 'Interviewer proposed a new time'
                : 'Interviewer proposed an interview slot',
            description: confirmingCandidateProposal
              ? `Request ${request.requestId} is confirmed for ${slotToUse}. No extra tokens were charged.`
              : alreadyPaid
                ? `Request ${request.requestId}: confirm the new time at no extra cost.`
                : `Request ${request.requestId} is waiting for your confirmation.`,
            actionButton: confirmingCandidateProposal ? 'View interviews' : 'Confirm slot',
            actionPath: '/lms/interview-prep/request-interview',
            metadata: {
              requestId: request.requestId,
              status: nextStatus,
              proposedSlot: slotToUse || null,
            },
          },
        })
      ).catch(() => {});

      return res.json({
        success: true,
        data: { ...updated, statusLabel: normalizeStatusLabel(updated.status) },
      });
    }

    const updated = await retryQuery(async () =>
      prisma.interviewRequest.update({
        where: { id: request.id },
        data: isAssignedToMe
          ? {
              status: 'REJECTED',
              rejectedAt: new Date(),
            }
          : {
              status: 'FINDING_INTERVIEWER',
              rejectedAt: new Date(),
              interviewerId: null,
              matchingScore: null,
            },
      })
    );

    await retryQuery(async () =>
      prisma.notification.create({
        data: {
          candidateId: request.candidateId,
          type: 'interview',
          title: isAssignedToMe ? 'Interviewer declined your request' : 'Interviewer declined your request',
          description: isAssignedToMe
            ? `Request ${request.requestId} was rejected. No tokens were charged.`
            : `Request ${request.requestId} will be matched with another interviewer.`,
          actionButton: 'Track request',
          actionPath: '/lms/interview-prep/request-interview',
          metadata: {
            requestId: request.requestId,
            status: isAssignedToMe ? 'REJECTED' : 'FINDING_INTERVIEWER',
          },
        },
      })
    ).catch(() => {});

    return res.json({
      success: true,
      data: { ...updated, statusLabel: normalizeStatusLabel(updated.status) },
    });
  } catch (error) {
    console.error('respondToInterviewRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update interview request decision',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function scheduleInterviewRequest(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    const requestId = String(req.params?.requestId || '').trim();
    const slot = String(req.body?.slot || '').trim();
    const note = String(req.body?.note || '').trim();
    const proposedDate = toDateOrNull(req.body?.preferredDate || req.body?.proposedDate);
    if (!candidateId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request IDs are required' });
    }
    if (!slot) {
      return res.status(400).json({ success: false, message: 'Slot is required' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findUnique({
        where: { id: requestId },
      })
    );
    if (!request || String(request.interviewerId || '') !== candidateId) {
      return res.status(404).json({ success: false, message: 'Interview request not found in your queue' });
    }
    if (!['ACCEPTED', 'WAITING_FOR_ACCEPTANCE', 'SCHEDULED'].includes(String(request.status || ''))) {
      return res.status(400).json({
        success: false,
        message: 'Slot proposal can be sent for accepted, scheduled, or waiting requests',
      });
    }
    if (!parseSlotStart(slot)) {
      return res.status(400).json({ success: false, message: 'Selected time is invalid. Use HH:MM or a listed slot.' });
    }

    const dateToUse = proposedDate || request.preferredDate;
    if (!dateToUse) {
      return res.status(400).json({ success: false, message: 'Please pick a valid date' });
    }
    const dateCheck = assertFutureBookingDate(dateToUse);
    if (dateCheck.error) {
      return res.status(400).json({ success: false, message: dateCheck.error });
    }
    const safeDate = dateCheck.date;
    const alreadyPaid = Boolean(request.paymentHeldAt);
    const feedback = encodeSlotProposal(slot, safeDate, note);
    const updated = await retryQuery(async () =>
      prisma.interviewRequest.update({
        where: { id: request.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: request.acceptedAt || new Date(),
          interviewerFeedback: feedback,
          preferredDate: safeDate,
          preferredTime: mergePreferredSlot(request.preferredTime, slot),
          scheduledAt: alreadyPaid
            ? request.scheduledAt
            : buildScheduledAtFromDateAndSlot(safeDate, slot) || request.scheduledAt || safeDate,
        },
      })
    );

    await retryQuery(async () =>
      prisma.notification.create({
        data: {
          candidateId: request.candidateId,
          type: 'interview',
          title: 'Interviewer proposed final slot',
          description: `Request ${request.requestId}: ${slot}. Please accept or reject this slot.`,
          actionButton: 'Accept or reject slot',
          actionPath: '/lms/interview-prep/request-interview',
          metadata: { requestId: request.requestId, status: 'ACCEPTED', slot },
        },
      })
    ).catch(() => {});

    return res.json({
      success: true,
      data: { ...updated, statusLabel: normalizeStatusLabel(updated.status) },
    });
  } catch (error) {
    console.error('scheduleInterviewRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to schedule interview request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

function scoreMarketplaceInterviewer(filters, profile) {
  let score = 0;
  const requestCategory = String(filters.category || '').toLowerCase();
  const requestType = String(filters.interviewType || '').toLowerCase();
  const requestLanguage = String(filters.language || '').toLowerCase();
  const requestTech = Array.isArray(filters.techStack)
    ? filters.techStack.map((s) => String(s).toLowerCase())
    : [];
  const expertise = Array.isArray(profile.expertiseAreas)
    ? profile.expertiseAreas.map((s) => String(s).toLowerCase())
    : [];
  const interviewTypes = Array.isArray(profile.interviewTypes)
    ? profile.interviewTypes.map((s) => String(s).toLowerCase())
    : [];
  const languages = Array.isArray(profile.languages)
    ? profile.languages.map((s) => String(s).toLowerCase())
    : [];

  if (expertise.some((item) => item.includes(requestCategory) || requestCategory.includes(item))) {
    score += 30;
  }
  if (requestTech.length > 0) {
    const overlapCount = requestTech.filter((tech) => expertise.includes(tech)).length;
    score += Math.round((overlapCount / requestTech.length) * 30);
  }
  if (interviewTypes.some((item) => item.includes(requestType) || requestType.includes(item))) {
    score += 15;
  }
  if (languages.some((item) => item.includes(requestLanguage) || requestLanguage.includes(item))) {
    score += 15;
  }
  const rating = Number(profile.ratingAverage || 0);
  if (rating > 0) score += Math.round((Math.min(5, rating) / 5) * 10);
  return score;
}

function toMarketplaceCard(row, photoByCandidateId, kycByCandidateId) {
  const candidateId = String(row.candidateId);
  return {
    candidateId,
    fullName: row.fullName,
    currentRole: row.currentRole,
    currentCompany: row.currentCompany,
    yearsOfExperience: row.yearsOfExperience,
    expertiseAreas: row.expertiseAreas || [],
    interviewTypes: row.interviewTypes || [],
    languages: row.languages || [],
    weeklyAvailability: row.weeklyAvailability || '',
    aboutYourself: row.aboutYourself || '',
    feedbackStyle: row.feedbackStyle || '',
    ratingAverage: Number(row.ratingAverage || 0),
    totalRatings: Number(row.totalRatings || 0),
    totalInterviews: Number(row.totalInterviews || 0),
    interviewPrice: clampInterviewPrice(row.interviewPrice, 50),
    profilePhotoUrl: photoByCandidateId.get(candidateId) || row.profilePhotoUrl || null,
    kycVerified: Boolean(kycByCandidateId?.get(candidateId)),
  };
}

async function listMarketplaceInterviewers(req, res) {
  try {
    const viewerId = String(req.user?.candidateId || '').trim();
    const category = String(req.query?.category || '').trim();
    const interviewType = String(req.query?.interviewType || '').trim();
    const language = String(req.query?.language || '').trim();
    const techStack = String(req.query?.techStack || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const [profiles, applications] = await Promise.all([
      retryQuery(async () =>
        prisma.interviewerProfile.findMany({
          where: { status: { in: ['AVAILABLE', 'BUSY'] } },
          orderBy: [{ ratingAverage: 'desc' }, { totalInterviews: 'desc' }],
          take: 200,
        })
      ),
      retryQuery(async () =>
        prisma.interviewerApplication.findMany({
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 400,
        })
      ),
    ]);

    const interviewerIds = [
      ...new Set([
        ...profiles.map((row) => String(row.candidateId)),
        ...applications.map((row) => String(row.candidateId)),
      ]),
    ].filter((id) => id && id !== viewerId);

    const photos = interviewerIds.length
      ? await retryQuery(async () =>
          prisma.candidateProfile.findMany({
            where: { candidateId: { in: interviewerIds } },
            select: {
              candidateId: true,
              profilePhotoUrl: true,
              fullName: true,
              dateOfBirth: true,
              phoneNumber: true,
              passportNumber: true,
            },
          })
        )
      : [];

    const candidates = interviewerIds.length
      ? await retryQuery(async () =>
          prisma.candidate.findMany({
            where: { id: { in: interviewerIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              whatsappNumber: true,
              avatar: true,
            },
          })
        )
      : [];

    const photoByCandidateId = new Map(
      photos
        .filter((row) => row.profilePhotoUrl)
        .map((row) => [String(row.candidateId), row.profilePhotoUrl])
    );
    const profileById = new Map(photos.map((row) => [String(row.candidateId), row]));
    const candidateById = new Map(candidates.map((row) => [String(row.id), row]));
    const kycByCandidateId = new Map(
      interviewerIds.map((id) => {
        const kyc = evaluateCandidateKyc({
          candidate: candidateById.get(id),
          profile: profileById.get(id),
        });
        return [id, kyc.kycVerified];
      })
    );

    const byId = new Map();
    for (const app of applications) {
      const id = String(app.candidateId);
      if (viewerId && id === viewerId) continue;
      if (!byId.has(id)) {
        byId.set(id, toMarketplaceCard({ ...app, ratingAverage: 0, totalRatings: 0, totalInterviews: 0 }, photoByCandidateId, kycByCandidateId));
      }
    }
    for (const profile of profiles) {
      const id = String(profile.candidateId);
      if (viewerId && id === viewerId) continue;
      byId.set(id, toMarketplaceCard(profile, photoByCandidateId, kycByCandidateId));
    }

    const filters = { category, interviewType, language, techStack };
    const data = [...byId.values()]
      .map((card) => ({
        ...card,
        matchingScore: scoreMarketplaceInterviewer(filters, card),
      }))
      .filter((card) => card.kycVerified)
      .sort((a, b) => b.matchingScore - a.matchingScore || b.ratingAverage - a.ratingAverage)
      .slice(0, 40);

    return res.json({ success: true, data });
  } catch (error) {
    console.error('listMarketplaceInterviewers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load interviewers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function completeInterviewRequest(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    const requestId = String(req.params?.requestId || '').trim();
    const feedback = String(req.body?.feedback || req.body?.interviewerFeedback || '').trim();
    const remarks = String(req.body?.remarks || '').trim();
    const rating = Number(req.body?.rating);
    if (!candidateId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request IDs are required' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findUnique({ where: { id: requestId } })
    );
    if (!request || String(request.interviewerId || '') !== candidateId) {
      return res.status(404).json({ success: false, message: 'Interview request not found in your queue' });
    }
    const status = String(request.status || '');
    if (!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Interview can be completed only after it is scheduled',
      });
    }

    const combinedFeedback = [feedback, remarks].filter(Boolean).join('\n').slice(0, 4000);
    const alreadyPaid = Boolean(request.payoutReleasedAt);
    let payout = { alreadyPaid: true, granted: 0, fee: clampInterviewPrice(request.interviewPrice, 50) };

    if (!alreadyPaid && request.paymentHeldAt) {
      payout = await releaseInterviewerEarnings({
        interviewerId: candidateId,
        requestDbId: request.id,
        amount: request.interviewPrice,
      });
    }

    const updated = await retryQuery(async () =>
      prisma.interviewRequest.update({
        where: { id: request.id },
        data: {
          status: 'COMPLETED',
          completedAt: request.completedAt || new Date(),
          interviewerFeedback: combinedFeedback || request.interviewerFeedback,
          interviewerRating: Number.isFinite(rating) ? Math.max(1, Math.min(5, Math.round(rating))) : request.interviewerRating,
          payoutReleasedAt: request.payoutReleasedAt || (request.paymentHeldAt ? new Date() : null),
        },
      })
    );

    await retryQuery(async () =>
      prisma.notification.create({
        data: {
          candidateId: request.candidateId,
          type: 'interview',
          title: 'Interview completed',
          description: `Request ${request.requestId} is complete. ${payout.fee} tokens were released to the interviewer.`,
          actionButton: 'View request',
          actionPath: '/lms/interview-prep/request-interview',
          metadata: { requestId: request.requestId, status: 'COMPLETED' },
        },
      })
    ).catch(() => {});

    return res.json({
      success: true,
      data: {
        ...updated,
        statusLabel: normalizeStatusLabel(updated.status),
        payoutTokens: payout.granted || (alreadyPaid ? payout.fee : 0),
      },
    });
  } catch (error) {
    console.error('completeInterviewRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete interview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  submitInterviewerApplication,
  updateMyInterviewerApplication,
  getMyInterviewerApplication,
  reviewInterviewerApplication,
  getInterviewerQueue,
  respondToInterviewRequest,
  scheduleInterviewRequest,
  listMarketplaceInterviewers,
  completeInterviewRequest,
};
