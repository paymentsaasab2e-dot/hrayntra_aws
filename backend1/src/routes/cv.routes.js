const { Router } = require('express');
const multer = require('multer');
const { uploadCV, getCVStatus, getCandidateProfile, updateCandidateProfile, getCandidateDashboard, getAllProfileData } = require('../controllers/cv.controller');

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, DOC, DOCX, JPG, PNG
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

router.post('/upload', upload.single('cv'), uploadCV);
router.get('/status/:candidateId', getCVStatus);
router.get('/profile/:candidateId', getCandidateProfile);
router.put('/profile/:candidateId', updateCandidateProfile);
router.get('/dashboard/:candidateId', getCandidateDashboard);
router.get('/profile-all/:candidateId', getAllProfileData);

module.exports = router;
