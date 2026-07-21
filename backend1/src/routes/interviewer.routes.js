const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  submitInterviewerApplication,
  getMyInterviewerApplication,
  reviewInterviewerApplication,
  getInterviewerQueue,
  respondToInterviewRequest,
  scheduleInterviewRequest,
} = require('../controllers/interviewer.controller');

const router = Router();

router.use(protect);

router.post('/applications', submitInterviewerApplication);
router.get('/applications/me', getMyInterviewerApplication);
router.post('/applications/:applicationId/review', reviewInterviewerApplication);
router.get('/requests/queue', getInterviewerQueue);
router.post('/requests/:requestId/decision', respondToInterviewRequest);
router.post('/requests/:requestId/schedule', scheduleInterviewRequest);

module.exports = router;
