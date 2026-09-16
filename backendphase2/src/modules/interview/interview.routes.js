import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { interviewController } from '../../controllers/interview.controller.js';
import { interviewFeedbackController } from '../../controllers/interviewFeedback.controller.js';
import { interviewPanelController } from '../../controllers/interviewPanel.controller.js';
import { interviewNotesController } from '../../controllers/interviewNotes.controller.js';
import {
  addPanelSchema,
  aiSummarySchema,
  calendarQuerySchema,
  cancelInterviewSchema,
  createInterviewSchema,
  feedbackSchema,
  idParamSchema,
  listInterviewsQuerySchema,
  noShowSchema,
  noteSchema,
  noteParamSchema,
  panelParamSchema,
  regenerateMeetingLinkSchema,
  reviewTokenParamSchema,
  reviewFileParamSchema,
  rescheduleInterviewSchema,
  acceptCandidateProposalSchema,
  rejectCandidateProposalSchema,
  submitToClientSchema,
  updateInterviewSchema,
  publicClientTagSchema,
} from '../../validators/interview.validator.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientReviewUploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'interview-client-review');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(clientReviewUploadsDir);

const clientReviewUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureDir(clientReviewUploadsDir);
      cb(null, clientReviewUploadsDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 12);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.get(
  '/public/review/:token',
  validateRequest({ params: reviewTokenParamSchema }),
  interviewController.getPublicClientReview
);
router.get(
  '/public/review/:token/resume',
  validateRequest({ params: reviewTokenParamSchema }),
  interviewController.streamPublicClientReviewResume
);
router.get(
  '/public/review/:token/files/:fileId',
  validateRequest({ params: reviewFileParamSchema }),
  interviewController.streamPublicClientReviewFile
);
router.post(
  '/public/review/:token/tag',
  clientReviewUpload.single('offerLetter'),
  validateRequest({ params: reviewTokenParamSchema, body: publicClientTagSchema }),
  interviewController.submitPublicClientTag
);

router.get(
  '/public/rsvp/:token',
  validateRequest({ params: reviewTokenParamSchema }),
  interviewController.getPublicInterviewRsvp
);
router.post(
  '/public/rsvp/:token/accept',
  validateRequest({ params: reviewTokenParamSchema }),
  interviewController.acceptPublicInterviewRsvp
);
router.post(
  '/public/rsvp/:token/reject',
  validateRequest({ params: reviewTokenParamSchema }),
  interviewController.rejectPublicInterviewRsvp
);
router.post(
  '/public/rsvp/:token/reschedule',
  validateRequest({ params: reviewTokenParamSchema }),
  interviewController.reschedulePublicInterviewRsvp
);

router.use(authMiddleware);

router.get('/kpis', requireAnyPermission(['interviews_read']), interviewController.getKpis);
router.get('/calendar', requireAnyPermission(['interviews_read']), validateRequest({ query: calendarQuerySchema }), interviewController.getCalendar);
router.get('/', requireAnyPermission(['interviews_read']), validateRequest({ query: listInterviewsQuerySchema }), interviewController.list);
router.post('/', requireAnyPermission(['interviews_create']), validateRequest({ body: createInterviewSchema }), interviewController.create);

router.get('/:id', requireAnyPermission(['interviews_read']), validateRequest({ params: idParamSchema }), interviewController.getById);
router.patch('/:id', requireAnyPermission(['interviews_update']), validateRequest({ params: idParamSchema, body: updateInterviewSchema }), interviewController.update);
router.delete('/:id', requireAnyPermission(['interviews_delete']), validateRequest({ params: idParamSchema }), interviewController.remove);

router.post(
  '/:id/reschedule',
  requireAnyPermission(['interviews_update']),
  validateRequest({ params: idParamSchema, body: rescheduleInterviewSchema }),
  interviewController.reschedule
);
router.post(
  '/:id/proposal/accept',
  requireAnyPermission(['interviews_update']),
  validateRequest({ params: idParamSchema, body: acceptCandidateProposalSchema }),
  interviewController.acceptCandidateProposal
);
router.post(
  '/:id/proposal/reject',
  requireAnyPermission(['interviews_update']),
  validateRequest({ params: idParamSchema, body: rejectCandidateProposalSchema }),
  interviewController.rejectCandidateProposal
);
router.post(
  '/:id/cancel',
  requireAnyPermission(['interviews_update']),
  validateRequest({ params: idParamSchema, body: cancelInterviewSchema }),
  interviewController.cancel
);
router.post(
  '/:id/no-show',
  requireAnyPermission(['interviews_update']),
  validateRequest({ params: idParamSchema, body: noShowSchema }),
  interviewController.noShow
);
router.post(
  '/:id/regenerate-meeting-link',
  requireAnyPermission(['interviews_update']),
  validateRequest({ params: idParamSchema, body: regenerateMeetingLinkSchema }),
  interviewController.regenerateMeetingLink
);
router.post(
  '/:id/submit-client',
  requireAnyPermission(['interviews_update']),
  validateRequest({ params: idParamSchema, body: submitToClientSchema }),
  interviewController.submitToClient
);
router.get(
  '/:id/client-review',
  requireAnyPermission(['interviews_read']),
  validateRequest({ params: idParamSchema }),
  interviewController.getInterviewClientReviewContext
);
router.get('/:id/feedback', requireAnyPermission(['interviews_read']), validateRequest({ params: idParamSchema }), interviewFeedbackController.list);
router.post(
  '/:id/feedback',
  requireAnyPermission(['interviews_feedback', 'interviews_update']),
  validateRequest({ params: idParamSchema, body: feedbackSchema }),
  interviewFeedbackController.create
);
router.post(
  '/:id/feedback/ai-summary',
  requireAnyPermission(['interviews_feedback', 'interviews_update']),
  validateRequest({ params: idParamSchema, body: aiSummarySchema }),
  interviewFeedbackController.generateAiSummary
);
router.post('/:id/panel', requireAnyPermission(['interviews_update']), validateRequest({ params: idParamSchema, body: addPanelSchema }), interviewPanelController.add);
router.delete('/:id/panel/:panelId', requireAnyPermission(['interviews_update']), validateRequest({ params: panelParamSchema }), interviewPanelController.remove);
router.get('/:id/notes', requireAnyPermission(['interviews_read']), validateRequest({ params: idParamSchema }), interviewNotesController.list);
router.post('/:id/notes', requireAnyPermission(['interviews_update']), validateRequest({ params: idParamSchema, body: noteSchema }), interviewNotesController.create);
router.delete('/:id/notes/:noteId', requireAnyPermission(['interviews_update']), validateRequest({ params: noteParamSchema }), interviewNotesController.remove);

export default router;
