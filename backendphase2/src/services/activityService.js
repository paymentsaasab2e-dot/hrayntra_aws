import { prisma } from '../config/prisma.js';

/**
 * Universal Activity Service
 * A single, reusable service for logging activities across all modules
 * Can be used for Clients, Jobs, Candidates, Leads, Interviews, Placements, etc.
 */

/**
 * Activity Categories - Standard categories for filtering
 */
export const ACTIVITY_CATEGORIES = {
  GENERAL: 'General',
  JOBS: 'Jobs',
  CANDIDATES: 'Candidates',
  INTERVIEWS: 'Interviews',
  BILLING: 'Billing',
  NOTES: 'Notes',
  FILES: 'Files',
  CONTACTS: 'Contacts',
  PLACEMENTS: 'Placements',
  TEAM: 'Team',
  SYSTEM: 'System',
};

/**
 * Entity Types - Supported entity types
 */
export const ENTITY_TYPES = {
  CLIENT: 'CLIENT',
  JOB: 'JOB',
  CANDIDATE: 'CANDIDATE',
  LEAD: 'LEAD',
  INTERVIEW: 'INTERVIEW',
  PLACEMENT: 'PLACEMENT',
  CONTACT: 'CONTACT',
  USER: 'USER',
  TASK: 'TASK',
  NOTE: 'NOTE',
  FILE: 'FILE',
};

/**
 * Log an activity for any entity
 * @param {Object} params
 * @param {string} params.entityType - Entity type (CLIENT, JOB, CANDIDATE, etc.)
 * @param {string} params.entityId - ID of the entity
 * @param {string} params.performedById - User ID who performed the action
 * @param {string} params.action - Action title (e.g., "Client Updated", "Job Created")
 * @param {string} [params.description] - Detailed description
 * @param {string} [params.category] - Category for filtering (default: 'General')
 * @param {string} [params.relatedType] - Related entity type (job, candidate, invoice, etc.)
 * @param {string} [params.relatedLabel] - Display label for related entity
 * @param {string} [params.relatedId] - ID of related entity
 * @param {Object} [params.metadata] - Additional metadata
 * @param {string} [params.clientId] - Optional client ID for client-related activities
 * @returns {Promise<Activity>}
 */
