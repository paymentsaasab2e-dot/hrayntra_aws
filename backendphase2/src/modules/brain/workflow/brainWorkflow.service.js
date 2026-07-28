/**
 * Brain workflow execution — approved action tools only.
 * DELETE is forbidden (enforced in assistantDataTools).
 */

import {
  executeAssistantActionTool,
  safeSerialize,
} from '../../ai/assistantDataTools.js';
import { canExecuteWorkflow } from '../permissions/brainPermissions.service.js';
import { logBrainAction } from '../monitoring/brainAudit.service.js';

const APPROVED_ACTIONS = new Set([
  'create_lead',
  'update_lead',
  'convert_lead_to_client',
  'create_client',
  'update_client',
  'create_job',
  'update_job',
  'update_candidate',
  'move_candidate_stage',
  'schedule_interview',
  'create_task',
  'update_task',
  'complete_task',
  'create_placement',
  'update_placement',
  'mark_placement_joined',
]);

/**
 * @param {any} user
 * @param {{ action_type: string; record_id?: string; payload?: object; confirm?: boolean }} spec
 */
export async function executeApprovedWorkflow(user, spec) {
  const started = Date.now();
  const actionType = String(spec?.action_type || '').trim();

  if (!canExecuteWorkflow(user)) {
    logBrainAction({
      user,
      action: 'workflow.execute',
      toolName: actionType,
      status: 'denied',
      inputSummary: 'brain_workflow permission missing',
      durationMs: Date.now() - started,
    });
    return { ok: false, error: 'Workflow execution not permitted for this role' };
  }

  if (!APPROVED_ACTIONS.has(actionType)) {
    logBrainAction({
      user,
      action: 'workflow.execute',
      toolName: actionType,
      status: 'denied',
      inputSummary: 'action not in approved allow-list',
      durationMs: Date.now() - started,
    });
    return { ok: false, error: `Action "${actionType}" is not an approved Brain workflow` };
  }

  if (spec?.confirm === false) {
    return {
      ok: false,
      needsConfirmation: true,
      action_type: actionType,
      message: 'Set confirm:true to execute this workflow.',
    };
  }

  const result = await executeAssistantActionTool(user, {
    action_type: actionType,
    record_id: spec.record_id,
    payload: spec.payload || {},
  });

  logBrainAction({
    user,
    action: 'workflow.execute',
    toolName: actionType,
    status: result?.ok ? 'ok' : 'error',
    inputSummary: safeSerialize({ record_id: spec.record_id, payload: spec.payload }).slice(0, 400),
    outputSummary: safeSerialize(result).slice(0, 500),
    durationMs: Date.now() - started,
  });

  return result;
}

export function listApprovedWorkflows() {
  return [...APPROVED_ACTIONS];
}

export const brainWorkflow = {
  executeApprovedWorkflow,
  listApprovedWorkflows,
  APPROVED_ACTIONS,
};
