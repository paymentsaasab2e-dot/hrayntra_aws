import { verifyToken } from '../utils/jwt.js';
import { sendError } from '../utils/response.js';
import { prisma } from '../config/prisma.js';
import jwt from 'jsonwebtoken';

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'No token provided');
    }

    const token = authHeader.substring(7);
    let decoded = verifyToken(token);
    let userId = null;

    // If token is valid, use it
    if (decoded && decoded.userId) {
      userId = decoded.userId;
    } else {
      // If token is expired or invalid, try to decode without verification to extract userId
      // This allows us to validate against database even if token expired
      try {
        const unverified = jwt.decode(token);
        if (unverified && typeof unverified === 'object' && unverified.userId) {
          userId = unverified.userId;
        }
      } catch (e) {
        // Ignore decode errors
      }
    }

    // If we have a userId (from valid or expired token), validate user in database
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });

      // If user exists and is active, allow access
      // Token expiration is now set to 10 years, but even if expired,
      // we validate against database to ensure user still exists and is active
      if (user && user.isActive) {
        req.user = user;
        return next();
      }
    }

    // If no valid user found, reject
    return sendError(res, 401, 'User not found or inactive');
  } catch (error) {
    sendError(res, 401, 'Authentication failed', error);
  }
};
