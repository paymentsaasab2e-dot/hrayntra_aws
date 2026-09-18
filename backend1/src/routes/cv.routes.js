const { Router } = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const {
  uploadCV,
  getCVStatus,
  getCandidateProfile,
  updateCandidateProfile,
  getCandidateDashboard,
  getAllProfileData,
} = require('../controllers/cv.controller');

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.'), false);
    }
  },
});

/** Ensure JWT candidate owns the :candidateId param (or body candidateId). */
function requireOwnCandidate(req, res, next) {
  const sessionId = String(req.user?.candidateId || req.user?.id || '').trim();
  const target = String(req.params?.candidateId || req.body?.candidateId || '').trim();
  if (!sessionId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (target && target !== sessionId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: candidate mismatch',
    });
  }
  if (!req.body) req.body = {};
  if (!req.body.candidateId) req.body.candidateId = sessionId;
  if (req.params && !req.params.candidateId) {
    req.params.candidateId = sessionId;
  }
  return next();
}

router.post('/upload', protect, upload.single('cv'), requireOwnCandidate, uploadCV);
router.get('/status/:candidateId', protect, requireOwnCandidate, getCVStatus);
router.get('/profile/:candidateId', protect, requireOwnCandidate, getCandidateProfile);
router.put('/profile/:candidateId', protect, requireOwnCandidate, updateCandidateProfile);
router.get('/dashboard/:candidateId', protect, requireOwnCandidate, getCandidateDashboard);
router.get('/profile-all/:candidateId', protect, requireOwnCandidate, getAllProfileData);

module.exports = router;
