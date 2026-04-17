const { z } = require('zod');
const { sendValidationError } = require('../lms.response.helper');

const createNoteSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  type: z.string().min(1),
  tags: z.array(z.string()).optional(),
  sourceType: z.string().nullable().optional(),
  sourceId: z.string().nullable().optional()
});

const updateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional()
});

const aiActionSchema = z.object({
  action: z.enum([
    'extract-concepts',
    'convert-to-interview-answers',
    'generate-mock-questions',
    'summarize',
    'convert-to-resume-bullets'
  ])
});

function validateCreateNote(req, res, next) {
  const result = createNoteSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateUpdateNote(req, res, next) {
  const result = updateNoteSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateAiAction(req, res, next) {
  const result = aiActionSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

module.exports = { validateCreateNote, validateUpdateNote, validateAiAction };
