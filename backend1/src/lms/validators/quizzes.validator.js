const { z } = require('zod');
const { sendValidationError } = require('../lms.response.helper');

const attemptSchema = z.object({
  answerMap: z.record(z.number()),
  timeTakenSeconds: z.number().nonnegative()
});

function validateAttempt(req, res, next) {
  const result = attemptSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(res, result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
  }
  next();
}

module.exports = { validateAttempt };
