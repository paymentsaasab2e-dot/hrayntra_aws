const { z } = require('zod');
const { sendValidationError } = require('../lms.response.helper');

const eventIdSchema = z.object({
  eventId: z.string().min(1)
});

function validateEventId(req, res, next) {
  const result = eventIdSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(res, result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
  }
  next();
}

module.exports = { validateEventId };
