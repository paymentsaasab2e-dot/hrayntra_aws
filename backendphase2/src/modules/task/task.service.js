import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';

export const taskService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { assignedToId, status, priority, linkedEntityType, linkedEntityId } = req.query;

    const where = {};
    if (assignedToId) where.assignedToId = assignedToId;
    if (status) {
      // Map frontend status to backend enum
      const statusMap = {
        'Pending': 'TODO',
        'In Progress': 'IN_PROGRESS',
        'Completed': 'DONE',
        'Overdue': 'TODO', // Overdue is calculated, not stored
        'Cancelled': 'CANCELLED',
      };
      where.status = statusMap[status] || status;
    }
    if (priority) {
      // Map frontend priority to backend enum
      const priorityMap = {
        'Low': 'LOW',
        'Medium': 'MEDIUM',
        'High': 'HIGH',
      };
      where.priority = priorityMap[priority] || priority;
    }
    if (linkedEntityType) {
      const typeMap = {
        'Candidate': 'CANDIDATE',
        'Job': 'JOB',
        'Client': 'CLIENT',
        'Interview': 'INTERVIEW',
        'Internal': 'INTERNAL',
      };
      where.linkedEntityType = typeMap[linkedEntityType] || linkedEntityType;
    }
    if (linkedEntityId) where.linkedEntityId = linkedEntityId;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.task.count({ where }),
    ]);

    return formatPaginationResponse(tasks, page, limit, total);
  },

  async getById(id) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        files: {
          include: {
            uploadedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) return null;

    // Calculate if task is overdue
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const isOverdue = task.status !== 'DONE' && dueDate < now;

    return {
      ...task,
      isOverdue,
    };
  },

  async create(data) {
    // Validate ObjectID format
    const isValidObjectId = (id) => {
      if (!id || typeof id !== 'string') return false;
      return /^[0-9a-fA-F]{24}$/.test(id);
    };

    // Map frontend TaskFormValues to backend schema
    const priorityMap = {
      'Low': 'LOW',
      'Medium': 'MEDIUM',
      'High': 'HIGH',
    };

    const statusMap = {
      'Pending': 'TODO',
      'In Progress': 'IN_PROGRESS',
      'Completed': 'DONE',
      'Cancelled': 'CANCELLED',
    };

    const linkedEntityTypeMap = {
      'Candidate': 'CANDIDATE',
      'Job': 'JOB',
      'Client': 'CLIENT',
      'Interview': 'INTERVIEW',
      'Internal': 'INTERNAL',
    };

    // Validate assignedToId
    const assignedToId = data.assignedToId || data.assigneeId;
    if (!assignedToId) {
      throw new Error('Assignee ID is required');
    }
    if (!isValidObjectId(assignedToId)) {
      throw new Error(`Invalid assignee ID format. Expected MongoDB ObjectID, got: ${assignedToId}`);
    }

    // Validate linkedEntityId if provided
    const linkedEntityId = data.linkedEntityId || data.relatedEntityId;
    if (linkedEntityId && !isValidObjectId(linkedEntityId)) {
      throw new Error(`Invalid linked entity ID format. Expected MongoDB ObjectID, got: ${linkedEntityId}`);
    }

    // Parse attachments from comma-separated string or array
    let attachments = [];
    if (data.attachments) {
      attachments = Array.isArray(data.attachments) ? data.attachments : data.attachments.split(',').map(a => a.trim()).filter(Boolean);
    } else if (data.attachmentNames) {
      attachments = data.attachmentNames.split(',').map(a => a.trim()).filter(Boolean);
    }

    // Parse dueDate and dueTime
    const dueDate = data.dueDate ? new Date(data.dueDate) : new Date();
    let dueTime = null;
    if (data.dueTime) {
      dueTime = data.dueTime;
    } else if (data.time) {
      dueTime = data.time;
    }

    const taskData = {
      title: data.title,
      description: data.description || null,
      dueDate,
      dueTime,
      priority: priorityMap[data.priority] || 'MEDIUM',
      status: statusMap[data.status] || 'TODO',
      taskType: data.taskType || data.type || null,
      assignedToId,
      createdById: data.createdById,
      linkedEntityType: data.linkedEntityType || (data.relatedTo ? linkedEntityTypeMap[data.relatedTo] : null),
      linkedEntityId: linkedEntityId || null,
      reminder: data.reminder || null,
      reminderChannel: data.reminderChannel || null,
      attachments,
      notifyAssignee: data.notifyAssignee !== undefined ? data.notifyAssignee : true,
      notes: data.notes || [],
    };

    dbLogger.logCreate('TASK', taskData);

    const task = await prisma.task.create({
      data: taskData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    console.log(`✅ Task created successfully with ID: ${task.id}\n`);

    return task;
  },

  async update(id, data) {
    // Validate ObjectID format
    const isValidObjectId = (id) => {
      if (!id || typeof id !== 'string') return false;
      return /^[0-9a-fA-F]{24}$/.test(id);
    };

    // Map frontend TaskFormValues to backend schema
    const priorityMap = {
      'Low': 'LOW',
      'Medium': 'MEDIUM',
      'High': 'HIGH',
    };

    const statusMap = {
      'Pending': 'TODO',
      'In Progress': 'IN_PROGRESS',
      'Completed': 'DONE',
      'Cancelled': 'CANCELLED',
    };

    const linkedEntityTypeMap = {
      'Candidate': 'CANDIDATE',
      'Job': 'JOB',
      'Client': 'CLIENT',
      'Interview': 'INTERVIEW',
      'Internal': 'INTERNAL',
    };

    const updateData = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.dueTime !== undefined) updateData.dueTime = data.dueTime;
    if (data.time !== undefined) updateData.dueTime = data.time;
    if (data.priority !== undefined) updateData.priority = priorityMap[data.priority] || data.priority;
    if (data.status !== undefined) updateData.status = statusMap[data.status] || data.status;
    if (data.taskType !== undefined) updateData.taskType = data.taskType;
    if (data.type !== undefined) updateData.taskType = data.type;
    
    // Validate assignedToId if provided
    if (data.assignedToId !== undefined) {
      if (!isValidObjectId(data.assignedToId)) {
        throw new Error(`Invalid assignee ID format. Expected MongoDB ObjectID, got: ${data.assignedToId}`);
      }
      updateData.assignedToId = data.assignedToId;
    }
    if (data.assigneeId !== undefined) {
      if (!isValidObjectId(data.assigneeId)) {
        throw new Error(`Invalid assignee ID format. Expected MongoDB ObjectID, got: ${data.assigneeId}`);
      }
      updateData.assignedToId = data.assigneeId;
    }
    
    if (data.linkedEntityType !== undefined) updateData.linkedEntityType = data.linkedEntityType;
    if (data.relatedTo !== undefined) updateData.linkedEntityType = linkedEntityTypeMap[data.relatedTo] || null;
    
    // Validate linkedEntityId if provided
    if (data.linkedEntityId !== undefined) {
      if (data.linkedEntityId && !isValidObjectId(data.linkedEntityId)) {
        throw new Error(`Invalid linked entity ID format. Expected MongoDB ObjectID, got: ${data.linkedEntityId}`);
      }
      updateData.linkedEntityId = data.linkedEntityId || null;
    }
    if (data.relatedEntityId !== undefined) {
      if (data.relatedEntityId && !isValidObjectId(data.relatedEntityId)) {
        throw new Error(`Invalid linked entity ID format. Expected MongoDB ObjectID, got: ${data.relatedEntityId}`);
      }
      updateData.linkedEntityId = data.relatedEntityId || null;
    }
    
    if (data.reminder !== undefined) updateData.reminder = data.reminder || null;
    if (data.reminderChannel !== undefined) updateData.reminderChannel = data.reminderChannel || null;
    if (data.notifyAssignee !== undefined) updateData.notifyAssignee = data.notifyAssignee;
    if (data.notes !== undefined) updateData.notes = Array.isArray(data.notes) ? data.notes : [];
    if (data.attachments !== undefined) {
      updateData.attachments = Array.isArray(data.attachments) 
        ? data.attachments 
        : data.attachments.split(',').map(a => a.trim()).filter(Boolean);
    }
    if (data.attachmentNames !== undefined) {
      updateData.attachments = data.attachmentNames.split(',').map(a => a.trim()).filter(Boolean);
    }

    dbLogger.logUpdate('TASK', id, updateData);

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    console.log(`✅ Task updated successfully (ID: ${id})\n`);

    return updated;
  },

  async delete(id) {
    await prisma.task.delete({ where: { id } });
    return { message: 'Task deleted successfully' };
  },

  async addNote(id, note) {
    if (!note || !note.trim()) {
      throw new Error('Note cannot be empty');
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new Error('Task not found');
    }

    const updatedNotes = [...(task.notes || []), note.trim()];

    const updated = await prisma.task.update({
      where: { id },
      data: { notes: updatedNotes },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    console.log(`✅ Note added to task (ID: ${id})\n`);

    return updated;
  },

  async getStats(userId = null) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    
    const weekEnd = new Date(todayEnd);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Base where clause - filter by user if provided
    const baseWhere = userId ? { assignedToId: userId } : {};

    // 1. Tasks Completed Today
    const completedToday = await prisma.task.count({
      where: {
        ...baseWhere,
        status: 'DONE',
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // 2. Tasks Completed Yesterday (for trend calculation)
    const completedYesterday = await prisma.task.count({
      where: {
        ...baseWhere,
        status: 'DONE',
        updatedAt: { gte: yesterdayStart, lte: yesterdayEnd },
      },
    });

    // 3. Overdue Tasks (status not DONE and dueDate < today)
    const overdueTasks = await prisma.task.count({
      where: {
        ...baseWhere,
        status: { not: 'DONE' },
        dueDate: { lt: todayStart },
      },
    });

    // 4. Average Completion Time (for tasks completed this week)
    const completedThisWeek = await prisma.task.findMany({
      where: {
        ...baseWhere,
        status: 'DONE',
        updatedAt: { gte: weekStart },
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    const avgCompletionTimeDays = completedThisWeek.length > 0
      ? completedThisWeek.reduce((sum, task) => {
          const createdAt = new Date(task.createdAt).getTime();
          const completedAt = new Date(task.updatedAt).getTime();
          const diffDays = Math.max(0, (completedAt - createdAt) / (1000 * 60 * 60 * 24));
          return sum + diffDays;
        }, 0) / completedThisWeek.length
      : 0;

    // 5. Recruiter Productivity (% of tasks completed)
    const totalTasks = await prisma.task.count({ where: baseWhere });
    const completedTasks = await prisma.task.count({
      where: {
        ...baseWhere,
        status: 'DONE',
      },
    });
    const productivityPercent = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    // 6. Due Today
    const dueToday = await prisma.task.count({
      where: {
        ...baseWhere,
        status: { not: 'DONE' },
        dueDate: { gte: todayStart, lte: todayEnd },
      },
    });

    // 7. Upcoming (7D) - tasks due in next 7 days
    const upcoming7d = await prisma.task.count({
      where: {
        ...baseWhere,
        status: { not: 'DONE' },
        dueDate: { gt: todayEnd, lte: weekEnd },
      },
    });

    // 8. Completed (all time)
    const completed = completedTasks;

    // Calculate trend for completed today
    const trendCompletedToday = completedToday > completedYesterday
      ? `+${completedToday - completedYesterday} vs yesterday`
      : completedToday < completedYesterday
      ? `${completedToday - completedYesterday} vs yesterday`
      : 'No change vs yesterday';

    return {
      completedToday,
      overdueCount: overdueTasks,
      avgCompletionTimeDays: Number(avgCompletionTimeDays.toFixed(1)),
      productivityPercent,
      dueToday,
      overdue: overdueTasks,
      upcoming7d,
      completed,
      trendCompletedToday,
    };
  },
};
