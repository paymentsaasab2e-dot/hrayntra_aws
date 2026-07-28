/**
 * Brain secure tool registry — only registered tools may run.
 */

import { executeAssistantDataTool, safeSerialize } from '../../ai/assistantDataTools.js';
import { canAccessEntity, hasPermission } from '../permissions/brainPermissions.service.js';
import { generateInlineBrainReport } from '../reports/brainReport.service.js';
import { buildTenantAnalyticsSnapshot } from '../analytics/brainAnalytics.service.js';
import { executeApprovedWorkflow, listApprovedWorkflows } from '../workflow/brainWorkflow.service.js';
import { listEntities, discoverRelationships, getEntitySchema } from '../schema/brainSchemaRegistry.service.js';
import { logBrainAction } from '../monitoring/brainAudit.service.js';

/** @type {Record<string, { description: string; run: (user:any, args:any) => Promise<any> }>} */
export const BRAIN_TOOLS = {
  query_tenant_data: {
    description: 'Read scoped tenant CRM/recruitment data (counts or lists).',
    async run(user, args) {
      const queryType = String(args?.query_type || 'counts');
      const entityGuess = queryType.replace(/_by_id$/, '').replace(/s$/, '');
      if (queryType !== 'counts' && !canAccessEntity(user, entityGuess) && !canAccessEntity(user, queryType.replace(/s$/, ''))) {
        // soft allow counts; entity list still filtered inside data tools
      }
      const result = await executeAssistantDataTool(user, args || { query_type: 'counts' });
      logBrainAction({
        user,
        action: 'tool.query_tenant_data',
        toolName: 'query_tenant_data',
        status: result?.ok === false ? 'error' : 'ok',
        inputSummary: safeSerialize(args).slice(0, 300),
        outputSummary: safeSerialize(result).slice(0, 400),
      });
      return result;
    },
  },
  get_schema_map: {
    description: 'Return discovered entity schemas and relationships.',
    async run(user, args) {
      if (args?.entityId) {
        return {
          entity: getEntitySchema(args.entityId),
          relationships: discoverRelationships(args.entityId),
        };
      }
      return { entities: listEntities() };
    },
  },
  run_analytics: {
    description: 'Live tenant analytics snapshot + recommendations.',
    async run(user) {
      return buildTenantAnalyticsSnapshot(user);
    },
  },
  generate_report: {
    description: 'Generate an inline report for an entity from live data.',
    async run(user, args) {
      return generateInlineBrainReport(user, args?.entity || 'leads', {
        search: args?.search || '',
        limit: args?.limit || 25,
      });
    },
  },
  execute_workflow: {
    description: 'Execute an approved write workflow with RBAC.',
    async run(user, args) {
      return executeApprovedWorkflow(user, args || {});
    },
  },
  list_workflows: {
    description: 'List approved workflow action types.',
    async run() {
      return { actions: listApprovedWorkflows() };
    },
  },
};

export async function invokeBrainTool(user, toolName, args = {}) {
  const tool = BRAIN_TOOLS[toolName];
  if (!tool) {
    logBrainAction({
      user,
      action: 'tool.invoke',
      toolName,
      status: 'denied',
      inputSummary: 'unknown tool',
    });
    return { ok: false, error: `Unknown brain tool: ${toolName}` };
  }
  if (!hasPermission(user, 'brain_ask') && !hasPermission(user, '*')) {
    // Managers/admins already have *; recruiters get brain_ask via role map
    if (!hasPermission(user, 'leads_read') && !hasPermission(user, 'jobs_read')) {
      logBrainAction({ user, action: 'tool.invoke', toolName, status: 'denied' });
      return { ok: false, error: 'Forbidden' };
    }
  }
  return tool.run(user, args);
}

export function listBrainTools() {
  return Object.entries(BRAIN_TOOLS).map(([name, t]) => ({
    name,
    description: t.description,
  }));
}

export const brainTools = {
  BRAIN_TOOLS,
  invokeBrainTool,
  listBrainTools,
};
