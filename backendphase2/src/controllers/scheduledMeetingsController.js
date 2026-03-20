import { prisma } from '../config/prisma.js';
import { sendResponse, sendError } from '../utils/response.js';
import { activityService } from '../services/activityService.js';

/**
 * Get all scheduled meetings for a client
 */
export async function getClientScheduledMeetings(req, res) {
  try {
    const { clientId } = req.params;
    const { status, upcoming } = req.query;

    const where = {
      clientId,
    };

    if (status) {
      where.status = status;
    }

    if (upcoming === 'true') {
      where.scheduledAt = {
        gte: new Date(),
      };
    }

    const meetings = await prisma.scheduledMeeting.findMany({
      where,
      include: {
        scheduledBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        cancelledByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    return sendResponse(res, 200, 'Scheduled meetings fetched successfully', meetings);
  } catch (error) {
    console.error('Error fetching scheduled meetings:', error);
    return sendError(res, 500, 'Failed to fetch scheduled meetings', error.message);
  }
}

/**
 * Create a new scheduled meeting
 */
export async function createScheduledMeeting(req, res) {
  try {
    const { clientId } = req.params;
    const { meetingType, scheduledAt, reminder, notes } = req.body;
    const userId = req.user.id;

    if (!meetingType || !scheduledAt) {
      return sendError(res, 400, 'Meeting type and scheduled date/time are required');
    }

    // Validate scheduledAt is in the future
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return sendError(res, 400, 'Invalid scheduled date/time format');
    }

    // Create the scheduled meeting
    const meeting = await prisma.scheduledMeeting.create({
      data: {
        clientId,
        scheduledById: userId,
        meetingType,
        scheduledAt: scheduledDate,
        reminder: reminder || null,
        notes: notes || null,
        status: 'SCHEDULED',
      },
      include: {
        scheduledBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Update client's nextFollowUpDue if this is the earliest scheduled meeting
    const earliestMeeting = await prisma.scheduledMeeting.findFirst({
      where: {
        clientId,
        status: 'SCHEDULED',
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    if (earliestMeeting) {
      await prisma.client.update({
        where: { id: clientId },
        data: { nextFollowUpDue: earliestMeeting.scheduledAt },
      });
    }

    // Log activity
    await activityService.logClientActivity({
      clientId: clientId,
      performedById: userId,
      action: 'Meeting Scheduled',
      description: `${meetingType} scheduled for ${scheduledDate.toLocaleString()}`,
      category: 'General',
      metadata: {
        meetingId: meeting.id,
        meetingType,
        scheduledAt: scheduledDate.toISOString(),
        reminder,
      },
    });

    return sendResponse(res, 201, 'Scheduled meeting created successfully', meeting);
  } catch (error) {
    console.error('Error creating scheduled meeting:', error);
    return sendError(res, 500, 'Failed to create scheduled meeting', error.message);
  }
}

/**
 * Update a scheduled meeting
 */
export async function updateScheduledMeeting(req, res) {
  try {
    const { id } = req.params;
    const { meetingType, scheduledAt, reminder, notes, status } = req.body;
    const userId = req.user.id;

    const meeting = await prisma.scheduledMeeting.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!meeting) {
      return sendError(res, 404, 'Scheduled meeting not found');
    }

    const updateData = {};
    if (meetingType !== undefined) updateData.meetingType = meetingType;
    if (scheduledAt !== undefined) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return sendError(res, 400, 'Invalid scheduled date/time format');
      }
      updateData.scheduledAt = scheduledDate;
    }
    if (reminder !== undefined) updateData.reminder = reminder;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      } else if (status === 'CANCELLED') {
        updateData.cancelledAt = new Date();
        updateData.cancelledBy = userId;
      }
    }

    const updatedMeeting = await prisma.scheduledMeeting.update({
      where: { id },
      data: updateData,
      include: {
        scheduledBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        cancelledByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update client's nextFollowUpDue if needed
    if (status === 'CANCELLED' || scheduledAt) {
      const earliestMeeting = await prisma.scheduledMeeting.findFirst({
        where: {
          clientId: meeting.clientId,
          status: 'SCHEDULED',
        },
        orderBy: {
          scheduledAt: 'asc',
        },
      });

      await prisma.client.update({
        where: { id: meeting.clientId },
        data: { 
          nextFollowUpDue: earliestMeeting ? earliestMeeting.scheduledAt : null 
        },
      });
    }

    // Log activity
    await activityService.logClientActivity({
      clientId: meeting.clientId,
      performedById: userId,
      action: status === 'COMPLETED' ? 'Meeting Completed' : status === 'CANCELLED' ? 'Meeting Cancelled' : 'Meeting Updated',
      description: `Meeting ${status === 'COMPLETED' ? 'completed' : status === 'CANCELLED' ? 'cancelled' : 'updated'}`,
      category: 'General',
      metadata: {
        meetingId: updatedMeeting.id,
        status: updatedMeeting.status,
      },
    });

    return sendResponse(res, 200, 'Scheduled meeting updated successfully', updatedMeeting);
  } catch (error) {
    console.error('Error updating scheduled meeting:', error);
    return sendError(res, 500, 'Failed to update scheduled meeting', error.message);
  }
}

/**
 * Delete a scheduled meeting
 */
export async function deleteScheduledMeeting(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const meeting = await prisma.scheduledMeeting.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!meeting) {
      return sendError(res, 404, 'Scheduled meeting not found');
    }

    await prisma.scheduledMeeting.delete({
      where: { id },
    });

    // Update client's nextFollowUpDue
    const earliestMeeting = await prisma.scheduledMeeting.findFirst({
      where: {
        clientId: meeting.clientId,
        status: 'SCHEDULED',
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    await prisma.client.update({
      where: { id: meeting.clientId },
      data: { 
        nextFollowUpDue: earliestMeeting ? earliestMeeting.scheduledAt : null 
      },
    });

    // Log activity
    await activityService.logClientActivity({
      clientId: meeting.clientId,
      performedById: userId,
      action: 'Meeting Deleted',
      description: `Scheduled ${meeting.meetingType} deleted`,
      category: 'General',
      metadata: {
        meetingId: meeting.id,
        meetingType: meeting.meetingType,
      },
    });

    return sendResponse(res, 200, { message: 'Scheduled meeting deleted successfully' });
  } catch (error) {
    console.error('Error deleting scheduled meeting:', error);
    return sendError(res, 500, 'Failed to delete scheduled meeting', error.message);
  }
}
