const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');

/**
 * Middleware to protect routes and verify session exists in database
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided',
      });
    }

    try {
      // 1. Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'saasa_jwt_secret_key_2024');

      // 2. Check if session exists in database (Logout All check)
      const session = await prisma.session.findUnique({
        where: { token: token },
      });

      if (!session) {
        console.warn(`Auth Middleware: Session for ${decoded.candidateId} not found in DB (Logged out)`);
        return res.status(401).json({
          success: false,
          message: 'Session has been invalidated. Please log in again.',
          code: 'SESSION_INVALID'
        });
      }

      // 3. Check if session is expired
      if (new Date() > new Date(session.expiresAt)) {
        await prisma.session.delete({ where: { id: session.id } });
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.',
          code: 'SESSION_EXPIRED'
        });
      }

      // 4. Update last used time (throttle to once every 5 mins to save DB calls)
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (new Date(session.lastUsedAt) < fiveMinsAgo) {
        prisma.session.update({
          where: { id: session.id },
          data: { lastUsedAt: new Date() }
        }).catch(err => console.error('Failed to update lastUsedAt:', err));
      }

      // Add user info to request
      req.user = decoded;
      req.sessionId = session.id;
      
      next();
    } catch (error) {
      console.error('JWT verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed',
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
    });
  }
};

module.exports = { protect };
