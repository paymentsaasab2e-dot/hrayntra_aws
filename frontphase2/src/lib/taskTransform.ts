import type { BackendTask } from './api';
import { formatDateTimeDMY } from '../utils/dateDisplay';
import { extractAuditMeta } from '../utils/auditMeta';
import type { Task, TaskStatus, TaskPriority, TaskType, TaskRelatedTo } from '../app/Task&Activites/types';
import type { TaskForDrawer } from '../components/drawers/TaskDetailsDrawer';

export interface TaskAssignmentChain {
  createdByName: string;
  assignedToName: string;
  delegatedToName: string | null;
  isDelegated: boolean;
}

export function resolveTaskAssignmentChain(
  backendTask: BackendTask,
  memberNameById: Record<string, string> = {},
): TaskAssignmentChain {
  const nameFor = (id: string, explicit?: string | null) => {
    if (explicit?.trim()) return explicit.trim();
    if (id && memberNameById[id]) return memberNameById[id];
    return id ? 'Team member' : '—';
  };

  const createdById = String(backendTask.createdById || backendTask.createdBy?.id || '').trim();
  const currentAssigneeId = String(backendTask.assignedToId || backendTask.assignedTo?.id || '').trim();
  const createdByName = nameFor(createdById, backendTask.createdBy?.name);
  const currentAssigneeName = nameFor(
    currentAssigneeId,
    backendTask.assignedTo?.name || (currentAssigneeId ? 'Unassigned' : '—'),
  );

  const participants = [
    ...new Set((backendTask.participantIds || []).map((id) => String(id).trim()).filter(Boolean)),
  ];
  const firstAssigneeId = participants.find((id) => id !== createdById);
  const isDelegated = Boolean(
    firstAssigneeId && currentAssigneeId && firstAssigneeId !== currentAssigneeId,
  );

  if (!isDelegated) {
    return {
      createdByName,
      assignedToName: currentAssigneeName,
      delegatedToName: null,
      isDelegated: false,
    };
  }

  return {
    createdByName,
    assignedToName: nameFor(firstAssigneeId!),
    delegatedToName: currentAssigneeName,
    isDelegated: true,
  };
}

/**
 * Transform backend task format to frontend Task format
 */
export function transformBackendTaskToFrontend(
  backendTask: BackendTask,
  options?: { relatedEntityName?: string; memberNameById?: Record<string, string> }
): Task {
  const priorityMap: Record<string, TaskPriority> = {
    'LOW': 'Low',
    'MEDIUM': 'Medium',
    'HIGH': 'High',
  };

  const workflowStatusMap: Record<string, TaskStatus> = {
    PENDING: 'Pending',
    TODO: 'Pending',
    IN_PROGRESS: 'In Progress',
    AWAITING_APPROVAL: 'Awaiting Approval',
    DONE: 'Completed',
    CANCELLED: 'Cancelled',
  };

  const linkedEntityTypeMap: Record<string, TaskRelatedTo> = {
    'CANDIDATE': 'Candidate',
    'JOB': 'Job',
    'CLIENT': 'Client',
    'INTERVIEW': 'Interview',
    'INTERNAL': 'Internal',
  };

  const workflowStatus: TaskStatus = workflowStatusMap[backendTask.status] || 'Pending';
  let status: TaskStatus = workflowStatus;
  if (
    backendTask.isOverdue &&
    workflowStatus !== 'Completed' &&
    workflowStatus !== 'Cancelled' &&
    workflowStatus !== 'Awaiting Approval'
  ) {
    status = 'Overdue';
  }

  // Get related entity name (we'll need to fetch this separately or include in backend response)
  // For now, use a placeholder
  const relatedToName = backendTask.linkedEntityId || 'Unknown';

  // Format due date
  const dueDate = new Date(backendTask.dueDate).toISOString().split('T')[0];

  return {
    id: backendTask.id,
    title: backendTask.title,
    type: (backendTask.taskType as TaskType) || 'Note',
    relatedTo: {
      id: backendTask.linkedEntityId || '',
      name: options?.relatedEntityName || relatedToName,
      type: backendTask.linkedEntityType ? linkedEntityTypeMap[backendTask.linkedEntityType] : 'Internal',
    },
    dueDate,
    time: backendTask.dueTime || '',
    dueTime: backendTask.dueTime || '',
    priority: priorityMap[backendTask.priority] || 'Medium',
    status,
    workflowStatus,
    assignee: {
      id: backendTask.assignedTo?.id || backendTask.assignedToId,
      name: backendTask.assignedTo?.name || 'Unassigned',
    },
    assigneeId: backendTask.assignedToId || backendTask.assignedTo?.id,
    createdById: backendTask.createdById || backendTask.createdBy?.id,
    createdByName: backendTask.createdBy?.name,
    participantIds: backendTask.participantIds,
    completionApproverId: backendTask.completionApproverId || undefined,
    completionRequestedById: backendTask.completionRequestedById || undefined,
    assignmentChain: resolveTaskAssignmentChain(
      backendTask,
      options?.memberNameById || {},
    ),
    owner: {
      name: backendTask.assignedTo?.name || 'Unassigned',
      avatar: '',
    },
    auditMeta: extractAuditMeta(backendTask as Record<string, unknown>),
  };
}

