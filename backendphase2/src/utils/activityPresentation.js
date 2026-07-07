const SKIP_ACTIVITY_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'deletedBy',
  'isDeleted',
  'passwordHash',
  'hashedPassword',
  'metadata',
  'rawConfig',
  'searchVector',
  'embedding',
]);

const SUMMARY_ONLY_FIELDS = new Set([
  'extraData',
  'applicationFormSchema',
  'applicationFormQuestions',
  'publicFieldVisibility',
  'formSchema',
  'customFields',
  'portalSnapshot',
  'phase1Snapshot',
  'cvParsedData',
]);

const FIELD_LABELS = {
  extraData: 'Additional data',
  applicationFormSchema: 'Application form',
  applicationFormQuestions: 'Application questions',
  publicFieldVisibility: 'Public job page fields',
  expectedClosureDate: 'Expected closure date',
  companyName: 'Company name',
  assignedToId: 'Assigned to',
  assignedTo: 'Assigned to',
  keyResponsibilities: 'Key responsibilities',
  candidateRequirements: 'Candidate requirements',
  benefits: 'Benefits',
  requirements: 'Requirements',
  skills: 'Skills',
  languages: 'Languages',
  city: 'City',
  state: 'State',
  country: 'Country',
  status: 'Status',
  title: 'Title',
  description: 'Description',
  salaryMin: 'Minimum salary',
  salaryMax: 'Maximum salary',
  workMode: 'Work mode',
  employmentType: 'Employment type',
};

function stableStringify(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'object') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${key}:${stableStringify(value[key])}`).join(',')}}`;
}

export function shouldSkipActivityField(field) {
  return SKIP_ACTIVITY_FIELDS.has(String(field || '').trim());
}

export function isSummaryOnlyActivityField(field) {
  return SUMMARY_ONLY_FIELDS.has(String(field || '').trim());
}

