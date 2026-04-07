const resumeService = require('../services/resume.service');
const { sendSuccess, sendError, sendNotFound } = require('../lms.response.helper');

async function getResume(req, res) {
  try {
    const draft = await resumeService.fetchDraft(req.user.id);
    return sendSuccess(res, draft);
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveResume(req, res) {
  try {
    const saved = await resumeService.upsertDraft(req.user.id, req.body);
    return sendSuccess(res, saved, 'Resume saved');
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncCareerPath(req, res) {
  try {
    const result = await resumeService.syncToCareerPath(req.user.id);
    return sendSuccess(res, result, 'Synced successfully');
  } catch (error) {
    return sendError(res, error);
  }
}

async function improveSection(req, res) {
  try {
    const { section, content, targetRole } = req.body;
    const improved = await resumeService.improveAi(section, content, targetRole);
    return sendSuccess(res, { improvedContent: improved });
  } catch (error) {
    return sendError(res, error);
  }
}

async function checkAts(req, res) {
  try {
    const response = await resumeService.checkAtsMatch(req.user.id, req.body.jobDescription);
    return sendSuccess(res, response);
  } catch (error) {
    return sendError(res, error);
  }
}

async function generateSummary(req, res) {
  try {
    const { headline } = req.body;
    const summary = await resumeService.generateSummary(req.user.id, headline);
    return sendSuccess(res, { summary });
  } catch (error) {
    return sendError(res, error);
  }
}

async function analyzeResume(req, res) {
  try {
    const analysis = await resumeService.analyzeDraft(req.user.id);
    return sendSuccess(res, analysis);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getResume, saveResume, syncCareerPath, improveSection, checkAts, generateSummary, analyzeResume
};
