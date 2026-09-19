const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const { requireOwnCandidate } = require('../middleware/requireOwnCandidate.middleware');
const {
  getSettings,
  updateAccountSettings,
  updateNotificationSettings,
  updatePrivacySettings,
  updatePreferences,
  updateApplicationSettings,
  logoutAllSessions,
  deleteAccount,
} = require('../controllers/settings.controller');

const router = Router();

router.get('/:candidateId', protect, requireOwnCandidate, getSettings);
router.put('/account/:candidateId', protect, requireOwnCandidate, updateAccountSettings);
router.put('/notifications/:candidateId', protect, requireOwnCandidate, updateNotificationSettings);
router.put('/privacy/:candidateId', protect, requireOwnCandidate, updatePrivacySettings);
router.put('/preferences/:candidateId', protect, requireOwnCandidate, updatePreferences);
router.put('/application/:candidateId', protect, requireOwnCandidate, updateApplicationSettings);
router.post('/logout-all/:candidateId', protect, requireOwnCandidate, logoutAllSessions);
router.delete('/account/:candidateId', protect, requireOwnCandidate, deleteAccount);

module.exports = router;