export function formatActivityFieldLabel(field) {
  const key = String(field || '').trim();
  if (!key) return 'Field';
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/Id$/i, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function parseMaybeDate(value) {
  if (value instanceof Date) return value;
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(value) {
  const date = parseMaybeDate(value);
  if (!date) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function summarizeComplexValue(field, value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) {
    const items = value
      .map((item) => {
        if (item && typeof item === 'object') {
          return String(item.label || item.name || item.title || item.question || '').trim();
        }
        return String(item ?? '').trim();
      })
      .filter(Boolean);
    if (items.length === 0) return null;
    if (items.length <= 3) return items.join(', ');
    return `${items.length} items`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined && value[key] !== null && value[key] !== '');
    if (keys.length === 0) return null;
    if (isSummaryOnlyActivityField(field)) return null;
    if (keys.length <= 3) {
      return keys
        .map((key) => {
          const nested = value[key];
          if (nested && typeof nested === 'object') return key;
          return `${key}: ${String(nested)}`;
        })
        .join(', ');
    }
    return `${keys.length} settings`;
  }
  return null;
}

export function formatActivityFieldValue(field, value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  const dateLabel = formatDateValue(value);
  if (dateLabel && /date|At|Since|Due|closure/i.test(String(field || ''))) {
    return dateLabel;
  }

  if (Array.isArray(value)) {
    const text = value
      .map((item) => (item && typeof item === 'object' ? summarizeComplexValue(field, [item]) : String(item ?? '').trim()))
      .filter(Boolean)
      .join(', ');
    return text || null;
  }

  if (typeof value === 'object') {
    if (isSummaryOnlyActivityField(field)) return null;
    const summary = summarizeComplexValue(field, value);
    return summary;
  }

  const text = String(value).trim();
  if (!text) return null;
  if (text === '[object Object]') return null;

  const parsedDate = formatDateValue(text);
  if (parsedDate && /date|At|Since|Due|closure|T\d{2}:/i.test(text)) {
    return parsedDate;
  }

  if (text.length > 120) return `${text.slice(0, 117)}…`;
  return text;
}

export function valuesAreSemanticallyEqual(field, oldValue, newValue) {
  const oldDate = formatDateValue(oldValue);
  const newDate = formatDateValue(newValue);
  if (oldDate && newDate && oldDate === newDate) return true;

  const oldNorm = stableStringify(oldValue ?? null);
  const newNorm = stableStringify(newValue ?? null);
  if (oldNorm === newNorm) return true;

  const oldDisplay = formatActivityFieldValue(field, oldValue);
  const newDisplay = formatActivityFieldValue(field, newValue);
  if (oldDisplay === newDisplay) return true;

  const oldEmpty = oldDisplay == null || oldDisplay === '';
  const newEmpty = newDisplay == null || newDisplay === '';
  return oldEmpty && newEmpty;
}

export function buildActivityFieldChangeCopy({ field, oldValue, newValue }) {
  const label = formatActivityFieldLabel(field);

  if (isSummaryOnlyActivityField(field)) {
    return {
      action: `${label} updated`,
      description: `${label} was updated.`,
    };
  }

  const oldDisplay = formatActivityFieldValue(field, oldValue);
  const newDisplay = formatActivityFieldValue(field, newValue);

  if (oldDisplay == null && newDisplay == null) {
    return null;
  }

  if (field === 'status') {
    return {
      action: 'Status changed',
      description:
        oldDisplay && newDisplay
          ? `Status changed from "${oldDisplay}" to "${newDisplay}".`
          : newDisplay
            ? `Status set to "${newDisplay}".`
            : `Status cleared.`,
    };
  }

  if (field === 'assignedToId' || field === 'assignedTo') {
    return {
      action: 'Assignment changed',
      description:
        oldDisplay && newDisplay
          ? `Assignee changed from "${oldDisplay}" to "${newDisplay}".`
          : newDisplay
            ? `Assigned to "${newDisplay}".`
            : 'Assignee removed.',
    };
  }

  if (!oldDisplay && newDisplay) {
    return {
      action: `${label} updated`,
      description: `${label} set to "${newDisplay}".`,
    };
  }

  if (oldDisplay && !newDisplay) {
    return {
      action: `${label} updated`,
      description: `${label} cleared (was "${oldDisplay}").`,
    };
  }

  if (oldDisplay === newDisplay) {
    return null;
  }

  return {
    action: `${label} updated`,
    description: `${label} changed from "${oldDisplay}" to "${newDisplay}".`,
  };
}

function cleanupLegacyDescription(text) {
  let output = String(text || '').trim();
  if (!output) return '';

  output = output
    .replace(/"\[object Object\]"/g, '"structured data"')
    .replace(/\[object Object\]/g, 'structured data')
    .replace(/\s+changed from "N\/A" to ""/g, ' was cleared')
    .replace(/\s+changed from "" to ""/g, ' was updated')
    .replace(/changed from "([^"]+)" to "\1"/g, 'updated ($1 unchanged)');

  output = output.replace(
    /changed from "([^"]*(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)[^"]*)" to "([^"]*(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)[^"]*)"/g,
    (_match, oldPart, newPart) => {
      const oldDate = formatDateValue(oldPart);
      const newDate = formatDateValue(newPart);
      if (oldDate && newDate) {
        return oldDate === newDate
          ? `date remains ${oldDate}`
          : `date changed from ${oldDate} to ${newDate}`;
      }
      return `date updated`;
    }
  );

  if (!/[.!?]$/.test(output)) output += '.';
  return output;
}

function quoteLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return `“${text}”`;
}

export function classifyActivityKind(activity) {
  const action = String(activity?.action || '').toLowerCase();
  if (/created|added|applied|sent|scheduled|converted|approved|restored|tag added|candidate added|joined|completed/i.test(action)) {
    return 'create';
  }
  if (/deleted|removed|rejected|cancelled|recycle|soft-deleted|moved to recycle bin|no show/i.test(action)) {
    return 'delete';
  }
  if (/moved|pipeline|assigned|delegated|changed|updated|field|status|role|rescheduled|note added|tag removed/i.test(action)) {
    return 'update';
  }
  return 'info';
}

