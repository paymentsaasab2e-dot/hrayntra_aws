import express from 'express';
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
  rescheduleInterviewSchema,
  updateInterviewSchema,
} from '../../validators/interview.validator.js';

const router = express.Router();

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
