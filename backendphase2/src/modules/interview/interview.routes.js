import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
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
  rescheduleInterviewSchema,
  updateInterviewSchema,
} from '../../validators/interview.validator.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/kpis', interviewController.getKpis);
router.get('/calendar', validateRequest({ query: calendarQuerySchema }), interviewController.getCalendar);
router.get('/', validateRequest({ query: listInterviewsQuerySchema }), interviewController.list);
router.post('/', validateRequest({ body: createInterviewSchema }), interviewController.create);

router.get('/:id', validateRequest({ params: idParamSchema }), interviewController.getById);
router.patch('/:id', validateRequest({ params: idParamSchema, body: updateInterviewSchema }), interviewController.update);
router.delete('/:id', validateRequest({ params: idParamSchema }), interviewController.remove);

router.post(
  '/:id/reschedule',
  validateRequest({ params: idParamSchema, body: rescheduleInterviewSchema }),
  interviewController.reschedule
);
router.post(
  '/:id/cancel',
  validateRequest({ params: idParamSchema, body: cancelInterviewSchema }),
  interviewController.cancel
);
router.post(
  '/:id/no-show',
  validateRequest({ params: idParamSchema, body: noShowSchema }),
  interviewController.noShow
);
router.post(
  '/:id/regenerate-meeting-link',
  validateRequest({ params: idParamSchema, body: regenerateMeetingLinkSchema }),
  interviewController.regenerateMeetingLink
);

router.get('/:id/feedback', validateRequest({ params: idParamSchema }), interviewFeedbackController.list);
router.post(
  '/:id/feedback',
  validateRequest({ params: idParamSchema, body: feedbackSchema }),
  interviewFeedbackController.create
);
router.post(
  '/:id/feedback/ai-summary',
  validateRequest({ params: idParamSchema, body: aiSummarySchema }),
  interviewFeedbackController.generateAiSummary
);

router.post('/:id/panel', validateRequest({ params: idParamSchema, body: addPanelSchema }), interviewPanelController.add);
router.delete('/:id/panel/:panelId', validateRequest({ params: panelParamSchema }), interviewPanelController.remove);

router.get('/:id/notes', validateRequest({ params: idParamSchema }), interviewNotesController.list);
router.post('/:id/notes', validateRequest({ params: idParamSchema, body: noteSchema }), interviewNotesController.create);
router.delete('/:id/notes/:noteId', validateRequest({ params: noteParamSchema }), interviewNotesController.remove);

export default router;
