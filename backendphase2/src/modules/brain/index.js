/**
 * HRYANTRA Enterprise AI Brain — Phase 2 module exports.
 *
 * Architecture (horizontal-scale ready, tenant-isolated via ALS prisma):
 * - orchestration/  — central ask pipeline
 * - memory/         — conversation + intent memory
 * - retrieval/      — platform RAG corpus
 * - schema/         — entity & relationship registry
 * - reports/        — authorized report generation
 * - analytics/      — live KPI snapshots
 * - workflow/       — approved write actions
 * - monitoring/     — action audit + health
 * - permissions/    — RBAC gates
 * - tools/          — secure function registry
 */

export { brainOrchestrator, runBrainAsk } from './orchestration/brainOrchestrator.service.js';
export { brainMemory } from './memory/brainMemory.service.js';
export { brainRetrieval } from './retrieval/brainRetrieval.service.js';
export { brainSchemaRegistry } from './schema/brainSchemaRegistry.service.js';
export { brainReports } from './reports/brainReport.service.js';
export { brainAnalytics } from './analytics/brainAnalytics.service.js';
export { brainWorkflow } from './workflow/brainWorkflow.service.js';
export { brainAudit } from './monitoring/brainAudit.service.js';
export { brainPermissions } from './permissions/brainPermissions.service.js';
export { brainTools } from './tools/brainTools.registry.js';
export { brainController } from './brain.controller.js';
export { default as brainRoutes } from './brain.routes.js';
