const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  createInterviewRequest,
  getMyInterviewRequests,
  getMyInterviewRequestSummary,
  rematchInterviewRequest,
  candidateScheduleDecision,
  getInterviewRequestChat,
  postInterviewRequestChat,
} = require('../controllers/interview-request.controller');

const router = Router();

router.use(protect);

router.post('/', createInterviewRequest);
router.get('/my', getMyInterviewRequests);
router.get('/my/summary', getMyInterviewRequestSummary);
router.post('/:requestId/rematch', rematchInterviewRequest);
router.post('/:requestId/schedule-decision', candidateScheduleDecision);
router.get('/:requestId/chat', getInterviewRequestChat);
router.post('/:requestId/chat', postInterviewRequestChat);

module.exports = router;
