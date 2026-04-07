const { z } = require('zod');
const { sendValidationError } = require('../lms.response.helper');

const draftSchema = z.object({
  basics: z.record(z.any()),
  skills: z.array(z.string()),
  experience: z.array(z.any()),
  education: z.array(z.any()),
  certifications: z.array(z.any()),
  layoutMatrix: z.string(),
  templateId: z.string()
});

const aiImproveSchema = z.object({
  section: z.enum(['summary', 'experience', 'skills']),
  content: z.string().min(1),
  targetRole: z.string().min(1)
});

const atsCheckSchema = z.object({
  jobDescription: z.string().min(1)
});

function validateDraft(req, res, next) {
  const result = draftSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateAiImprove(req, res, next) {
  const result = aiImproveSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateAtsCheck(req, res, next) {
  const result = atsCheckSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

module.exports = { validateDraft, validateAiImprove, validateAtsCheck };
