import type { BackendActivity } from './api';
import type { TaskActivityEvent, TaskActivityEventType } from '../app/Task&Activites/types';

function performerName(activity: BackendActivity): string {
  const u = activity.performedBy;
  if (!u) return 'System';
  if (u.name) return u.name;
  const parts = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return parts || u.email || 'System';
}

function resolveActionType(activity: BackendActivity): TaskActivityEventType {
  const action = String(activity.action || '').toLowerCase();
  const field = String((activity.metadata as { field?: string })?.field || '').toLowerCase();

  if (action.includes('created')) return 'created';
  if (action.includes('deleted')) return 'deleted';
  if (action.includes('note')) return 'note_added';
  if (action.includes('assign')) return 'assigned';
  if (action.includes('attachment') || action.includes('file')) return 'attachment_uploaded';
  if (action.includes('completed') || action.includes('done')) return 'completed';
  if (action.includes('reopen')) return 'reopened';

  if (field === 'status' || action.includes('status')) return 'status_updated';
  if (field === 'priority' || action.includes('priority')) return 'priority_changed';
  if (field === 'duedate' || field === 'duetime' || action.includes('due')) return 'due_date_changed';
  if (field === 'reminder') return 'reminder_changed';
  if (field === 'assignedtoid') return 'assigned';

  return 'edited';
}

export function mapBackendActivityToTaskEvent(activity: BackendActivity): TaskActivityEvent {
  return {
    id: activity.id,
    actionType: resolveActionType(activity),
    title: activity.action,
    actorName: performerName(activity),
    timestamp: activity.createdAt,
    metadata: activity.description || undefined,
  };
}
