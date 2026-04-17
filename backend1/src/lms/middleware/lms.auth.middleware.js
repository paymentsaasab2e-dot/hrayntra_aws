const jwt = require('jsonwebtoken');

function requireLmsAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'saasa_jwt_secret_key_2024';
    const decoded = jwt.verify(token, secret);
    
    // Map candidateId from payload to req.user.id
    req.user = {
      id: decoded.candidateId,
      ...decoded
    };
    
    next();
  } catch (error) {
    // Only log unexpected errors, not common JWT validation issues (to keep logs clean)
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      console.error('LMS Auth Middleware Unexpected Error:', error);
    }
    
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Invalid or expired token',
      code: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
}

module.exports = {
  requireLmsAuth
};
