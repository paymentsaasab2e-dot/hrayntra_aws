import { sendResponse, sendError } from '../../utils/response.js';
import { runBrainAsk } from './orchestration/brainOrchestrator.service.js';
import { listEntities, listModules, discoverRelationships, getEntitySchema } from './schema/brainSchemaRegistry.service.js';
import { listBrainTools } from './tools/brainTools.registry.js';
import { listApprovedWorkflows, executeApprovedWorkflow } from './workflow/brainWorkflow.service.js';
import { getBrainHealthSnapshot, listRecentBrainActions } from './monitoring/brainAudit.service.js';
import { retrievePlatformKnowledge } from './retrieval/brainRetrieval.service.js';
import { loadBrainMemory } from './memory/brainMemory.service.js';
import { buildTenantAnalyticsSnapshot, summarizeBusinessPerformance } from './analytics/brainAnalytics.service.js';
import { generateInlineBrainReport } from './reports/brainReport.service.js';

export const brainController = {
  async ask(req, res) {
    try {
      const body = req.body || {};
      const question = body.question || body.prompt || body.message;
      const result = await runBrainAsk(req.user, {
        question,
        sessionKey: body.sessionKey || 'default',
        pathname: body.pathname || req.headers['x-pathname'] || null,
        messages: body.messages,
        executeWorkflow: body.executeWorkflow || null,
      });
      return sendResponse(res, 200, 'Brain response', result);
    } catch (error) {
      if (error.code === 'VALIDATION') return sendError(res, 400, error.message);
      if (error.code === 'FORBIDDEN') return sendError(res, 403, error.message);
      console.error('[brain.ask]', error);
      return sendError(res, 500, error.message || 'Brain request failed', error);
    }
  },

  async schema(req, res) {
    try {
      const entityId = req.params.entityId || req.query.entityId;
      if (entityId) {
        return sendResponse(res, 200, 'Entity schema', {
          entity: getEntitySchema(entityId),
          relationships: discoverRelationships(entityId),
        });
      }
      return sendResponse(res, 200, 'Brain schema registry', {
        modules: listModules(),
        entities: listEntities(),
      });
    } catch (error) {
      return sendError(res, 500, error.message || 'Schema lookup failed', error);
    }
  },

  async retrieve(req, res) {
    try {
      const q = req.body?.question || req.query.q || '';
      const result = retrievePlatformKnowledge(q);
      return sendResponse(res, 200, 'Retrieval result', result);
    } catch (error) {
      return sendError(res, 500, error.message || 'Retrieval failed', error);
    }
  },

  async analytics(req, res) {
    try {
      const snap = await buildTenantAnalyticsSnapshot(req.user);
      return sendResponse(res, 200, 'Analytics snapshot', {
        ...snap,
        summary: snap.ok ? summarizeBusinessPerformance(snap.metrics) : null,
      });
    } catch (error) {
      return sendError(res, 500, error.message || 'Analytics failed', error);
    }
  },

  async report(req, res) {
    try {
      const entity = req.body?.entity || req.query.entity || 'leads';
      const result = await generateInlineBrainReport(req.user, entity, {
        search: req.body?.search || '',
        limit: Number(req.body?.limit || 25),
      });
      if (!result.ok) return sendError(res, 403, result.error || 'Report denied');
      return sendResponse(res, 200, 'Report generated', result);
    } catch (error) {
      return sendError(res, 500, error.message || 'Report failed', error);
    }
  },

  async workflow(req, res) {
    try {
      if (req.method === 'GET') {
        return sendResponse(res, 200, 'Approved workflows', { actions: listApprovedWorkflows() });
      }
      const result = await executeApprovedWorkflow(req.user, {
        ...(req.body || {}),
        confirm: req.body?.confirm !== false,
      });
      if (!result.ok && result.error?.includes('not permitted')) {
        return sendError(res, 403, result.error);
      }
      return sendResponse(res, result.ok ? 200 : 400, result.ok ? 'Workflow executed' : 'Workflow failed', result);
    } catch (error) {
      return sendError(res, 500, error.message || 'Workflow failed', error);
    }
  },

  async tools(req, res) {
    return sendResponse(res, 200, 'Brain tools', { tools: listBrainTools() });
  },

  async memory(req, res) {
    try {
      const sessionKey = req.params.sessionKey || req.query.sessionKey || 'default';
      const memory = await loadBrainMemory(req.user.id, sessionKey);
      return sendResponse(res, 200, 'Brain memory', memory);
    } catch (error) {
      return sendError(res, 500, error.message || 'Memory load failed', error);
    }
  },

  async health(req, res) {
    return sendResponse(res, 200, 'Brain health', getBrainHealthSnapshot());
  },

  async audit(req, res) {
    const limit = Number(req.query.limit || 50);
    const rows = listRecentBrainActions({ userId: req.user.id, limit });
    return sendResponse(res, 200, 'Brain audit trail', { actions: rows });
  },
};
