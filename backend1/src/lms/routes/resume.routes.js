const { Router } = require('express');
const { getResume, saveResume, syncCareerPath, improveSection, checkAts, generateSummary, tailorSummary, analyzeResume, getResumeVersions, getResumeVersion, deleteResumeVersion } = require('../controllers/resume.controller');
const { validateDraft, validateAiImprove, validateAtsCheck } = require('../validators/resume.validator');

const router = Router();

router.get('/', getResume);
router.get('/draft', getResume);
router.get('/versions', getResumeVersions);
router.get('/versions/:versionId', getResumeVersion);
router.delete('/versions/:versionId', deleteResumeVersion);
router.post('/', validateDraft, saveResume);
router.post('/draft', validateDraft, saveResume);
router.post('/sync-career-path', syncCareerPath);
router.post('/ai-improve', validateAiImprove, improveSection);
router.post('/ats-check', validateAtsCheck, checkAts);
router.post('/generate-summary', generateSummary);
router.post('/tailor-summary', tailorSummary);
router.post('/analyze', analyzeResume);

module.exports = router;
