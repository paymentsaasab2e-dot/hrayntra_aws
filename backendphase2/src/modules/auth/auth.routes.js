import express from 'express';
import { authController } from './auth.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import sessionRoutes from '../session/session.routes.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/consume-impersonation-token', authController.consumeImpersonationToken);
router.post('/logout', authMiddleware, authController.logout);
router.get('/logout-beacon', authController.logoutBeacon);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', authMiddleware, authController.changePassword);

router.use(sessionRoutes);

export default router;
