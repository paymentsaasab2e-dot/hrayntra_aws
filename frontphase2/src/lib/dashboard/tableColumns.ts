/** Keys hidden from dashboard widget tables (internal ids). */
const HIDDEN_KEYS = new Set(['id', '_id', '__v']);

export function isHiddenTableColumn(key: string): boolean {
  const k = key.trim();
  if (!k) return true;
  if (HIDDEN_KEYS.has(k)) return true;
  if (/^id$/i.test(k)) return true;
  if (/Id$/.test(k) && k.length > 2) return true;
  return false;
}

export function getVisibleTableColumns(rows: Record<string, unknown>[], maxColumns = 8): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const prefer = [
    'companyName',
    'name',
    'title',
    'status',
    'stage',
    'source',
    'location',
    'client',
    'candidate',
    'job',
    'role',
    'department',
    'email',
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
    if (seen.has(key) || isHiddenTableColumn(key)) continue;
    if (rows.some((row) => row[key] !== undefined && row[key] !== null && row[key] !== '')) {
      ordered.push(key);
      seen.add(key);
    }
  }

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key) || isHiddenTableColumn(key)) continue;
      ordered.push(key);
      seen.add(key);
    }
  }

  return ordered.slice(0, maxColumns);
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
};

export function formatTableHeader(key: string): string {
  if (HEADER_LABELS[key]) return HEADER_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
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
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }

  const str = String(value);
  if (/At$|Date$|^timestamp$|^postedDate$/i.test(key)) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  if (str.length > 120) return `${str.slice(0, 117)}…`;
  return str;
}
