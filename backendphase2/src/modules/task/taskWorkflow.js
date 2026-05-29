import { createUserNotification } from '../notification/notification.service.js';

function displayUser(user) {
  if (!user) return 'Someone';
  if (user.name) return user.name;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return user.email || 'Someone';
}

/**
 * Notify assignee when a task is assigned or reassigned (Jira-style).
 */
export async function notifyTaskAssignment({
  task,
  actorUserId,
  assigneeUserId,
  isReassign = false,
  actorName: actorNameOverride,
  actorUser,
}) {
  if (!task?.id || !assigneeUserId) return;
  if (assigneeUserId === actorUserId) return;

  const actorName =
    actorNameOverride || displayUser(actorUser) || displayUser(task.createdBy);
  const title = isReassign ? 'Task reassigned to you' : 'New task assigned to you';
  const description = `${actorName} assigned "${task.title}" to you.`;

  await createUserNotification(assigneeUserId, {
    category: 'TASK',
    title,
    description,
    actionLabel: 'Open task',
    actionPath: `/Task&Activites?taskId=${encodeURIComponent(task.id)}`,
    entityType: 'TASK',
    entityId: task.id,
    metadata: {
      taskId: task.id,
      actorUserId: actorUserId || null,
      assigneeUserId,
    },
  });
}

/**
 * Optional: notify creator when assignee completes (can be called from status change).
 */
export async function notifyTaskStatusChange({
  task,
  actorUserId,
  newStatus,
}) {
  if (!task?.id || !task.createdById) return;
  if (task.createdById === actorUserId) return;
  if (newStatus !== 'DONE') return;

  await createUserNotification(task.createdById, {
    category: 'TASK',
    title: 'Task completed',
    description: `"${task.title}" was marked completed.`,
    actionLabel: 'View task',
    actionPath: `/Task&Activites?taskId=${encodeURIComponent(task.id)}`,
    entityType: 'TASK',
    entityId: task.id,
  });
}
