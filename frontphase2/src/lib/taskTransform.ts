import type { BackendTask } from './api';
import type { Task, TaskForDrawer, TaskStatus, TaskPriority, TaskType, TaskRelatedTo } from '../app/Task&Activites/types';

/**
 * Transform backend task format to frontend Task format
 */
export function transformBackendTaskToFrontend(backendTask: BackendTask): Task {
  const priorityMap: Record<string, TaskPriority> = {
    'LOW': 'Low',
    'MEDIUM': 'Medium',
    'HIGH': 'High',
  };

  const statusMap: Record<string, TaskStatus> = {
    'TODO': 'Pending',
    'IN_PROGRESS': 'Pending', // Frontend doesn't have In Progress, map to Pending
    'DONE': 'Completed',
    'CANCELLED': 'Cancelled',
  };

  const linkedEntityTypeMap: Record<string, TaskRelatedTo> = {
    'CANDIDATE': 'Candidate',
    'JOB': 'Job',
    'CLIENT': 'Client',
    'INTERVIEW': 'Interview',
    'INTERNAL': 'Internal',
  };

  // Determine status - if overdue and not completed, mark as Overdue
  let status: TaskStatus = statusMap[backendTask.status] || 'Pending';
  if (backendTask.isOverdue && status !== 'Completed') {
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
      name: relatedToName,
      type: backendTask.linkedEntityType ? linkedEntityTypeMap[backendTask.linkedEntityType] : 'Internal',
    },
    dueDate,
    time: backendTask.dueTime || '',
    priority: priorityMap[backendTask.priority] || 'Medium',
    status,
    owner: {
      name: backendTask.assignedTo.name,
      avatar: '', // Backend doesn't return avatar, would need to fetch separately
    },
  };
}

/**
 * Transform backend task to TaskForDrawer format
 */
export function transformBackendTaskToDrawer(backendTask: BackendTask): TaskForDrawer {
  const priorityMap: Record<string, TaskPriority> = {
    'LOW': 'Low',
    'MEDIUM': 'Medium',
    'HIGH': 'High',
  };

  const statusMap: Record<string, TaskStatus> = {
    'TODO': 'Pending',
    'IN_PROGRESS': 'Pending',
    'DONE': 'Completed',
    'CANCELLED': 'Cancelled',
  };

  const linkedEntityTypeMap: Record<string, TaskRelatedTo> = {
    'CANDIDATE': 'Candidate',
    'JOB': 'Job',
    'CLIENT': 'Client',
    'INTERVIEW': 'Interview',
    'INTERNAL': 'Internal',
  };

  let status: TaskStatus = statusMap[backendTask.status] || 'Pending';
  if (backendTask.isOverdue && status !== 'Completed') {
    status = 'Overdue';
  }

  const dueDate = new Date(backendTask.dueDate).toISOString().split('T')[0];

  return {
    id: backendTask.id,
    title: backendTask.title,
    type: (backendTask.taskType as TaskType) || 'Note',
    relatedTo: {
      id: backendTask.linkedEntityId || '',
      name: backendTask.linkedEntityId || 'Unknown',
      type: backendTask.linkedEntityType ? linkedEntityTypeMap[backendTask.linkedEntityType] : 'Internal',
    },
    dueDate,
    time: backendTask.dueTime || '',
    priority: priorityMap[backendTask.priority] || 'Medium',
    status,
    owner: {
      name: backendTask.assignedTo.name,
      avatar: backendTask.assignedTo.avatar || '',
    },
    assignedToId: backendTask.assignedToId || backendTask.assignedTo?.id, // Store assignee ID
    backendStatus: backendTask.status, // Store original backend status for edit form mapping
    description: backendTask.description || undefined,
    reminder: backendTask.reminder || undefined,
    lastUpdated: {
      by: backendTask.createdBy.name,
      at: new Date(backendTask.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    },
    createdBy: {
      name: backendTask.createdBy.name,
      at: new Date(backendTask.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
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
                const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000/api/v1';
                const baseUrl = apiUrl.replace(/\/api\/v1$/, '') || 'http://localhost:5000';
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
  };
}
