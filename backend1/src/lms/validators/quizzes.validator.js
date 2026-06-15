const { z } = require('zod');
const { sendValidationError } = require('../lms.response.helper');

const attemptSchema = z.object({
  answerMap: z.record(z.number()),
  timeTakenSeconds: z.number().nonnegative()
});

const generateSchema = z.object({
  topic: z.string().trim().min(2).max(120),
});

function validateAttempt(req, res, next) {
  const result = attemptSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(res, result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
  }
  next();
}

function validateGenerate(req, res, next) {
  const result = generateSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(res, result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
  }
  req.body = result.data;
  next();
}

module.exports = { validateAttempt, validateGenerate };
