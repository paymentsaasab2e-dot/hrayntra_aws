import { prisma } from '../config/prisma.js';

/**
 * Client Activity Logger Utility
 * Logs all changes and activities related to clients
 * Can be reused across multiple modules/tabs
 */

export const CLIENT_ACTIVITY_CATEGORIES = {
  GENERAL: 'General',
  JOBS: 'Jobs',
  CANDIDATES: 'Candidates',
  INTERVIEWS: 'Interviews',
  BILLING: 'Billing',
  NOTES: 'Notes',
  FILES: 'Files',
  CONTACTS: 'Contacts',
};

/**
 * Log a client activity
 * @param {Object} params
 * @param {string} params.clientId - Client ID
 * @param {string} params.performedById - User ID who performed the action
 * @param {string} params.action - Action title (e.g., "Client Updated", "Stage Changed")
 * @param {string} [params.description] - Detailed description
 * @param {string} [params.category] - Category for filtering (default: 'General')
 * @param {string} [params.relatedType] - Related entity type (job, candidate, invoice, etc.)
 * @param {string} [params.relatedLabel] - Display label for related entity
 * @param {string} [params.relatedId] - ID of related entity
 * @param {Object} [params.metadata] - Additional metadata
 * @returns {Promise<Activity>}
 */
export async function logClientActivity({
  clientId,
  performedById,
  action,
  description,
  category = CLIENT_ACTIVITY_CATEGORIES.GENERAL,
  relatedType,
  relatedLabel,
  relatedId,
  metadata = {},
}) {
  try {
    const activity = await prisma.activity.create({
      data: {
        action,
        description,
        performedById,
        entityType: 'CLIENT',
        entityId: clientId,
        clientId,
        category,
        relatedType,
        relatedLabel,
        relatedId,
        metadata,
      },
      include: {
        performedBy: {
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

    // Update client's lastActivity timestamp
    await prisma.client.update({
      where: { id: clientId },
      data: { lastActivity: new Date() },
    });

    return activity;
  } catch (error) {
    console.error('Failed to log client activity:', error);
    // Don't throw - activity logging is non-critical
    return null;
  }
}

/**
 * Log client field changes
 * @param {Object} params
 * @param {string} params.clientId - Client ID
 * @param {string} params.performedById - User ID
 * @param {Object} params.oldData - Previous client data
 * @param {Object} params.newData - Updated client data
 * @param {Array<string>} [params.trackedFields] - Fields to track (if not provided, tracks all changes)
 */
export async function logClientFieldChanges({
  clientId,
  performedById,
  oldData,
  newData,
  trackedFields,
}) {
  const changes = [];
  const fieldsToTrack = trackedFields || [
    'companyName',
    'industry',
    'companySize',
    'website',
    'linkedin',
    'location',
    'timezone',
    'status',
    'assignedToId',
    'priority',
    'sla',
    'clientSince',
    'nextFollowUpDue',
  ];

  for (const field of fieldsToTrack) {
    const oldValue = oldData[field];
    const newValue = newData[field];

    if (oldValue !== newValue && (oldValue !== undefined || newValue !== undefined)) {
      changes.push({
        field,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
      });
    }
  }

  if (changes.length === 0) {
    return; // No changes detected
  }

  // Group changes by category
  const fieldCategories = {
    companyName: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    industry: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    companySize: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    website: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    linkedin: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    location: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    timezone: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    status: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    assignedToId: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    priority: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    sla: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    clientSince: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    nextFollowUpDue: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
  };

  // Log each change
  for (const change of changes) {
    const category = fieldCategories[change.field] || CLIENT_ACTIVITY_CATEGORIES.GENERAL;
    
    let action = 'Field Updated';
    let description = `${change.field} changed`;

    // Special handling for specific fields
    if (change.field === 'status') {
      action = 'Stage Changed';
      const statusMap = {
        'ACTIVE': 'Active',
        'PROSPECT': 'Prospect',
        'ON_HOLD': 'On Hold',
        'INACTIVE': 'Inactive',
      };
      description = `Stage changed from "${statusMap[change.oldValue] || change.oldValue}" to "${statusMap[change.newValue] || change.newValue}"`;
    } else if (change.field === 'assignedToId') {
      action = 'Assignment Changed';
      // Fetch user names if possible
      let oldUserName = change.oldValue ? 'Unassigned' : null;
      let newUserName = change.newValue ? 'Assigned' : 'Unassigned';
      
      try {
        if (change.oldValue) {
          const oldUser = await prisma.user.findUnique({
            where: { id: change.oldValue },
            select: { firstName: true, lastName: true },
          });
          if (oldUser) {
            oldUserName = `${oldUser.firstName || ''} ${oldUser.lastName || ''}`.trim();
          }
        }
        if (change.newValue) {
          const newUser = await prisma.user.findUnique({
            where: { id: change.newValue },
            select: { firstName: true, lastName: true },
          });
          if (newUser) {
            newUserName = `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim();
          }
        }
      } catch (err) {
        console.error('Failed to fetch user names for activity log:', err);
      }
      
      description = `Assigned to changed from "${oldUserName || 'Unassigned'}" to "${newUserName || 'Unassigned'}"`;
    } else if (change.field === 'companyName') {
      action = 'Company Name Updated';
      description = `Company name changed from "${change.oldValue || 'N/A'}" to "${change.newValue || 'N/A'}"`;
    } else {
      // Generic field change
      const fieldLabel = change.field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      description = `${fieldLabel} changed from "${change.oldValue || 'N/A'}" to "${change.newValue || 'N/A'}"`;
    }

    await logClientActivity({
      clientId,
      performedById,
      action,
      description,
      category,
      metadata: {
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      },
    });
  }
}

/**
 * Log client creation
 */
export async function logClientCreated({ clientId, performedById, clientData }) {
  return logClientActivity({
    clientId,
    performedById,
    action: 'Client Created',
    description: `New client "${clientData.companyName}" was created`,
    category: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    metadata: {
      companyName: clientData.companyName,
      industry: clientData.industry,
      status: clientData.status,
    },
  });
}

/**
 * Log client deletion
 */
export async function logClientDeleted({ clientId, performedById, clientName }) {
  return logClientActivity({
    clientId,
    performedById,
    action: 'Client Deleted',
    description: `Client "${clientName}" was deleted`,
    category: CLIENT_ACTIVITY_CATEGORIES.GENERAL,
    metadata: {
      clientName,
    },
  });
}

/**
 * Log job-related activities
 */
export async function logClientJobActivity({ clientId, performedById, action, jobTitle, jobId }) {
  return logClientActivity({
    clientId,
    performedById,
    action,
    description: `${action} for job "${jobTitle}"`,
    category: CLIENT_ACTIVITY_CATEGORIES.JOBS,
    relatedType: 'job',
    relatedLabel: jobTitle,
    relatedId: jobId,
  });
}

/**
 * Log contact-related activities
 */
export async function logClientContactActivity({ clientId, performedById, action, contactName, contactId }) {
  return logClientActivity({
    clientId,
    performedById,
    action,
    description: `${action} for contact "${contactName}"`,
    category: CLIENT_ACTIVITY_CATEGORIES.CONTACTS,
    relatedType: 'contact',
    relatedLabel: contactName,
    relatedId: contactId,
  });
}

/**
 * Log note-related activities
 */
export async function logClientNoteActivity({ clientId, performedById, action, noteTitle, noteId }) {
  return logClientActivity({
    clientId,
    performedById,
    action,
    description: `${action}: "${noteTitle}"`,
    category: CLIENT_ACTIVITY_CATEGORIES.NOTES,
    relatedType: 'note',
    relatedLabel: noteTitle,
    relatedId: noteId,
  });
}

/**
 * Log file-related activities
 */
export async function logClientFileActivity({ clientId, performedById, action, fileName, fileId }) {
  return logClientActivity({
    clientId,
    performedById,
    action,
    description: `${action}: "${fileName}"`,
    category: CLIENT_ACTIVITY_CATEGORIES.FILES,
    relatedType: 'file',
    relatedLabel: fileName,
    relatedId: fileId,
  });
}