/**
 * Transform backend task to TaskForDrawer format
 */
export function transformBackendTaskToDrawer(
  backendTask: BackendTask,
  options?: { relatedEntityName?: string }
): TaskForDrawer {
  const priorityMap: Record<string, TaskPriority> = {
    'LOW': 'Low',
    'MEDIUM': 'Medium',
    'HIGH': 'High',
  };

  const workflowStatusMap: Record<string, TaskStatus> = {
    PENDING: 'Pending',
    TODO: 'Pending',
    IN_PROGRESS: 'In Progress',
    AWAITING_APPROVAL: 'Awaiting Approval',
    DONE: 'Completed',
    CANCELLED: 'Cancelled',
  };

  const linkedEntityTypeMap: Record<string, TaskRelatedTo> = {
    CANDIDATE: 'Candidate',
    JOB: 'Job',
    CLIENT: 'Client',
    INTERVIEW: 'Interview',
    INTERNAL: 'Internal',
  };

  const workflowStatus: TaskStatus = workflowStatusMap[backendTask.status] || 'Pending';
  let status: TaskStatus = workflowStatus;
  if (
    backendTask.isOverdue &&
    workflowStatus !== 'Completed' &&
    workflowStatus !== 'Cancelled' &&
    workflowStatus !== 'Awaiting Approval'
  ) {
    status = 'Overdue';
  }

  const dueDate = new Date(backendTask.dueDate).toISOString().split('T')[0];

  return {
    id: backendTask.id,
    title: backendTask.title,
    type: (backendTask.taskType as TaskType) || 'Note',
    relatedTo: {
      id: backendTask.linkedEntityId || '',
      name: options?.relatedEntityName || backendTask.linkedEntityId || 'Unknown',
      type: backendTask.linkedEntityType ? linkedEntityTypeMap[backendTask.linkedEntityType] : 'Internal',
    },
    dueDate,
    time: backendTask.dueTime || '',
    dueTime: backendTask.dueTime || '',
    priority: priorityMap[backendTask.priority] || 'Medium',
    status,
    workflowStatus,
    owner: {
      name: backendTask.assignedTo.name,
      avatar: backendTask.assignedTo.avatar || '',
    },
    assignee: {
      id: backendTask.assignedToId || backendTask.assignedTo?.id,
      name: backendTask.assignedTo.name,
    },
    assigneeId: backendTask.assignedToId || backendTask.assignedTo?.id,
    createdById: backendTask.createdById || backendTask.createdBy?.id,
    createdByName: backendTask.createdBy?.name,
    assignedToId: backendTask.assignedToId || backendTask.assignedTo?.id,
    backendStatus: backendTask.status,
    participantIds: backendTask.participantIds,
    completionApproverId: backendTask.completionApproverId || undefined,
    completionRequestedById: backendTask.completionRequestedById || undefined,
    description: backendTask.description || undefined,
    reminder: backendTask.reminder || undefined,
    lastUpdated: {
      by: backendTask.createdBy.name,
      at: formatDateTimeDMY(backendTask.updatedAt),
    },
    createdBy: {
      name: backendTask.createdBy.name,
      at: formatDateTimeDMY(backendTask.createdAt),
    },
    notes: backendTask.notes.length > 0 ? backendTask.notes : undefined,
    attachments: (() => {
      // First, use files from TaskFile model if available (new approach)
      if (backendTask.files && backendTask.files.length > 0) {
        return backendTask.files.map(file => ({
          name: file.fileName,
          url: file.fileUrl.startsWith('http://') || file.fileUrl.startsWith('https://') 
            ? file.fileUrl 
            : (() => {
                // For static files, use base URL without /api/v1
                const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:5001/api/v1';
                const baseUrl = apiUrl.replace(/\/api\/v1$/, '') || 'http://localhost:5001';
                return `${baseUrl}${file.fileUrl}`;
              })(),
        }));
      }
      // Fallback to legacy attachments array (for backward compatibility)
      if (backendTask.attachments.length > 0) {
        return backendTask.attachments.map(att => {
          // If attachment is a URL, extract filename and URL
          if (att.startsWith('http://') || att.startsWith('https://')) {
            // Extract filename from URL (last part after /)
            const urlParts = att.split('/');
            const filename = urlParts[urlParts.length - 1] || 'attachment';
            return { name: decodeURIComponent(filename), url: att };
          }
          // Otherwise, it's just a filename
          return { name: att };
        });
      }
      return undefined;
    })(),
    auditMeta: extractAuditMeta(backendTask as Record<string, unknown>),
  };
}
