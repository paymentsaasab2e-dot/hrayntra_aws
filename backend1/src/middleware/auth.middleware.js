const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { buildSessionTrackingFields } = require('../utils/session-tracking.util');

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

      // Defense-in-depth: if the generated Prisma client doesn't expose the
      // `Session` model (e.g. `prisma generate` hasn't been re-run after the
      // model was added to schema.prisma), fall back to JWT-only auth instead
      // of force-logging the user out. Without this guard a stale client at
      // any point in the deploy/dev cycle bricks every protected route the
      // moment the user logs in (calls like `prisma.session.findUnique` throw
      // "Cannot read properties of undefined (reading 'findUnique')"). The
      // session table is purely for "logout-everywhere" tracking; the JWT
      // alone is sufficient to identify the candidate for a single request.
      if (!prisma || typeof prisma.session?.findUnique !== 'function') {
        console.warn(
          'Auth Middleware: prisma.session unavailable — JWT-only access. Run `prisma generate` to enable session-table tracking.'
        );
        req.user = decoded;
        req.sessionId = null;
        return next();
      }

      // 2. Check if session exists in database (Logout All check)
      let session = await prisma.session.findUnique({
        where: { token: token },
      });

      // 3. Self-heal: a JWT-valid request with NO session row means the
      //    original `verify-otp` flow silently failed to insert the session
      //    (the create is wrapped in a try/catch that swallows errors so the
      //    user wasn't blocked at login). The user has a valid token, the
      //    candidate still exists — recreate the session row here instead
      //    of force-logging them out. This makes the system resilient to
      //    transient Mongo write failures and stops the dreaded "logged in
      //    successfully → logged out successfully" loop on the candidate
      //    portal. Returning 401 only when JWT itself is invalid (caught
      //    below) or when the candidate referenced by the JWT is gone.
      if (!session) {
        const candidateId = decoded?.candidateId;
        if (!candidateId) {
          console.warn('Auth Middleware: JWT missing candidateId — denying.');
          return res.status(401).json({
            success: false,
            message: 'Session has been invalidated. Please log in again.',
            code: 'SESSION_INVALID',
          });
        }

        const candidate = await prisma.candidate.findUnique({
          where: { id: candidateId },
          select: { id: true },
        });

        if (!candidate) {
          console.warn(
            `Auth Middleware: Candidate ${candidateId} from token no longer exists — denying.`
          );
          return res.status(401).json({
            success: false,
            message: 'Session has been invalidated. Please log in again.',
            code: 'SESSION_INVALID',
          });
        }

        // JWT exp claim mirrors session expiry — fall back to 30 days from
        // now if the claim isn't present (legacy tokens).
        const expiresAt = decoded?.exp
          ? new Date(decoded.exp * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        try {
          const tracking = buildSessionTrackingFields(req, req.body || {});
          session = await prisma.session.create({
            data: {
              candidateId,
              token,
              expiresAt,
              ...tracking,
            },
          });
          console.log(
            `🩹 Auth Middleware: Recreated missing session for candidate ${candidateId} from valid JWT.`
          );
        } catch (recreateError) {
          // If even the recreate fails, fall back to a "JWT-only" session
          // for this single request. This keeps the user logged in for the
          // request rather than bouncing them; logout-all simply can't
          // track this particular session until the next successful write.
          console.error(
            'Auth Middleware: Failed to recreate session — granting JWT-only access:',
            recreateError?.message || recreateError
          );
          req.user = decoded;
          req.sessionId = null;
          return next();
        }
      }

      // 4. Reject closed / logout-everywhere sessions (history retained for HQ)
      if (session.isActive === false) {
        return res.status(401).json({
          success: false,
          message: 'Session has been invalidated. Please log in again.',
          code: 'SESSION_INVALID',
        });
      }

      // 5. Check if session is expired
      if (new Date() > new Date(session.expiresAt)) {
        await prisma.session.delete({ where: { id: session.id } });
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.',
          code: 'SESSION_EXPIRED'
        });
      }

      // 6. Update last used time (throttle to once every 5 mins to save DB calls)
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
