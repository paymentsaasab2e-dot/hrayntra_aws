import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const errorMiddleware = (err, req, res, next) => {
  logger.error({
    level: 'error',
    message: err?.message || 'Unhandled error',
    route: req.originalUrl || req.url,
    method: req.method,
    status: err?.statusCode || 500,
  });

  if (err.name === 'ValidationError') {
    return sendError(res, 400, 'Validation error', err);
  }

  if (err.name === 'UnauthorizedError') {
    return sendError(res, 401, 'Unauthorized', err);
  }

  if (err.code === 'P2002') {
    return sendError(res, 409, 'Duplicate entry', err);
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 400, 'File is too large. Maximum size is 5MB.', err);
  }

  if (err.name === 'MulterError' || /only pdf|file type/i.test(String(err.message || ''))) {
    return sendError(res, 400, err.message || 'Invalid file upload', err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  sendError(res, statusCode, message, process.env.NODE_ENV === 'development' ? err : null);
};
