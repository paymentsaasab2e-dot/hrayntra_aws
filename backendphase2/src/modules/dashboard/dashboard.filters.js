/** Shared filter helpers for dashboard datasets */

export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export function parseFilters(query = {}) {
  return {
    dateRange: String(query.dateRange || 'all').trim(),
    status: String(query.status || 'all').trim(),
    recordType: String(query.recordType || 'all').trim(),
    departmentId: String(query.departmentId || 'all').trim(),
    limit: String(query.limit || 'all').trim(),
  };
}

export function getDateCutoff(dateRange) {
  if (!dateRange || dateRange === 'all') return null;
  const now = new Date();
  const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : null;
  if (!days) return null;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

export function rowMatchesDateRange(row, dateRange, dateKeys = ['createdAt', 'timestamp', 'scheduledAt', 'updatedAt', 'dueDate']) {
  const cutoff = getDateCutoff(dateRange);
  if (!cutoff) return true;
  for (const key of dateKeys) {
    const raw = row[key];
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime()) && d >= cutoff) return true;
  }
  return false;
}

export function applyRowFilters(rows, filters, options = {}) {
  const { dateKeys = ['createdAt', 'timestamp', 'scheduledAt', 'updatedAt', 'dueDate'], statusKey = 'status' } = options;
  let result = [...rows];

  if (filters.status && filters.status !== 'all') {
    result = result.filter((row) => String(row[statusKey] || '').toUpperCase() === String(filters.status).toUpperCase());
  }

  if (filters.recordType && filters.recordType !== 'all') {
    const want =
      filters.recordType === 'tasks'
        ? 'task'
        : filters.recordType === 'activity'
          ? 'activity'
          : filters.recordType;
    result = result.filter((row) => String(row.recordType || '').toLowerCase() === want.toLowerCase());
  }

  if (filters.departmentId && filters.departmentId !== 'all') {
    result = result.filter((row) => String(row.departmentId || row.department || '') === filters.departmentId);
  }

  if (filters.dateRange && filters.dateRange !== 'all') {
    result = result.filter((row) => rowMatchesDateRange(row, filters.dateRange, dateKeys));
  }

  if (filters.limit && filters.limit !== 'all') {
    const n = Number.parseInt(filters.limit, 10);
    if (Number.isFinite(n) && n > 0) result = result.slice(0, n);
  }

  return result;
}

export const COMMON_FILTER_DEFS = {
  dateRange: {
    key: 'dateRange',
    label: 'Date range',
    type: 'select',
    options: DATE_RANGE_OPTIONS,
    defaultValue: 'all',
  },
  statusAll: {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [{ value: 'all', label: 'All statuses' }],
    defaultValue: 'all',
  },
  recordType: {
    key: 'recordType',
    label: 'Show',
    type: 'select',
    options: [
      { value: 'all', label: 'Tasks & activity' },
      { value: 'tasks', label: 'Tasks only' },
      { value: 'activity', label: 'Activity only' },
    ],
    defaultValue: 'all',
  },
};
