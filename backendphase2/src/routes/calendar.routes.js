import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { calendarController } from '../controllers/calendar.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', calendarController.getUnifiedCalendar);

export default router;
