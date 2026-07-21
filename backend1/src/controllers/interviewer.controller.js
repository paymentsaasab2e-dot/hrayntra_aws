const { prisma, retryQuery } = require('../lib/prisma');

const INTERNAL_ADMIN_KEY = process.env.INTERVIEW_ADMIN_KEY || process.env.INTERNAL_API_KEY || '';

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
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseSlotStart(slotValue) {
  const raw = String(slotValue || '').trim();
  if (!raw) return null;
  const dashFormat = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(raw);
  if (dashFormat) {
    const hour = Number(dashFormat[1]);
    const minute = Number(dashFormat[2]);
    if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
  }
  const amPmFormat = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)$/i.exec(raw);
  if (amPmFormat) {
    let hour = Number(amPmFormat[1]);
    const minute = Number(amPmFormat[2]);
    const period = String(amPmFormat[3]).toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
  }
  return null;
}

function buildScheduledAtFromDateAndSlot(dateValue, slotValue) {
  const date = toDateOrNull(dateValue);
  const slot = parseSlotStart(slotValue);
  if (!date || !slot) return null;
  const scheduled = new Date(date);
  scheduled.setHours(slot.hour, slot.minute, 0, 0);
  return scheduled;
}

function isAuthorizedForAdmin(req) {
  if (process.env.NODE_ENV !== 'production' && !INTERNAL_ADMIN_KEY) return true;
  const incoming = String(req.headers['x-internal-admin-key'] || '').trim();
  return Boolean(INTERNAL_ADMIN_KEY) && incoming === INTERNAL_ADMIN_KEY;
}

async function submitInterviewerApplication(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Candidate authentication required' });
    }

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

    if (!fullName) return res.status(400).json({ success: false, message: 'Full name is required' });
    if (!currentRole) return res.status(400).json({ success: false, message: 'Current role is required' });
    if (!Number.isFinite(yearsOfExperience) || yearsOfExperience < 0) {
      return res.status(400).json({ success: false, message: 'Years of experience is invalid' });
    }
    if (!expertiseAreas.length) return res.status(400).json({ success: false, message: 'Select at least one expertise area' });
    if (!interviewTypes.length) return res.status(400).json({ success: false, message: 'Select at least one interview type' });
    if (!languages.length) return res.status(400).json({ success: false, message: 'Select at least one language' });
    if (weeklyAvailability.length < 5) return res.status(400).json({ success: false, message: 'Weekly availability is required' });
    if (aboutYourself.length < 20) return res.status(400).json({ success: false, message: 'About yourself must be at least 20 characters' });
    if (feedbackStyle.length < 10) return res.status(400).json({ success: false, message: 'Feedback style must be at least 10 characters' });

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
          linkedinUrl: linkedinUrl || null,
          resumeUrl: resumeUrl || null,
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

async function getMyInterviewerApplication(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Candidate authentication required' });
    }

    const [latestApplication, profile] = await Promise.all([
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

    return res.json({
      success: true,
      data: {
        application: latestApplication
          ? { ...latestApplication, statusLabel: normalizeStatusLabel(latestApplication.status) }
          : null,
        profile,
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
              status: { in: ['WAITING_FOR_ACCEPTANCE', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS'] },
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
        return {
          ...row,
          statusLabel: normalizeStatusLabel(row.status),
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
      const slotToUse =
        proposedSlot && request.preferredTime.includes(proposedSlot)
          ? proposedSlot
          : request.preferredTime?.[0] || '';
      const scheduledAt =
        buildScheduledAtFromDateAndSlot(request.preferredDate, slotToUse) || new Date(request.preferredDate);
      const updated = await retryQuery(async () =>
        prisma.interviewRequest.update({
          where: { id: request.id },
          data: {
            interviewerId: candidateId,
            status: 'ACCEPTED',
            acceptedAt: new Date(),
            scheduledAt,
            interviewerFeedback: slotToUse ? `SLOT_PROPOSAL::${slotToUse}` : request.interviewerFeedback,
          },
        })
      );

      await retryQuery(async () =>
        prisma.notification.create({
          data: {
            candidateId: request.candidateId,
            type: 'interview',
            title: 'Interviewer proposed an interview slot',
            description: `Request ${request.requestId} is waiting for your confirmation.`,
            actionButton: 'Confirm slot',
            actionPath: '/lms/interview-prep/request-interview',
            metadata: { requestId: request.requestId, status: 'ACCEPTED', proposedSlot: slotToUse || null },
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
        data: {
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
          title: 'Interviewer declined your request',
          description: `Request ${request.requestId} will be matched with another interviewer.`,
          actionButton: 'Track request',
          actionPath: '/lms/interview-prep/request-interview',
          metadata: { requestId: request.requestId, status: 'FINDING_INTERVIEWER' },
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
    if (!['ACCEPTED', 'WAITING_FOR_ACCEPTANCE'].includes(String(request.status || ''))) {
      return res.status(400).json({
        success: false,
        message: 'Slot proposal can be sent only for accepted requests awaiting candidate action',
      });
    }
    if (!Array.isArray(request.preferredTime) || !request.preferredTime.includes(slot)) {
      return res.status(400).json({ success: false, message: 'Selected slot must be from candidate preferred slots' });
    }

    const feedback = note ? `SLOT_PROPOSAL::${slot}||${note}` : `SLOT_PROPOSAL::${slot}`;
    const updated = await retryQuery(async () =>
      prisma.interviewRequest.update({
        where: { id: request.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: request.acceptedAt || new Date(),
          interviewerFeedback: feedback,
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

module.exports = {
  submitInterviewerApplication,
  getMyInterviewerApplication,
  reviewInterviewerApplication,
  getInterviewerQueue,
  respondToInterviewRequest,
  scheduleInterviewRequest,
};
