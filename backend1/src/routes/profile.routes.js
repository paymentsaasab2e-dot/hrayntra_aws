const { Router } = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const { requireOwnCandidate } = require('../middleware/requireOwnCandidate.middleware');
const {
  getProfileData,
  syncCommonDashboard,
  getProfileCompleteness,
  updatePersonalInfo,
  saveEducation,
  deleteEducation,
  saveWorkExperience,
  deleteWorkExperience,
  uploadWorkExperienceDocuments,
  uploadEducationDocuments,
  uploadAcademicAchievementDocuments,
  uploadCompetitiveExamDocuments,
  uploadCertificationDocuments,
  uploadAccomplishmentDocuments,
  uploadInternshipDocuments,
  uploadLanguageDocuments,
  uploadProjectDocuments,
  saveSkills,
  deleteSkills,
  saveLanguages,
  deleteLanguages,
  updateCareerPreferences,
  saveSummary,
  generateSummaryWithAI,
  generateCompanyProfileWithAI,
  generateWorkExperienceAiAutofill,
  saveGapExplanation,
  deleteGapExplanation,
  saveInternship,
  deleteInternship,
  savePortfolioLinks,
  saveResume,
  inspectResumeFile,
  uploadResumeFile,
  saveProject,
  saveAcademicAchievement,
  saveCompetitiveExam,
  saveCertifications,
  saveAccomplishments,
  saveVisaWorkAuthorization,
  uploadVisaDocuments,
  saveVaccination,
  uploadVaccinationDocuments,
  deleteProject,
  deleteAcademicAchievement,
  deleteCompetitiveExam,
  deleteCertification,
  deleteAccomplishment,
  deleteVisaWorkAuthorization,
  deleteVaccination,
  deleteResume,
  deletePortfolioLinks,
  deleteCareerPreferences,
  uploadProfilePhoto,
  deleteProfilePhoto,
} = require('../controllers/profile.controller');

const router = Router();
router.use(protect);

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

// Configure multer for profile photo uploads (images only, 2MB max)
const profilePhotoUpload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req, file, cb) => {
    // Allow only images
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WEBP images are allowed.'), false);
    }
  },
});

// Get all profile data
router.get('/completeness/:candidateId', requireOwnCandidate, getProfileCompleteness);
router.post('/sync-common-dashboard/:candidateId', requireOwnCandidate, syncCommonDashboard);
router.get('/:candidateId', requireOwnCandidate, getProfileData);

// Personal Information
router.put('/personal-info/:candidateId', requireOwnCandidate, updatePersonalInfo);
router.post('/photo/:candidateId', requireOwnCandidate, profilePhotoUpload.single('photo'), uploadProfilePhoto);
router.delete('/photo/:candidateId', requireOwnCandidate, deleteProfilePhoto);
router.put('/summary/:candidateId', requireOwnCandidate, saveSummary);
router.post('/generate-summary/:candidateId', requireOwnCandidate, generateSummaryWithAI);
router.post('/generate-company-profile', protect, generateCompanyProfileWithAI);
router.post('/work-experience-ai-autofill', protect, generateWorkExperienceAiAutofill);
router.post('/gap-explanation/:candidateId', requireOwnCandidate, saveGapExplanation);
router.delete('/gap-explanation/:candidateId', requireOwnCandidate, deleteGapExplanation);
router.post('/internship/:candidateId', requireOwnCandidate, saveInternship);
router.delete('/internship/:candidateId', requireOwnCandidate, deleteInternship);
router.post('/internship/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadInternshipDocuments);
router.post('/portfolio-links/:candidateId', requireOwnCandidate, savePortfolioLinks);
router.post('/resume/:candidateId', requireOwnCandidate, saveResume);
router.post('/resume/inspect/:candidateId', requireOwnCandidate, upload.single('resume'), inspectResumeFile);
router.post('/resume/upload/:candidateId', requireOwnCandidate, upload.single('resume'), uploadResumeFile);

// Education
router.post('/education/:candidateId', requireOwnCandidate, saveEducation);
router.put('/education/:educationId', saveEducation);
router.delete('/education/:educationId', deleteEducation);
router.post('/education/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadEducationDocuments);

// Work Experience
router.post('/work-experience/:candidateId', requireOwnCandidate, saveWorkExperience);
router.put('/work-experience/:experienceId', saveWorkExperience);
router.delete('/work-experience/:experienceId', deleteWorkExperience);
router.post('/work-experience/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadWorkExperienceDocuments);

// Skills
router.post('/skills/:candidateId', requireOwnCandidate, saveSkills);
router.delete('/skills/:candidateId', requireOwnCandidate, deleteSkills);

// Languages
router.post('/languages/:candidateId', requireOwnCandidate, saveLanguages);
router.delete('/languages/:candidateId', requireOwnCandidate, deleteLanguages);
router.post('/languages/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadLanguageDocuments);

// Career Preferences
router.put('/career-preferences/:candidateId', requireOwnCandidate, updateCareerPreferences);

// Project
router.post('/project/:candidateId', requireOwnCandidate, saveProject);
router.post('/project/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadProjectDocuments);
router.delete('/project/:candidateId', requireOwnCandidate, deleteProject);

// Academic Achievement
router.post('/academic-achievement/:candidateId', requireOwnCandidate, saveAcademicAchievement);
router.delete('/academic-achievement/:candidateId', requireOwnCandidate, deleteAcademicAchievement);
router.post('/academic-achievement/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadAcademicAchievementDocuments);

// Competitive Exam
router.post('/competitive-exam/:candidateId', requireOwnCandidate, saveCompetitiveExam);
router.delete('/competitive-exam/:candidateId', requireOwnCandidate, deleteCompetitiveExam);
router.post('/competitive-exam/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadCompetitiveExamDocuments);

// Certifications
router.post('/certifications/:candidateId', requireOwnCandidate, saveCertifications);
router.delete('/certifications/:certificationId', deleteCertification);
router.post('/certification/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadCertificationDocuments);

// Accomplishments
router.post('/accomplishments/:candidateId', requireOwnCandidate, saveAccomplishments);
router.delete('/accomplishments/:accomplishmentId', deleteAccomplishment);
router.post('/accomplishment/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadAccomplishmentDocuments);

// Visa Work Authorization
router.post('/visa-work-authorization/:candidateId', requireOwnCandidate, saveVisaWorkAuthorization);
router.delete('/visa-work-authorization/:candidateId', requireOwnCandidate, deleteVisaWorkAuthorization);
router.post('/visa-work-authorization/documents/:candidateId', requireOwnCandidate, upload.array('documents', 10), uploadVisaDocuments);

// Vaccination
router.post('/vaccination/:candidateId', requireOwnCandidate, saveVaccination);
router.delete('/vaccination/:candidateId', requireOwnCandidate, deleteVaccination);
router.post('/vaccination/documents/:candidateId', requireOwnCandidate, upload.array('documents', 1), uploadVaccinationDocuments);

// Resume
router.delete('/resume/:candidateId', requireOwnCandidate, deleteResume);

// Portfolio Links
router.delete('/portfolio-links/:candidateId', requireOwnCandidate, deletePortfolioLinks);

// Career Preferences
router.delete('/career-preferences/:candidateId', requireOwnCandidate, deleteCareerPreferences);

module.exports = router;
