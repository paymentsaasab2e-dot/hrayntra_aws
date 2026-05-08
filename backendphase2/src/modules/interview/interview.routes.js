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
  rescheduleInterviewSchema,
  submitToClientSchema,
  updateInterviewSchema,
  publicClientTagSchema,
} from '../../validators/interview.validator.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files arrive on the public review endpoint (no auth) — keep this storage
// isolated so we can wipe / quota it without touching authenticated uploads.
const clientReviewUploadsDir = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'uploads',
  'interview-client-review'
);
if (!fs.existsSync(clientReviewUploadsDir)) {
  fs.mkdirSync(clientReviewUploadsDir, { recursive: true });
}

const clientReviewStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, clientReviewUploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = String(file.originalname || 'offer.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${sanitized}`);
  },
});

const clientReviewUpload = multer({
  storage: clientReviewStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Tightening to PDF here matches the placement flow and stops accidental
    // images / executables from a public upload surface.
    if (!/^application\/pdf$/i.test(file.mimetype || '')) {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

router.get(
  '/public/review/:token',
  validateRequest({ params: reviewTokenParamSchema }),
  interviewController.getPublicClientReview
);
router.post(
  '/public/review/:token/tag',
  // Multer parses multipart first so `req.body` has plain text fields by the
  // time validateRequest runs. The `offerLetter` field is optional; the body
  // schema still requires `tag` (controller relaxes this when a file is
  // present + submissionType is OFFER_CONFIRMATION).
  clientReviewUpload.single('offerLetter'),
  validateRequest({ params: reviewTokenParamSchema, body: publicClientTagSchema }),
  interviewController.submitPublicClientTag
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

router.get('/:id/feedback', requireAnyPermission(['interviews_read']), validateRequest({ params: idParamSchema }), interviewFeedbackController.list);
router.post(
  '/:id/feedback',
  requireAnyPermission(['interviews_update']),
  validateRequest({ params: idParamSchema, body: feedbackSchema }),
  interviewFeedbackController.create
);
router.post(
  '/:id/feedback/ai-summary',
  requireAnyPermission(['interviews_update']),
  validateRequest({ params: idParamSchema, body: aiSummarySchema }),
  interviewFeedbackController.generateAiSummary
);

router.post('/:id/panel', requireAnyPermission(['interviews_update']), validateRequest({ params: idParamSchema, body: addPanelSchema }), interviewPanelController.add);
router.delete('/:id/panel/:panelId', requireAnyPermission(['interviews_update']), validateRequest({ params: panelParamSchema }), interviewPanelController.remove);

router.get('/:id/notes', requireAnyPermission(['interviews_read']), validateRequest({ params: idParamSchema }), interviewNotesController.list);
router.post('/:id/notes', requireAnyPermission(['interviews_update']), validateRequest({ params: idParamSchema, body: noteSchema }), interviewNotesController.create);
router.delete('/:id/notes/:noteId', requireAnyPermission(['interviews_update']), validateRequest({ params: noteParamSchema }), interviewNotesController.remove);

export default router;
