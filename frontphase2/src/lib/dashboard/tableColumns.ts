/** Keys hidden from dashboard widget tables (internal ids / raw relations). */
import { formatDateTimeDMY } from '../../utils/dateDisplay';

const HIDDEN_KEYS = new Set(['id', '_id', '__v', 'assignedToId', 'createdById', 'departmentId']);

/** Shown only when a row is expanded — not in the compact column strip. */
const EXPAND_ONLY_KEYS_BY_DATASET: Record<string, string[]> = {
  leads: [
    'remarks',
    'email',
    'phone',
    'totalCalls',
    'totalEmails',
    'totalWhatsapp',
    'whatsappSender',
    'latestActivityRemark',
    'lastFollowUp',
    'nextFollowUp',
    'alert',
  ],
  tasks_and_activity: ['description', 'dueDate'],
};

/** Preferred order for expanded detail panels (subset may apply per row). */
const EXPAND_DETAIL_ORDER: Record<string, string[]> = {
  leads: [
    'remarks',
    'latestActivityRemark',
    'totalCalls',
    'totalEmails',
    'totalWhatsapp',
    'whatsappSender',
    'email',
    'phone',
    'lastFollowUp',
    'nextFollowUp',
    'alert',
  ],
};

export function isHiddenTableColumn(key: string): boolean {
  const k = key.trim();
  if (!k) return true;
  if (HIDDEN_KEYS.has(k)) return true;
  if (/^id$/i.test(k)) return true;
  if (/Id$/.test(k) && k.length > 2) return true;
  return false;
}

function isExpandOnlyColumn(key: string, datasetId?: string) {
  if (!datasetId) return false;
  const expandOnly = EXPAND_ONLY_KEYS_BY_DATASET[datasetId] || [];
  return expandOnly.includes(key);
}

export function getVisibleTableColumns(
  rows: Record<string, unknown>[],
  maxColumns = 8,
  datasetId?: string,
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const prefer = [
    'leadName',
    'companyName',
    'name',
    'title',
    'contactPerson',
    'assignedTo',
    'assignedUser',
    'status',
    'stage',
    'source',
    'location',
    'client',
    'candidate',
    'job',
    'role',
    'department',
    'module',
    'recordType',
    'metric',
    'value',
    'count',
    'revenue',
    'round',
    'createdAt',
    'updatedAt',
    'scheduledAt',
    'timestamp',
    'dueDate',
  ];

  for (const key of prefer) {
    if (seen.has(key) || isHiddenTableColumn(key) || isExpandOnlyColumn(key, datasetId)) continue;
    if (rows.some((row) => row[key] !== undefined && row[key] !== null && row[key] !== '')) {
      ordered.push(key);
      seen.add(key);
    }
  }

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key) || isHiddenTableColumn(key) || isExpandOnlyColumn(key, datasetId)) continue;
      ordered.push(key);
      seen.add(key);
    }
  }

  return ordered.slice(0, maxColumns);
}

/** Detail fields rendered below the row when expanded (expandable table variant). */
export function getExpandableDetailKeys(
  row: Record<string, unknown>,
  visibleColumns: string[],
  datasetId?: string,
): string[] {
  const visible = new Set(visibleColumns);
  const ordered: string[] = [];
  const seen = new Set<string>();

  const preferred = datasetId ? EXPAND_DETAIL_ORDER[datasetId] || [] : [];
  for (const key of preferred) {
    if (seen.has(key) || visible.has(key) || isHiddenTableColumn(key)) continue;
    const value = row[key];
    if (value === undefined || value === null || value === '') continue;
    ordered.push(key);
    seen.add(key);
  }

  for (const key of Object.keys(row)) {
    if (seen.has(key) || visible.has(key) || isHiddenTableColumn(key)) continue;
    const value = row[key];
    if (value === undefined || value === null || value === '') continue;
    ordered.push(key);
    seen.add(key);
  }

  return ordered;
}

const HEADER_LABELS: Record<string, string> = {
  companyName: 'Company',
  contactPerson: 'Contact',
  createdAt: 'Created',
  updatedAt: 'Updated',
  scheduledAt: 'Scheduled',
  dueDate: 'Due date',
  recordType: 'Type',
  memberCount: 'Members',
  taskTitle: 'Task',
  placementFee: 'Fee',
  totalCalls: 'Total calls',
  totalEmails: 'Total emails',
  totalWhatsapp: 'Total WhatsApp',
  whatsappSender: 'WhatsApp sender',
  latestActivityRemark: 'Latest activity remark',
  remarks: 'Remarks',
  lastFollowUp: 'Last follow-up',
  nextFollowUp: 'Next follow-up',
};

export function formatTableHeader(key: string): string {
  if (HEADER_LABELS[key]) return HEADER_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatUserLikeValue(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const combined = [obj.firstName, obj.lastName].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  if (typeof obj.name === 'string' && obj.name.trim()) return obj.name.trim();
  if (typeof obj.email === 'string' && obj.email.trim()) return obj.email.trim();
  return null;
}

export function formatTableCellValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (/revenue|fee|amount/i.test(key)) {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
    }
    return String(value);
  }
  if (typeof value === 'object') {
    const userLabel = formatUserLikeValue(value);
    if (userLabel) return userLabel;
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }

  const str = String(value);
  if (/At$|Date$|^timestamp$|^postedDate$/i.test(key)) {
    const formatted = formatDateTimeDMY(str);
    if (formatted) return formatted;
  }

  if (/^remarks$|remark|notes|description|latestActivityRemark/i.test(key)) {
    if (str.length > 280) return `${str.slice(0, 277)}…`;
    return str;
  }

  if (str.length > 120) return `${str.slice(0, 117)}…`;
  return str;
}

export function isMultilineTableCell(key: string): boolean {
  return /^remarks$|remark|notes|description|latestActivityRemark/i.test(key);
}
