import { sendError } from '../utils/response.js';

export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, 'Insufficient permissions');
    }

    next();
  };
};
