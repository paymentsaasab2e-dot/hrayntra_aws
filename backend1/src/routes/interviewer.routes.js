const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  submitInterviewerApplication,
  updateMyInterviewerApplication,
  getMyInterviewerApplication,
  reviewInterviewerApplication,
  getInterviewerQueue,
  respondToInterviewRequest,
  scheduleInterviewRequest,
  listMarketplaceInterviewers,
  completeInterviewRequest,
} = require('../controllers/interviewer.controller');

const router = Router();

router.use(protect);

router.post('/applications', submitInterviewerApplication);
router.put('/applications/me', updateMyInterviewerApplication);
router.get('/applications/me', getMyInterviewerApplication);
router.post('/applications/:applicationId/review', reviewInterviewerApplication);
router.get('/marketplace', listMarketplaceInterviewers);
router.get('/requests/queue', getInterviewerQueue);
router.post('/requests/:requestId/decision', respondToInterviewRequest);
router.post('/requests/:requestId/schedule', scheduleInterviewRequest);
router.post('/requests/:requestId/complete', completeInterviewRequest);

module.exports = router;
