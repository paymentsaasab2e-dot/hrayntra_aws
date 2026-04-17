const { z } = require('zod');
const { sendValidationError } = require('../lms.response.helper');

const enrollSchema = z.object({
  courseId: z.string().min(1)
});

const saveSchema = z.object({
  courseId: z.string().min(1),
  saved: z.boolean()
});

function validateEnroll(req, res, next) {
  const result = enrollSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(res, result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
  }
  next();
}

function validateSave(req, res, next) {
  const result = saveSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(res, result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
  }
  next();
}

module.exports = { validateEnroll, validateSave };