export async function logActivity({
  entityType,
  entityId,
  performedById,
  action,
  description,
  category = ACTIVITY_CATEGORIES.GENERAL,
  relatedType,
  relatedLabel,
  relatedId,
  metadata = {},
  clientId,
}) {
  try {
    const activityData = {
      action,
      description,
      performedById,
      entityType,
      entityId,
      category,
      relatedType,
      relatedLabel,
      relatedId,
      metadata,
    };

    // Add clientId if provided (for client-related activities)
    if (clientId) {
      activityData.clientId = clientId;
    }

    const activity = await prisma.activity.create({
      data: activityData,
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

    // Update lastActivity timestamp for the entity if it's a client
    if (entityType === ENTITY_TYPES.CLIENT && entityId) {
      try {
        await prisma.client.update({
          where: { id: entityId },
          data: { lastActivity: new Date() },
        });
      } catch (err) {
        // Ignore if client doesn't exist or update fails
        console.warn('Failed to update client lastActivity:', err);
      }
    }

    return activity;
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging is non-critical
    return null;
  }
}

/**
 * Log field changes for any entity
 * @param {Object} params
 * @param {string} params.entityType - Entity type
 * @param {string} params.entityId - Entity ID
 * @param {string} params.performedById - User ID
 * @param {Object} params.oldData - Previous entity data
 * @param {Object} params.newData - Updated entity data
 * @param {Array<string>} [params.trackedFields] - Fields to track (if not provided, tracks all changes)
 * @param {Function} [params.fieldLabelMapper] - Optional function to map field names to labels
 * @param {Function} [params.valueFormatter] - Optional function to format values for display
 * @param {string} [params.clientId] - Optional client ID
 */
export async function logFieldChanges({
  entityType,
  entityId,
  performedById,
  oldData,
  newData,
  trackedFields,
  fieldLabelMapper,
  valueFormatter,
  clientId,
}) {
  const changes = [];
  const fieldsToTrack = trackedFields || Object.keys(newData);

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

  // Determine category based on entity type
  const categoryMap = {
    [ENTITY_TYPES.CLIENT]: ACTIVITY_CATEGORIES.GENERAL,
    [ENTITY_TYPES.JOB]: ACTIVITY_CATEGORIES.JOBS,
    [ENTITY_TYPES.CANDIDATE]: ACTIVITY_CATEGORIES.CANDIDATES,
    [ENTITY_TYPES.LEAD]: ACTIVITY_CATEGORIES.GENERAL,
    [ENTITY_TYPES.INTERVIEW]: ACTIVITY_CATEGORIES.INTERVIEWS,
    [ENTITY_TYPES.PLACEMENT]: ACTIVITY_CATEGORIES.PLACEMENTS,
    [ENTITY_TYPES.CONTACT]: ACTIVITY_CATEGORIES.CONTACTS,
  };

  const category = categoryMap[entityType] || ACTIVITY_CATEGORIES.GENERAL;

  // Log each change
  for (const change of changes) {
    const fieldLabel = fieldLabelMapper
      ? fieldLabelMapper(change.field)
      : change.field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    const formattedOldValue = valueFormatter
      ? valueFormatter(change.field, change.oldValue)
      : change.oldValue;
    const formattedNewValue = valueFormatter
      ? valueFormatter(change.field, change.newValue)
      : change.newValue;

    let action = 'Field Updated';
    let description = `${fieldLabel} changed from "${formattedOldValue || 'N/A'}" to "${formattedNewValue || 'N/A'}"`;

    // Special handling for common fields
    if (change.field === 'status') {
      action = 'Status Changed';
    } else if (change.field === 'assignedToId' || change.field === 'assignedTo') {
      action = 'Assignment Changed';
      // Try to fetch user names
      try {
        let oldUserName = 'Unassigned';
        let newUserName = 'Unassigned';

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

        description = `Assigned to changed from "${oldUserName}" to "${newUserName}"`;
      } catch (err) {
        console.error('Failed to fetch user names for activity log:', err);
      }
    } else if (change.field === 'companyName' || change.field === 'name') {
      action = entityType === ENTITY_TYPES.CLIENT ? 'Company Name Updated' : 'Name Updated';
    }

    await logActivity({
      entityType,
      entityId,
      performedById,
      action,
      description,
      category,
      metadata: {
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      },
      clientId,
    });
  }
}

/**
 * Log entity creation
 * @param {Object} params
 * @param {string} params.entityType - Entity type
 * @param {string} params.entityId - Entity ID
 * @param {string} params.performedById - User ID
 * @param {string} params.entityName - Name/title of the entity
 * @param {Object} [params.metadata] - Additional metadata
 * @param {string} [params.clientId] - Optional client ID
 */
export async function logEntityCreated({
  entityType,
  entityId,
  performedById,
  entityName,
  metadata = {},
  clientId,
}) {
  const actionMap = {
    [ENTITY_TYPES.CLIENT]: 'Client Created',
    [ENTITY_TYPES.JOB]: 'Job Created',
    [ENTITY_TYPES.CANDIDATE]: 'Candidate Created',
    [ENTITY_TYPES.LEAD]: 'Lead Created',
    [ENTITY_TYPES.INTERVIEW]: 'Interview Created',
    [ENTITY_TYPES.PLACEMENT]: 'Placement Created',
    [ENTITY_TYPES.CONTACT]: 'Contact Created',
  };

  const action = actionMap[entityType] || 'Entity Created';
  const description = `${action.replace(' Created', '')} "${entityName}" was created`;

  return logActivity({
    entityType,
    entityId,
    performedById,
    action,
    description,
    category: ACTIVITY_CATEGORIES.GENERAL,
    metadata: {
      entityName,
      ...metadata,
    },
    clientId,
  });
}

/**
 * Log entity deletion
 * @param {Object} params
 * @param {string} params.entityType - Entity type
 * @param {string} params.entityId - Entity ID
 * @param {string} params.performedById - User ID
 * @param {string} params.entityName - Name/title of the entity
 * @param {string} [params.clientId] - Optional client ID
 */
export async function logEntityDeleted({
  entityType,
  entityId,
  performedById,
  entityName,
  clientId,
}) {
  const actionMap = {
    [ENTITY_TYPES.CLIENT]: 'Client Deleted',
    [ENTITY_TYPES.JOB]: 'Job Deleted',
    [ENTITY_TYPES.CANDIDATE]: 'Candidate Deleted',
    [ENTITY_TYPES.LEAD]: 'Lead Deleted',
    [ENTITY_TYPES.INTERVIEW]: 'Interview Deleted',
    [ENTITY_TYPES.PLACEMENT]: 'Placement Deleted',
    [ENTITY_TYPES.CONTACT]: 'Contact Deleted',
  };

  const action = actionMap[entityType] || 'Entity Deleted';
  const description = `${action.replace(' Deleted', '')} "${entityName}" was deleted`;

  return logActivity({
    entityType,
    entityId,
    performedById,
    action,
    description,
    category: ACTIVITY_CATEGORIES.GENERAL,
    metadata: {
      entityName,
    },
    clientId,
  });
}

/**
 * Get activities for an entity
 * @param {Object} params
 * @param {string} params.entityType - Entity type
 * @param {string} params.entityId - Entity ID
 * @param {number} [params.limit] - Maximum number of activities to return (default: 100)
 * @param {string} [params.category] - Filter by category
 * @returns {Promise<Activity[]>}
 */
export async function getEntityActivities({
  entityType,
  entityId,
  limit = 100,
  category,
}) {
  const where = {
    entityType,
    entityId,
  };

  if (category) {
    where.category = category;
  }

  const activities = await prisma.activity.findMany({
    where,
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
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return activities;
}

/**
 * Get activities for a client (includes all client-related activities)
 * @param {Object} params
 * @param {string} params.clientId - Client ID
 * @param {number} [params.limit] - Maximum number of activities (default: 100)
 * @param {string} [params.category] - Filter by category
 * @returns {Promise<Activity[]>}
 */
export async function getClientActivities({ clientId, limit = 100, category }) {
  const where = {
    OR: [
      { entityType: ENTITY_TYPES.CLIENT, entityId: clientId },
      { clientId },
    ],
  };

  if (category) {
    where.category = category;
  }

  const activities = await prisma.activity.findMany({
    where,
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
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return activities;
}

/**
 * Convenience functions for specific entity types
 */
export const activityService = {
  // Client activities
  logClientActivity: (params) => logActivity({ ...params, entityType: ENTITY_TYPES.CLIENT }),
  logClientFieldChanges: (params) => logFieldChanges({ ...params, entityType: ENTITY_TYPES.CLIENT }),
  logClientCreated: (params) => logEntityCreated({ ...params, entityType: ENTITY_TYPES.CLIENT }),
  logClientDeleted: (params) => logEntityDeleted({ ...params, entityType: ENTITY_TYPES.CLIENT }),
  getClientActivities,

  // Job activities
  logJobActivity: (params) => logActivity({ ...params, entityType: ENTITY_TYPES.JOB, category: ACTIVITY_CATEGORIES.JOBS }),
  logJobFieldChanges: (params) => logFieldChanges({ ...params, entityType: ENTITY_TYPES.JOB }),
  logJobCreated: (params) => logEntityCreated({ ...params, entityType: ENTITY_TYPES.JOB, category: ACTIVITY_CATEGORIES.JOBS }),
  logJobDeleted: (params) => logEntityDeleted({ ...params, entityType: ENTITY_TYPES.JOB }),

  // Candidate activities
  logCandidateActivity: (params) => logActivity({ ...params, entityType: ENTITY_TYPES.CANDIDATE, category: ACTIVITY_CATEGORIES.CANDIDATES }),
  logCandidateFieldChanges: (params) => logFieldChanges({ ...params, entityType: ENTITY_TYPES.CANDIDATE }),
  logCandidateCreated: (params) => logEntityCreated({ ...params, entityType: ENTITY_TYPES.CANDIDATE, category: ACTIVITY_CATEGORIES.CANDIDATES }),
  logCandidateDeleted: (params) => logEntityDeleted({ ...params, entityType: ENTITY_TYPES.CANDIDATE }),

  // Lead activities
  logLeadActivity: (params) => logActivity({ ...params, entityType: ENTITY_TYPES.LEAD }),
  logLeadFieldChanges: (params) => logFieldChanges({ ...params, entityType: ENTITY_TYPES.LEAD }),
  logLeadCreated: (params) => logEntityCreated({ ...params, entityType: ENTITY_TYPES.LEAD }),
  logLeadDeleted: (params) => logEntityDeleted({ ...params, entityType: ENTITY_TYPES.LEAD }),

  // Interview activities
  logInterviewActivity: (params) => logActivity({ ...params, entityType: ENTITY_TYPES.INTERVIEW, category: ACTIVITY_CATEGORIES.INTERVIEWS }),
  logInterviewCreated: (params) => logEntityCreated({ ...params, entityType: ENTITY_TYPES.INTERVIEW, category: ACTIVITY_CATEGORIES.INTERVIEWS }),

  // Placement activities
  logPlacementActivity: (params) => logActivity({ ...params, entityType: ENTITY_TYPES.PLACEMENT, category: ACTIVITY_CATEGORIES.PLACEMENTS }),
  logPlacementCreated: (params) => logEntityCreated({ ...params, entityType: ENTITY_TYPES.PLACEMENT, category: ACTIVITY_CATEGORIES.PLACEMENTS }),

  // Contact activities
  logContactActivity: (params) => logActivity({ ...params, entityType: ENTITY_TYPES.CONTACT, category: ACTIVITY_CATEGORIES.CONTACTS }),
  logContactCreated: (params) => logEntityCreated({ ...params, entityType: ENTITY_TYPES.CONTACT, category: ACTIVITY_CATEGORIES.CONTACTS }),

  // Generic functions
  logActivity,
  logFieldChanges,
  logEntityCreated,
  logEntityDeleted,
  getEntityActivities,
};

export default activityService;
