const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const {  getSettings,
  updateAccountSettings,
  updateNotificationSettings,
  updatePrivacySettings,
  updatePreferences,
  updateApplicationSettings,
  logoutAllSessions,
  deleteAccount,
} = require('../controllers/settings.controller');

const router = Router();

// Get all settings
router.get('/:candidateId', protect, getSettings);

// Update specific settings sections
router.put('/account/:candidateId', updateAccountSettings);
router.put('/notifications/:candidateId', updateNotificationSettings);
router.put('/privacy/:candidateId', updatePrivacySettings);
router.put('/preferences/:candidateId', updatePreferences);
router.put('/application/:candidateId', updateApplicationSettings);

// Danger zone actions
router.post('/logout-all/:candidateId', protect, logoutAllSessions);
router.delete('/account/:candidateId', protect, deleteAccount);

module.exports = router;