export function buildActivityDisplaySummary(activity) {
  const action = String(activity?.action || '').trim();
  const desc = cleanupLegacyDescription(activity?.description || '');
  const relatedLabel = String(activity?.relatedLabel || '').trim();
  const metadata =
    activity?.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata)
      ? activity.metadata
      : null;
  const actionLower = action.toLowerCase();

  if (metadata?.field) {
    const rebuilt = buildActivityFieldChangeCopy({
      field: metadata.field,
      oldValue: metadata.oldValue,
      newValue: metadata.newValue,
    });
    if (rebuilt?.description) return rebuilt.description;
  }

  if (/team member added/i.test(action)) {
    if (desc) return desc.replace(/ was added to the team/i, ' joined the team');
    const role = metadata?.roleName ? ` as ${metadata.roleName}` : '';
    return `${quoteLabel(relatedLabel) || 'A team member'} joined the team${role}.`;
  }

  if (/team member removed|member removed/i.test(action)) {
    return desc || `${quoteLabel(relatedLabel) || 'Team member'} was removed from the team.`;
  }

  if (/member role changed|role changed/i.test(action)) {
    return desc || `Updated role for ${quoteLabel(relatedLabel) || 'team member'}.`;
  }

  if (/role updated/i.test(action)) {
    const match = desc.match(/Role "([^"]+)"/i);
    return match ? `Updated permissions for role ${quoteLabel(match[1])}.` : desc || 'Updated a team role.';
  }

  if (/team request sent/i.test(action)) {
    const parts = String(activity?.description || '').split(' — ');
    const subject = String(parts[0] || relatedLabel || 'Request').trim();
    const detail = parts.slice(1).join(' — ').trim();
    return detail
      ? `Sent team request ${quoteLabel(subject)}: ${detail}`
      : `Sent team request ${quoteLabel(subject)}.`;
  }

  if (/team request approved/i.test(action)) {
    const subject = String(activity?.description || relatedLabel || 'request').trim();
    return `Approved team request ${quoteLabel(subject)}.`;
  }

  if (/team request rejected/i.test(action)) {
    const subject = String(activity?.description || relatedLabel || 'request').trim();
    return `Rejected team request ${quoteLabel(subject)}.`;
  }

  if (/candidate applied/i.test(action)) {
    return desc || `Applied to ${quoteLabel(relatedLabel) || 'a job'}.`;
  }

  if (/candidate added|bulk cv upload/i.test(actionLower + desc)) {
    return desc || `Added candidate ${quoteLabel(relatedLabel) || ''}.`.replace(/\s+\./, '.');
  }

  if (/candidate tag added/i.test(action)) {
    const tag = metadata?.tag || relatedLabel;
    return tag ? `Added tag ${quoteLabel(tag)} to candidate.` : desc || 'Added a candidate tag.';
  }

  if (/candidate tag removed/i.test(action)) {
    const tag = metadata?.tag || relatedLabel;
    return tag ? `Removed tag ${quoteLabel(tag)} from candidate.` : desc || 'Removed a candidate tag.';
  }

  if (/candidate moved to recycle bin|soft-deleted/i.test(actionLower + desc)) {
    const match = desc.match(/"([^"]+)"/);
    return match
      ? `Moved candidate ${quoteLabel(match[1])} to Recycle Bin.`
      : desc || 'Moved a candidate to Recycle Bin.';
  }

  if (/pipeline entry updated|added to pipeline|removed from pipeline/i.test(actionLower)) {
    return desc || 'Updated candidate pipeline stage.';
  }

  if (/candidate rejected/i.test(action)) {
    return desc || `Rejected candidate ${quoteLabel(relatedLabel) || ''}.`.replace(/\s+\./, '.');
  }

  if (/job created/i.test(action)) {
    const match = desc.match(/Job "([^"]+)"/i);
    return match ? `Created job ${quoteLabel(match[1])}.` : desc || 'Created a job posting.';
  }

  if (/job deleted/i.test(action)) {
    const match = desc.match(/Job "([^"]+)"/i);
    return match ? `Deleted job ${quoteLabel(match[1])}.` : desc || 'Deleted a job posting.';
  }

  if (/job restored/i.test(action)) {
    const match = desc.match(/Job "([^"]+)"/i);
    return match ? `Restored job ${quoteLabel(match[1])} from Recycle Bin.` : desc || 'Restored a job posting.';
  }

  if (/lead created/i.test(action)) {
    const match = desc.match(/lead "([^"]+)"/i);
    return match ? `Created lead ${quoteLabel(match[1])}.` : desc || 'Created a lead.';
  }

  if (/lead deleted|moved to recycle bin/i.test(actionLower + desc)) {
    const match = desc.match(/Lead "([^"]+)"/i);
    return match ? `Moved lead ${quoteLabel(match[1])} to Recycle Bin.` : desc || 'Moved a lead to Recycle Bin.';
  }

  if (/lead converted/i.test(action)) {
    const match = desc.match(/Lead "([^"]+)" was converted to client "([^"]+)"/i);
    if (match) return `Converted lead ${quoteLabel(match[1])} into client ${quoteLabel(match[2])}.`;
    return desc || 'Converted a lead to a client.';
  }

  if (/client created/i.test(action)) {
    const match = desc.match(/client "([^"]+)"/i);
    return match ? `Created client ${quoteLabel(match[1])}.` : desc || 'Created a client.';
  }

  if (/interview scheduled|interview created/i.test(actionLower)) {
    return desc || `Scheduled interview ${quoteLabel(relatedLabel) || ''}.`.replace(/\s+\./, '.');
  }

  if (/interview updated|interview rescheduled|status updated/i.test(actionLower)) {
    return desc || 'Updated an interview.';
  }

  if (/interview cancelled|interview canceled/i.test(actionLower)) {
    return desc || 'Cancelled an interview.';
  }

  if (/placement created/i.test(actionLower)) {
    return desc || `Created placement ${quoteLabel(relatedLabel) || ''}.`.replace(/\s+\./, '.');
  }

  if (/task assigned|task delegated|task completed|submitted for approval|completion approved|completion rejected/i.test(actionLower)) {
    return desc || `${action}.`;
  }

  if (/note added|internal note added/i.test(actionLower)) {
    return desc || 'Added an internal note.';
  }

  if (/field updated|^updated$/i.test(action)) {
    return desc || 'Updated record details.';
  }

  if (desc) return desc;
  if (relatedLabel) return `${action}: ${quoteLabel(relatedLabel)}.`;
  return action ? `${action}.` : 'Activity recorded.';
}

export function presentActivityForFeed(activity) {
  if (!activity) return activity;

  const metadata =
    activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata)
      ? activity.metadata
      : null;

  let action = String(activity.action || '').trim();
  let description = String(activity.description || activity.relatedLabel || '').trim();

  if (metadata?.field) {
    const rebuilt = buildActivityFieldChangeCopy({
      field: metadata.field,
      oldValue: metadata.oldValue,
      newValue: metadata.newValue,
    });
    if (rebuilt) {
      action = rebuilt.action;
      description = rebuilt.description;
    }
  } else if (description) {
    description = cleanupLegacyDescription(description);
    if (action === 'Field Updated' && description) {
      action = 'Updated';
    }
  }

  const enriched = {
    ...activity,
    action: action || activity.action,
    description: description || activity.description || activity.relatedLabel || null,
  };

  return {
    ...enriched,
    displaySummary: buildActivityDisplaySummary(enriched),
    displayKind: classifyActivityKind(enriched),
  };
}
