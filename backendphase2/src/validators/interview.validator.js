import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid object id');
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime()).or(z.string().min(1));

export const interviewStatusEnum = z.enum([
  'SCHEDULED',
  'RESCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'FEEDBACK_PENDING',
  'FEEDBACK_SUBMITTED',
  'CONFIRMED',
]);

export const panelRoleEnum = z.enum(['HR', 'TECHNICAL', 'CLIENT', 'HIRING_MANAGER']);
export const meetingPlatformEnum = z.enum(['ZOOM', 'GOOGLE_MEET', 'MS_TEAMS']);
export const interviewModeEnum = z.enum(['ONLINE', 'OFFLINE']);
export const interviewTypeEnum = z.enum([
  'VIDEO',
  'PHONE',
  'IN_PERSON',
  'TECHNICAL_TEST',
  'ASSESSMENT',
  'GROUP_DISCUSSION',
  'ONSITE',
  'TECHNICAL',
  'FINAL',
]);
export const feedbackRecommendationEnum = z.enum(['PASS', 'REJECT', 'HOLD', 'NEXT_ROUND']);

export const idParamSchema = z.object({
  id: objectId,
});

export const interviewIdParamSchema = z.object({
  id: objectId,
  panelId: objectId.optional(),
  noteId: objectId.optional(),
});

export const panelParamSchema = z.object({
  id: objectId,
  panelId: objectId,
});

export const noteParamSchema = z.object({
  id: objectId,
  noteId: objectId,
});

export const createInterviewSchema = z
  .object({
    candidateId: objectId,
    jobId: objectId,
    companyId: objectId.optional(),
    clientId: objectId.optional(),
    round: z.string().min(1),
    type: interviewTypeEnum,
    mode: interviewModeEnum,
    date: isoDate,
    duration: z.number().int().min(15).max(480),
    timezone: z.string().min(1),
    meetingPlatform: meetingPlatformEnum.optional().nullable(),
    location: z.string().optional().nullable(),
    panelUserIds: z.array(objectId).min(1),
    panelRoles: z.record(objectId, panelRoleEnum).optional(),
    notes: z.string().optional().nullable(),
    sendCalendarInvite: z.boolean().default(false),
    sendEmailNotification: z.boolean().default(true),
    sendWhatsappReminder: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.companyId && !data.clientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companyId'],
        message: 'companyId or clientId is required',
      });
    }

    if (data.mode === 'ONLINE' && !data.meetingPlatform) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['meetingPlatform'],
        message: 'meetingPlatform is required when mode is ONLINE',
      });
    }

    if (data.mode === 'OFFLINE' && !data.location) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['location'],
        message: 'location is required when mode is OFFLINE',
      });
    }
  });

export const listInterviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: interviewStatusEnum.optional(),
  round: z.string().optional(),
  mode: interviewModeEnum.optional(),
  interviewerId: objectId.optional(),
  candidateId: objectId.optional(),
  jobId: objectId.optional(),
  companyId: objectId.optional(),
  clientId: objectId.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export const updateInterviewSchema = z
  .object({
    round: z.string().min(1).optional(),
    type: interviewTypeEnum.optional(),
    mode: interviewModeEnum.optional(),
    date: isoDate.optional(),
    duration: z.number().int().min(15).max(480).optional(),
    timezone: z.string().min(1).optional(),
    meetingPlatform: meetingPlatformEnum.optional().nullable(),
    location: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    status: interviewStatusEnum.optional(),
    panelUserIds: z.array(objectId).min(1).optional(),
    panelRoles: z.record(objectId, panelRoleEnum).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const rescheduleInterviewSchema = z.object({
  newDate: isoDate,
  newTime: z.string().min(1),
  reason: z.string().min(1),
  notifyCandidate: z.boolean().default(true),
  notifyInterviewer: z.boolean().default(true),
});

export const cancelInterviewSchema = z.object({
  reason: z.string().min(1),
  notes: z.string().optional().default(''),
  notifyCandidate: z.boolean().default(true),
});

export const noShowSchema = z.object({
  reason: z.string().min(1),
  notes: z.string().optional().default(''),
});

export const feedbackSchema = z.object({
  technicalScore: z.number().min(1).max(5),
  communicationScore: z.number().min(1).max(5),
  problemSolvingScore: z.number().min(1).max(5),
  cultureFitScore: z.number().min(1).max(5),
  experienceMatchScore: z.number().min(1).max(5),
  overallScore: z.number().min(1).max(5).optional(),
  strengths: z.string().optional(),
  weakness: z.string().optional(),
  comments: z.string().optional(),
  recommendation: feedbackRecommendationEnum,
  salaryFit: z.boolean(),
  availableToJoin: z.string().min(1),
});

export const aiSummarySchema = z.object({
  feedbackId: objectId,
});

export const addPanelSchema = z.object({
  userId: objectId,
  role: panelRoleEnum,
});

export const noteSchema = z.object({
  note: z.string().min(1),
});

export const regenerateMeetingLinkSchema = z.object({
  platform: meetingPlatformEnum,
});

export const calendarQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});
