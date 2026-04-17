import { sendError } from '../utils/response.js';

const formatZodErrors = (issues) =>
  issues.map((issue) => ({
    path: issue.path.join('.') || 'root',
    message: issue.message,
  }));

export const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    if (schema?.safeParse) {
      const result = schema.safeParse(req[target]);
      if (!result.success) {
        return sendError(res, 400, 'Validation failed', {
          errors: formatZodErrors(result.error.issues),
        });
      }

      req[target] = result.data;
      return next();
    }

    const { error, value } = schema.validate(req[target], { abortEarly: false, stripUnknown: true });
    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendError(res, 400, 'Validation failed', { errors });
    }

    req[target] = value;
    return next();
  };
};

export const validateRequest = ({ body, params, query }) => (req, res, next) => {
  if (body) {
    const result = body.safeParse(req.body);
    if (!result.success) {
      return sendError(res, 400, 'Validation failed', {
        errors: formatZodErrors(result.error.issues),
      });
    }
    req.body = result.data;
  }

  if (params) {
    const result = params.safeParse(req.params);
    if (!result.success) {
      return sendError(res, 400, 'Validation failed', {
        errors: formatZodErrors(result.error.issues),
      });
    }
    req.params = result.data;
  }

  if (query) {
    const result = query.safeParse(req.query);
    if (!result.success) {
      return sendError(res, 400, 'Validation failed', {
        errors: formatZodErrors(result.error.issues),
      });
    }
    req.query = result.data;
  }

  return next();
};
