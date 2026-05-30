import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { canViewAllAssignments } from '../../utils/permissionScope.js';
import { prepareListWithAuditMeta } from '../../utils/listAuditMeta.js';
import { ENTITY_TYPES } from '../../services/activityService.js';
import { attachAuditMetaToEntity } from '../../utils/listAuditMeta.js';
import activityService from '../../services/activityService.js';
import { notifyTaskAssignment, notifyTaskStatusChange } from './taskWorkflow.js';
import { assertCanAssignTask, listTaskAssigneeCandidates } from '../../services/taskAssignmentScope.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const taskService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { assignedToId, status, priority, linkedEntityType, linkedEntityId } = req.query;

    const where = {};
    if (assignedToId) where.assignedToId = assignedToId;
    if (status) {
      // Map frontend status to backend enum
      const statusMap = {
        'Pending': 'PENDING',
        'In Progress': 'IN_PROGRESS',
        'Completed': 'DONE',
        'Overdue': 'PENDING', // Overdue is calculated, not stored
        'Cancelled': 'CANCELLED',
        'TODO': 'PENDING', // legacy value support
        'PENDING': 'PENDING',
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
    if (!canViewAllAssignments(req) && req.user?.id) {
      where.OR = [{ assignedToId: req.user.id }, { createdById: req.user.id }];
    }

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
          files: {
            include: {
              uploadedBy: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.task.count({ where }),
    ]);

    const withAudit = await prepareListWithAuditMeta(tasks, ENTITY_TYPES.TASK);
    return formatPaginationResponse(withAudit, page, limit, total);
  },

  async getById(id, req = null) {
    const where = { id };
    if (!canViewAllAssignments(req) && req?.user?.id) {
      where.OR = [{ assignedToId: req.user.id }, { createdById: req.user.id }];
    }

    const task = await prisma.task.findFirst({
      where,
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

    const merged = {
      ...task,
      isOverdue,
    };
    return attachAuditMetaToEntity(merged, ENTITY_TYPES.TASK);
  },

  async create(data, req = null) {
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
      'Pending': 'PENDING',
      'In Progress': 'IN_PROGRESS',
      'Completed': 'DONE',
      'Cancelled': 'CANCELLED',
      'TODO': 'PENDING',
      'PENDING': 'PENDING',
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

    const actorId = data.createdById || req?.user?.id;
    if (actorId) {
      await assertCanAssignTask(actorId, assignedToId);
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
      status: statusMap[data.status] || 'PENDING',
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

    console.log(`✅ Task created successfully with ID: ${task.id}\n`);

    if (data.createdById) {
      await activityService.logTaskCreated({
        entityId: task.id,
        performedById: data.createdById,
        entityName: task.title,
        metadata: {
          assigneeId: task.assignedToId,
          assigneeName: task.assignedTo?.name || null,
        },
      });

      if (task.assignedToId && task.assignedToId !== data.createdById) {
        await activityService.logTaskActivity({
          entityId: task.id,
          performedById: data.createdById,
          action: 'Task assigned',
          description: `Assigned to ${task.assignedTo?.name || 'team member'}`,
          metadata: { assigneeId: task.assignedToId },
        });
      }
    }

    const shouldNotify =
      task.notifyAssignee !== false &&
      task.assignedToId &&
      data.createdById &&
      task.assignedToId !== data.createdById;

    if (shouldNotify) {
      await notifyTaskAssignment({
        task,
        actorUserId: data.createdById,
        assigneeUserId: task.assignedToId,
        isReassign: false,
      });
    }

    return task;
  },

  async update(id, data, req = null) {
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
      'Pending': 'PENDING',
      'In Progress': 'IN_PROGRESS',
      'Completed': 'DONE',
      'Cancelled': 'CANCELLED',
      'TODO': 'PENDING',
      'PENDING': 'PENDING',
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

    const accessWhere = { id };
    if (!canViewAllAssignments(req) && req?.user?.id) {
      accessWhere.OR = [{ assignedToId: req.user.id }, { createdById: req.user.id }];
    }

    const existingTask = await prisma.task.findFirst({
      where: accessWhere,
    });
    if (!existingTask) {
      throw new Error('Task not found');
    }

    const newAssigneeId = updateData.assignedToId;
    if (newAssigneeId !== undefined) {
      const actorId = req?.user?.id || data.performedById;
      if (actorId) {
        await assertCanAssignTask(actorId, newAssigneeId);
      }
    }

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

    console.log(`✅ Task updated successfully (ID: ${id})\n`);

    const performerId = req?.user?.id || data.performedById;
    if (performerId) {
      await activityService.logTaskFieldChanges({
        entityId: id,
        performedById: performerId,
        oldData: existingTask,
        newData: { ...existingTask, ...updateData },
        trackedFields: Object.keys(updateData),
      });
    }

    const assigneeChanged =
      updateData.assignedToId !== undefined &&
      String(updateData.assignedToId) !== String(existingTask.assignedToId);

    if (assigneeChanged && updated.assignedToId) {
      const notify =
        updated.notifyAssignee !== false &&
        performerId &&
        updated.assignedToId !== performerId;
      if (notify) {
        await notifyTaskAssignment({
          task: updated,
          actorUserId: performerId,
          assigneeUserId: updated.assignedToId,
          isReassign: true,
          actorUser: req?.user,
        });
      }
    }

    if (updateData.status === 'DONE' && existingTask.status !== 'DONE') {
      await notifyTaskStatusChange({
        task: updated,
        actorUserId: performerId,
        newStatus: 'DONE',
      });
    }

    return updated;
  },

  async getAssignableMembers(req) {
    const actorId = req?.user?.id;
    if (!actorId) return [];
    return listTaskAssigneeCandidates(actorId);
  },

  async delete(id, req = null) {
    const where = { id };
    if (!canViewAllAssignments(req) && req?.user?.id) {
      where.OR = [{ assignedToId: req.user.id }, { createdById: req.user.id }];
    }

    const task = await prisma.task.findFirst({
      where,
      include: { files: true },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const localFileUrls = [
      ...(task.attachments || []),
      ...task.files.map((file) => file.fileUrl),
    ].filter((fileUrl) => fileUrl && !fileUrl.startsWith('http://') && !fileUrl.startsWith('https://'));

    for (const fileUrl of localFileUrls) {
      try {
        const normalizedPath = fileUrl.replace(/^\/+/, '');
        const absolutePath = path.join(__dirname, '..', '..', '..', normalizedPath);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      } catch (error) {
        console.warn(`Failed to remove task file during delete: ${fileUrl}`, error);
      }
    }

    await prisma.taskFile.deleteMany({ where: { taskId: id } });
    await prisma.task.delete({ where: { id } });

    if (req?.user?.id) {
      await activityService.logTaskDeleted({
        entityId: id,
        performedById: req.user.id,
        entityName: task.title,
      });
    }

    return { message: 'Task deleted successfully' };
  },

  async addNote(id, note, performedById = null) {
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

    if (performedById) {
      await activityService.logTaskActivity({
        entityId: id,
        performedById,
        action: 'Note added',
        description: note.trim(),
      });
    }

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
