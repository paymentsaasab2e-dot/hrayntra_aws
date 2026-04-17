const { z } = require('zod');
const { sendValidationError } = require('../lms.response.helper');

const addRoadmapSchema = z.object({
  title: z.string().min(1),
  phase: z.string().min(1),
  targetType: z.enum(['course', 'quiz', 'event', 'interview', 'resume', 'note']),
  targetId: z.string().nullable().optional(),
  targetRoute: z.string().nullable().optional(),
  reason: z.string()
});

const updateRoadmapSchema = z.object({
  status: z.enum(['planned', 'in-progress', 'completed', 'recommended']),
  completedAt: z.string().nullable().optional() // ISO string
});

function validateAddRoadmap(req, res, next) {
  const result = addRoadmapSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateUpdateRoadmap(req, res, next) {
  const result = updateRoadmapSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

module.exports = { validateAddRoadmap, validateUpdateRoadmap };
