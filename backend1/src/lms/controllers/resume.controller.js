const resumeService = require('../services/resume.service');
const { sendSuccess, sendError, sendNotFound } = require('../lms.response.helper');

async function getResume(req, res) {
  try {
    const userId = req.user.id;
    const startedAt = Date.now();
    console.log(`📥 LMS resume draft fetch | userId=${userId}`);
    const draft = await resumeService.fetchDraft(userId);
    const headline = draft?.basics?.headline || 'n/a';
    const skillCount = Array.isArray(draft?.skills) ? draft.skills.length : 0;
    const expCount = Array.isArray(draft?.experience) ? draft.experience.length : 0;
    console.log(
      `📦 LMS resume draft fetched | userId=${userId} | headline=${headline} | skills=${skillCount} | experience=${expCount} | elapsedMs=${Date.now() - startedAt}`,
    );
    return sendSuccess(res, draft);
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveResume(req, res) {
  try {
    const userId = req.user.id;
    const jobTailorJobId = req.body?.jobTailorJobId || 'none';
    const startedAt = Date.now();
    console.log(`📥 LMS resume draft save | userId=${userId} | jobTailorJobId=${jobTailorJobId}`);
    const saved = await resumeService.upsertDraft(userId, req.body);
    const headline = saved?.basics?.headline || 'n/a';
    const skillCount = Array.isArray(saved?.skills) ? saved.skills.length : 0;
    const expCount = Array.isArray(saved?.experience) ? saved.experience.length : 0;
    console.log(
      `📦 LMS resume draft saved | userId=${userId} | headline=${headline} | skills=${skillCount} | experience=${expCount} | strength=${saved?.strengthScore ?? 'n/a'} | elapsedMs=${Date.now() - startedAt}`,
    );
    return sendSuccess(res, saved, 'Resume saved');
  } catch (error) {
    console.error(`❌ LMS resume draft save failed | userId=${req.user?.id || 'unknown'}`, error?.message || error);
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

async function tailorSummary(req, res) {
  try {
    const summary = await resumeService.tailorSummaryForJob(req.user.id, req.body || {});
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

async function getResumeVersions(req, res) {
  try {
    const userId = req.user.id;
    const versions = await resumeService.listRoleVersions(userId);
    return sendSuccess(res, versions);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getResumeVersion(req, res) {
  try {
    const userId = req.user.id;
    const version = await resumeService.getRoleVersionById(userId, req.params.versionId);
    return sendSuccess(res, version);
  } catch (error) {
    const message = String(error?.message || 'Failed to load CV version');
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message });
  }
}

async function deleteResumeVersion(req, res) {
  try {
    const userId = req.user.id;
    const result = await resumeService.deleteRoleVersion(userId, req.params.versionId);
    return sendSuccess(res, result);
  } catch (error) {
    const message = String(error?.message || 'Failed to delete CV version');
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message });
  }
}

module.exports = {
  getResume,
  saveResume,
  syncCareerPath,
  improveSection,
  checkAts,
  generateSummary,
  tailorSummary,
  analyzeResume,
  getResumeVersions,
  getResumeVersion,
  deleteResumeVersion,
};
