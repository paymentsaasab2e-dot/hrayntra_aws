import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getClientScheduledMeetings,
  createScheduledMeeting,
  updateScheduledMeeting,
  deleteScheduledMeeting,
} from '../controllers/scheduledMeetingsController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all scheduled meetings for a client
router.get('/clients/:clientId/meetings', getClientScheduledMeetings);

// Create a new scheduled meeting
router.post('/clients/:clientId/meetings', createScheduledMeeting);

// Update a scheduled meeting
router.patch('/clients/:clientId/meetings/:id', updateScheduledMeeting);

// Delete a scheduled meeting
router.delete('/clients/:clientId/meetings/:id', deleteScheduledMeeting);

export default router;
