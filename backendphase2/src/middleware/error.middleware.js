import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const errorMiddleware = (err, req, res, next) => {
  logger.error('Error:', err);

  if (err.name === 'ValidationError') {
    return sendError(res, 400, 'Validation error', err);
  }

  if (err.name === 'UnauthorizedError') {
    return sendError(res, 401, 'Unauthorized', err);
  }

  if (err.code === 'P2002') {
    return sendError(res, 409, 'Duplicate entry', err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  sendError(res, statusCode, message, process.env.NODE_ENV === 'development' ? err : null);
};
