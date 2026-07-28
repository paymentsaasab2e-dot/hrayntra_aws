/**
 * Brain report generation — authorized datasets only.
 */

import {
  executeAssistantDataTool,
  fetchAssistantReportDataset,
  generateAssistantReportTool,
  safeSerialize,
} from '../../ai/assistantDataTools.js';
import { hasPermission } from '../permissions/brainPermissions.service.js';
import { logBrainAction } from '../monitoring/brainAudit.service.js';

const ENTITY_QUERY = {
  leads: 'leads',
  clients: 'clients',
  jobs: 'jobs',
  candidates: 'candidates',
  interviews: 'interviews',
  placements: 'placements',
  tasks: 'tasks',
};

/**
 * Build an inline markdown report from live tenant data.
 */
export async function generateInlineBrainReport(user, entity, { search = '', limit = 25 } = {}) {
  const started = Date.now();
  const key = String(entity || '').toLowerCase();
  if (!ENTITY_QUERY[key]) {
    return { ok: false, error: `Unsupported report entity: ${entity}` };
  }
  if (!hasPermission(user, 'reports_read') && !hasPermission(user, '*')) {
    logBrainAction({
      user,
      action: 'report.inline',
      status: 'denied',
      entityIds: [key],
      durationMs: Date.now() - started,
    });
    return { ok: false, error: 'Missing reports_read permission' };
  }

  let rows = [];
  try {
    if (typeof fetchAssistantReportDataset === 'function') {
      const dataset = await fetchAssistantReportDataset(user, key, search || '', 'summary');
      rows = Array.isArray(dataset?.rows)
        ? dataset.rows
        : Array.isArray(dataset?.data)
          ? dataset.data
          : Array.isArray(dataset)
            ? dataset
            : [];
    }
  } catch {
    rows = [];
  }

  if (!rows.length) {
    const tool = await executeAssistantDataTool(user, {
      query_type: ENTITY_QUERY[key],
      search: search || undefined,
      limit,
      detail_level: 'summary',
    });
    const data = tool?.data ?? tool?.rows ?? tool;
    rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  }

  const preview = rows.slice(0, limit).map((row, i) => {
    const name =
      row.companyName ||
      row.title ||
      row.fullName ||
      row.name ||
      row.candidateName ||
      row.id ||
      'Record';
    const status = row.status || row.stage || row.priority || '—';
    return `${i + 1}. ${name} — ${status}`;
  });

  const markdown = [
    `**${key[0].toUpperCase()}${key.slice(1)} report** · live tenant · **${rows.length}** row(s)`,
    '',
    preview.length ? preview.join('\n') : '_No rows in scope for your role._',
    '',
    '_Generated from authorized queries only._',
  ].join('\n');

  logBrainAction({
    user,
    action: 'report.inline',
    status: 'ok',
    entityIds: [key],
    outputSummary: `${rows.length} rows`,
    durationMs: Date.now() - started,
  });

  return { ok: true, entity: key, rowCount: rows.length, rows: rows.slice(0, limit), markdown };
}

export async function generateDownloadableBrainReport(user, payload) {
  if (!hasPermission(user, 'export_data') && !hasPermission(user, 'reports_read') && !hasPermission(user, '*')) {
    logBrainAction({ user, action: 'report.file', status: 'denied' });
    return { ok: false, error: 'Missing export permission' };
  }
  const result = await generateAssistantReportTool(user, payload);
  logBrainAction({
    user,
    action: 'report.file',
    status: result?.ok ? 'ok' : 'error',
    outputSummary: safeSerialize(result).slice(0, 400),
  });
  return result;
}

export const brainReports = {
  generateInlineBrainReport,
  generateDownloadableBrainReport,
};
