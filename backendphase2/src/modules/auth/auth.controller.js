import { authService } from './auth.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const authController = {
  async register(req, res) {
    try {
      const result = await authService.register(req.body);
      sendResponse(res, 201, 'User registered successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async login(req, res) {
    try {
      const { email, loginId, password } = req.body;
      const loginIdentifier = loginId || email;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent') || 'Unknown';
      
      const result = await authService.login(loginIdentifier, password, ipAddress, userAgent);
      sendResponse(res, 200, 'Login successful', result);
    } catch (error) {
      if (error.statusCode === 423) {
        return sendError(res, 423, error.message, error);
      }
      sendError(res, 401, error.message, error);
    }
  },

  async logout(req, res) {
    try {
      await authService.logout(req.user.id);
      sendResponse(res, 200, 'Logout successful');
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      sendResponse(res, 200, 'Token refreshed', result);
    } catch (error) {
      sendError(res, 401, error.message, error);
    }
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async verifyOtp(req, res) {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyOtp(email, otp);
      sendResponse(res, 200, 'OTP verified', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async resetPassword(req, res) {
    try {
      const { email, otp, newPassword } = req.body;
      const result = await authService.resetPassword(email, otp, newPassword);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async changePassword(req, res) {
    try {
      const { userId, newPassword } = req.body;
      
      // Validate input
      if (!userId || !newPassword) {
        return sendError(res, 400, 'UserId and newPassword are required');
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return sendError(res, 400, 'Password must be at least 8 characters');
      }

      // Verify the userId matches the authenticated user (security check)
      if (req.user && req.user.id !== userId) {
        return sendError(res, 403, 'You can only change your own password');
      }

      const result = await authService.changePassword(userId, newPassword);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
