# Activity Service Usage Guide

This document explains how to use the unified `activityService` across different modules.

## Import

```javascript
import activityService from '../services/activityService.js';
// or
import { logActivity, logFieldChanges, ENTITY_TYPES, ACTIVITY_CATEGORIES } from '../services/activityService.js';
```

## Basic Usage

### 1. Log a Simple Activity

```javascript
await activityService.logActivity({
  entityType: 'CLIENT',
  entityId: clientId,
  performedById: userId,
  action: 'Client Viewed',
  description: 'Client profile was viewed',
  category: 'General',
});
```

### 2. Log Entity Creation

```javascript
await activityService.logClientCreated({
  entityId: client.id,
  performedById: userId,
  entityName: client.companyName,
  metadata: {
    industry: client.industry,
    status: client.status,
  },
  clientId: client.id,
});
```

### 3. Log Field Changes

```javascript
await activityService.logClientFieldChanges({
  entityId: clientId,
  performedById: userId,
  oldData: currentClient,
  newData: updateData,
  clientId: clientId,
});
```

### 4. Log Entity Deletion

```javascript
await activityService.logClientDeleted({
  entityId: clientId,
  performedById: userId,
  entityName: client.companyName,
  clientId: clientId,
});
```

## Usage in Different Modules

### Client Module

```javascript
// In client.service.js
import activityService from '../../services/activityService.js';

// Log client creation
await activityService.logClientCreated({
  entityId: client.id,
  performedById: data.performedById,
  entityName: client.companyName,
  clientId: client.id,
});

// Log field changes
await activityService.logClientFieldChanges({
  entityId: id,
  performedById: data.performedById,
  oldData: currentClient,
  newData: updateData,
  clientId: id,
});
```

### Job Module

```javascript
// In job.service.js
import activityService from '../../services/activityService.js';

// Log job creation
await activityService.logJobCreated({
  entityId: job.id,
  performedById: userId,
  entityName: job.title,
  metadata: { clientId: job.clientId },
  clientId: job.clientId, // Link to client for client activity timeline
});

// Log job field changes
await activityService.logJobFieldChanges({
  entityId: jobId,
  performedById: userId,
  oldData: currentJob,
  newData: updateData,
  clientId: job.clientId,
});
```

### Candidate Module

```javascript
// In candidate.service.js
import activityService from '../../services/activityService.js';

// Log candidate creation
await activityService.logCandidateCreated({
  entityId: candidate.id,
  performedById: userId,
  entityName: `${candidate.firstName} ${candidate.lastName}`,
});

// Log candidate status change
await activityService.logCandidateActivity({
  entityId: candidateId,
  performedById: userId,
  action: 'Status Changed',
  description: `Status changed from "${oldStatus}" to "${newStatus}"`,
  category: 'Candidates',
});
```

### Lead Module

```javascript
// In lead.service.js
import activityService from '../../services/activityService.js';

// Log lead conversion
await activityService.logLeadActivity({
  entityId: leadId,
  performedById: userId,
  action: 'Lead Converted',
  description: `Lead "${lead.companyName}" was converted to client`,
  relatedType: 'client',
  relatedId: clientId,
  relatedLabel: client.companyName,
});
```

### Interview Module

```javascript
// In interview.service.js
import activityService from '../../services/activityService.js';

// Log interview scheduled
await activityService.logInterviewActivity({
  entityId: interviewId,
  performedById: userId,
  action: 'Interview Scheduled',
  description: `Interview scheduled for ${interviewDate}`,
  category: 'Interviews',
  relatedType: 'candidate',
  relatedId: candidateId,
  relatedLabel: candidateName,
  clientId: job.clientId, // Link to client
});
```

## Advanced Usage

### Custom Field Change Tracking

```javascript
await activityService.logFieldChanges({
  entityType: 'CLIENT',
  entityId: clientId,
  performedById: userId,
  oldData: oldClient,
  newData: newClient,
  trackedFields: ['companyName', 'industry', 'status', 'assignedToId'],
  fieldLabelMapper: (field) => {
    const labels = {
      companyName: 'Company Name',
      assignedToId: 'Assigned To',
    };
    return labels[field] || field;
  },
  valueFormatter: (field, value) => {
    if (field === 'status') {
      const statusMap = { 'ACTIVE': 'Active', 'PROSPECT': 'Prospect' };
      return statusMap[value] || value;
    }
    return value;
  },
  clientId: clientId,
});
```

### Get Activities

```javascript
// Get all activities for a client
const activities = await activityService.getClientActivities({
  clientId: clientId,
  limit: 100,
  category: 'Jobs', // Optional filter
});

// Get activities for any entity
const activities = await activityService.getEntityActivities({
  entityType: 'JOB',
  entityId: jobId,
  limit: 50,
  category: 'General',
});
```

## Entity Types

Available entity types (from `ENTITY_TYPES`):
- `CLIENT`
- `JOB`
- `CANDIDATE`
- `LEAD`
- `INTERVIEW`
- `PLACEMENT`
- `CONTACT`
- `USER`
- `TASK`
- `NOTE`
- `FILE`

## Activity Categories

Available categories (from `ACTIVITY_CATEGORIES`):
- `General`
- `Jobs`
- `Candidates`
- `Interviews`
- `Billing`
- `Notes`
- `Files`
- `Contacts`
- `Placements`
- `Team`
- `System`

## Convenience Functions

The service provides convenience functions for common entity types:

- `logClientActivity()`, `logClientFieldChanges()`, `logClientCreated()`, `logClientDeleted()`
- `logJobActivity()`, `logJobFieldChanges()`, `logJobCreated()`, `logJobDeleted()`
- `logCandidateActivity()`, `logCandidateFieldChanges()`, `logCandidateCreated()`, `logCandidateDeleted()`
- `logLeadActivity()`, `logLeadFieldChanges()`, `logLeadCreated()`, `logLeadDeleted()`
- `logInterviewActivity()`, `logInterviewCreated()`
- `logPlacementActivity()`, `logPlacementCreated()`
- `logContactActivity()`, `logContactCreated()`

## Best Practices

1. **Always pass `performedById`**: This ensures activities are attributed to the correct user
2. **Use `clientId` when available**: This links activities to clients for the client activity timeline
3. **Provide meaningful descriptions**: Help users understand what changed
4. **Use appropriate categories**: Makes filtering easier in the UI
5. **Log non-critical activities**: Activity logging should not block main operations (errors are caught and logged)

## Example: Complete Client Update Flow

```javascript
async update(id, data) {
  // Get current data
  const currentClient = await prisma.client.findUnique({ where: { id } });
  
  // Perform update
  const updated = await prisma.client.update({
    where: { id },
    data: updateData,
  });
  
  // Log activities (non-blocking)
  if (data.performedById) {
    await activityService.logClientFieldChanges({
      entityId: id,
      performedById: data.performedById,
      oldData: currentClient,
      newData: updateData,
      clientId: id,
    });
  }
  
  return updated;
}
```
