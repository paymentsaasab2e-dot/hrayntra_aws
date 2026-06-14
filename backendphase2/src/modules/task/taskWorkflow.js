import { createAlertNotification } from '../setting/alert-dispatch.service.js';

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

  await createAlertNotification(assigneeUserId, 'task.assigned', {
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
 * Notify creator when assignee completes (can be called from status change).
 */
export async function notifyTaskStatusChange({
  task,
  actorUserId,
  newStatus,
}) {
  if (!task?.id || !task.createdById) return;
  if (task.createdById === actorUserId) return;
  if (newStatus !== 'DONE') return;

  await createAlertNotification(task.createdById, 'task.completed', {
    category: 'TASK',
    title: 'Task completed',
    description: `"${task.title}" was marked completed.`,
    actionLabel: 'View task',
    actionPath: `/Task&Activites?taskId=${encodeURIComponent(task.id)}`,
    entityType: 'TASK',
    entityId: task.id,
  });
}

export async function notifyTaskAwaitingApproval({ task, actorUserId, approverUserId, actorUser }) {
  if (!task?.id || !approverUserId) return;
  if (approverUserId === actorUserId) return;

  const actorName = displayUser(actorUser) || 'A team member';
  await createAlertNotification(approverUserId, 'task.awaiting_approval', {
    category: 'TASK',
    title: 'Task ready for your approval',
    description: `${actorName} submitted "${task.title}" for your approval.`,
    actionLabel: 'Review task',
    actionPath: `/Task&Activites?taskId=${encodeURIComponent(task.id)}`,
    entityType: 'TASK',
    entityId: task.id,
    metadata: {
      taskId: task.id,
      actorUserId: actorUserId || null,
      approverUserId,
    },
  });
}

export async function notifyTaskCompletionApproved({ task, actorUserId, actorUser }) {
  if (!task?.id) return;

  const actorName = displayUser(actorUser) || 'Your manager';
  const notifyIds = uniqueNotifyIds(
    task.completionRequestedById,
    task.createdById,
  ).filter((id) => id !== actorUserId);

  for (const userId of notifyIds) {
    await createAlertNotification(userId, 'task.completion_approved', {
      category: 'TASK',
      title: 'Task approved and completed',
      description: `${actorName} approved "${task.title}".`,
      actionLabel: 'View task',
      actionPath: `/Task&Activites?taskId=${encodeURIComponent(task.id)}`,
      entityType: 'TASK',
      entityId: task.id,
    });
  }
}

export async function notifyTaskCompletionRejected({
  task,
  actorUserId,
  actorUser,
  note,
}) {
  if (!task?.id || !task.completionRequestedById) return;
  if (task.completionRequestedById === actorUserId) return;

  const actorName = displayUser(actorUser) || 'Your manager';
  const suffix = note ? ` Note: ${note}` : '';
  await createAlertNotification(task.completionRequestedById, 'task.completion_rejected', {
    category: 'TASK',
    title: 'Task sent back for changes',
    description: `${actorName} rejected completion of "${task.title}".${suffix}`,
    actionLabel: 'Open task',
    actionPath: `/Task&Activites?taskId=${encodeURIComponent(task.id)}`,
    entityType: 'TASK',
    entityId: task.id,
  });
}

function uniqueNotifyIds(...values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}
