const { Router } = require('express');
const multer = require('multer');
const {
  getProfileData,
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
  saveGapExplanation,
  deleteGapExplanation,
  saveInternship,
  deleteInternship,
  savePortfolioLinks,
  saveResume,
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
} = require('../controllers/profile.controller');

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, JPG, PNG
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'), false);
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
router.get('/completeness/:candidateId', getProfileCompleteness);
router.get('/:candidateId', getProfileData);

// Personal Information
router.put('/personal-info/:candidateId', updatePersonalInfo);
router.post('/photo/:candidateId', profilePhotoUpload.single('photo'), uploadProfilePhoto);
router.put('/summary/:candidateId', saveSummary);
router.post('/generate-summary/:candidateId', generateSummaryWithAI);
router.post('/gap-explanation/:candidateId', saveGapExplanation);
router.delete('/gap-explanation/:candidateId', deleteGapExplanation);
router.post('/internship/:candidateId', saveInternship);
router.delete('/internship/:candidateId', deleteInternship);
router.post('/internship/documents/:candidateId', upload.array('documents', 10), uploadInternshipDocuments);
router.post('/portfolio-links/:candidateId', savePortfolioLinks);
router.post('/resume/:candidateId', saveResume);
router.post('/resume/upload/:candidateId', upload.single('resume'), uploadResumeFile);

// Education
router.post('/education/:candidateId', saveEducation);
router.put('/education/:educationId', saveEducation);
router.delete('/education/:educationId', deleteEducation);
router.post('/education/documents/:candidateId', upload.array('documents', 10), uploadEducationDocuments);

// Work Experience
router.post('/work-experience/:candidateId', saveWorkExperience);
router.put('/work-experience/:experienceId', saveWorkExperience);
router.delete('/work-experience/:experienceId', deleteWorkExperience);
router.post('/work-experience/documents/:candidateId', upload.array('documents', 10), uploadWorkExperienceDocuments);

// Skills
router.post('/skills/:candidateId', saveSkills);
router.delete('/skills/:candidateId', deleteSkills);

// Languages
router.post('/languages/:candidateId', saveLanguages);
router.delete('/languages/:candidateId', deleteLanguages);
router.post('/languages/documents/:candidateId', upload.array('documents', 10), uploadLanguageDocuments);

// Career Preferences
router.put('/career-preferences/:candidateId', updateCareerPreferences);

// Project
router.post('/project/:candidateId', saveProject);
router.post('/project/documents/:candidateId', upload.array('documents', 10), uploadProjectDocuments);
router.delete('/project/:candidateId', deleteProject);

// Academic Achievement
router.post('/academic-achievement/:candidateId', saveAcademicAchievement);
router.delete('/academic-achievement/:candidateId', deleteAcademicAchievement);
router.post('/academic-achievement/documents/:candidateId', upload.array('documents', 10), uploadAcademicAchievementDocuments);

// Competitive Exam
router.post('/competitive-exam/:candidateId', saveCompetitiveExam);
router.delete('/competitive-exam/:candidateId', deleteCompetitiveExam);
router.post('/competitive-exam/documents/:candidateId', upload.array('documents', 10), uploadCompetitiveExamDocuments);

// Certifications
router.post('/certifications/:candidateId', saveCertifications);
router.delete('/certifications/:certificationId', deleteCertification);
router.post('/certification/documents/:candidateId', upload.array('documents', 10), uploadCertificationDocuments);

// Accomplishments
router.post('/accomplishments/:candidateId', saveAccomplishments);
router.delete('/accomplishments/:accomplishmentId', deleteAccomplishment);
router.post('/accomplishment/documents/:candidateId', upload.array('documents', 10), uploadAccomplishmentDocuments);

// Visa Work Authorization
router.post('/visa-work-authorization/:candidateId', saveVisaWorkAuthorization);
router.delete('/visa-work-authorization/:candidateId', deleteVisaWorkAuthorization);
router.post('/visa-work-authorization/documents/:candidateId', upload.array('documents', 10), uploadVisaDocuments);

// Vaccination
router.post('/vaccination/:candidateId', saveVaccination);
router.delete('/vaccination/:candidateId', deleteVaccination);
router.post('/vaccination/documents/:candidateId', upload.array('documents', 1), uploadVaccinationDocuments);

// Resume
router.delete('/resume/:candidateId', deleteResume);

// Portfolio Links
router.delete('/portfolio-links/:candidateId', deletePortfolioLinks);

// Career Preferences
router.delete('/career-preferences/:candidateId', deleteCareerPreferences);

module.exports = router;
