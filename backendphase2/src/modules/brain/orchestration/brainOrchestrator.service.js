/**
 * Brain orchestrator — central intelligence layer for HRYANTRA Phase 2.
 *
 * Pipeline:
 * 1) Load conversation memory
 * 2) Retrieve platform knowledge (RAG)
 * 3) Match schema entities
 * 4) Plan & execute secure tools (analytics / query / report / workflow)
 * 5) Compose answer from live results ONLY (never fabricate)
 * 6) Persist memory + audit log
 *
 * Optional LLM synthesis when BRAIN_USE_LLM=true and a provider is configured.
 * Default path is deterministic enterprise orchestration (no OpenAI/Mistral required).
 */

import { hasLlmProvider, chatCompletionWithFallback } from '../../../services/llmChatFallback.service.js';
import { env } from '../../../config/env.js';
import { retrievePlatformKnowledge } from '../retrieval/brainRetrieval.service.js';
import {
  loadBrainMemory,
  saveBrainTurn,
  buildMemoryContextBlock,
} from '../memory/brainMemory.service.js';
import { assertPermission, filterEntitiesForUser, canExecuteWorkflow } from '../permissions/brainPermissions.service.js';
import { invokeBrainTool } from '../tools/brainTools.registry.js';
import { executeApprovedWorkflow } from '../workflow/brainWorkflow.service.js';
import { resolveEffectivePermissionNames } from '../../role/effectivePermissions.service.js';
import { userHasAnyPermission } from '../../role/permission-aliases.js';
import {
  matchKnownPeopleCommand,
  executeKnownPeopleCommand,
  undoKnownPeopleCommand,
  resolvePendingReply,
} from '../../ai/ariaKnownCommands.js';
import {
  buildTenantAnalyticsSnapshot,
  summarizeBusinessPerformance,
} from '../analytics/brainAnalytics.service.js';
import { generateInlineBrainReport } from '../reports/brainReport.service.js';
import { logBrainAction } from '../monitoring/brainAudit.service.js';
import { matchEntitiesFromText, getEntitySchema } from '../schema/brainSchemaRegistry.service.js';
import { safeSerialize } from '../../ai/assistantDataTools.js';

function normalizeQuestion(q) {
  return String(q || '').trim();
}

function detectIntent(question) {
  const q = question.toLowerCase();
  if (/^(help|what can you|who are you|capabilities)\b/.test(q) || q === 'help') return 'help';
  if (/report|export|csv|excel|pdf|dataset/.test(q)) return 'report';
  if (/analytic|kpi|performance|summary|summarize|pulse|overview|dashboard|how are we|business/.test(q)) {
    return 'analytics';
  }
  if (/recommend|what should i|next action|focus|priority|risk/.test(q)) return 'recommend';
  if (/schema|relationship|how .* relat|data model|entities/.test(q)) return 'schema';
  if (/create |add |schedule |convert |move |complete |mark .* joined|update /.test(q) && /lead|client|job|candidate|interview|task|placement/.test(q)) {
    return 'workflow_hint';
  }
  if (/how many|count|total|list|show|find|search|who is|where is/.test(q)) return 'query';
  if (/how (do|does|to|can)|what is|explain|guide|tutorial/.test(q)) return 'knowledge';
  return 'general';
}

function detectReportEntity(question) {
  const q = question.toLowerCase();
  const map = [
    ['leads', /lead/],
    ['clients', /client|account/],
    ['jobs', /job|opening|requisition|role/],
    ['candidates', /candidate|talent|applicant/],
    ['interviews', /interview/],
    ['placements', /placement|hire|joining/],
    ['tasks', /task|todo|to-do|activit/],
  ];
  for (const [entity, re] of map) {
    if (re.test(q)) return entity;
  }
  return 'leads';
}

function detectQueryType(question, entities) {
  const q = question.toLowerCase();
  if (/how many|count|total|metric|stats|pulse|overview/.test(q)) return 'counts';
  const primary = entities[0];
  const map = {
    lead: 'leads',
    client: 'clients',
    job: 'jobs',
    candidate: 'candidates',
    interview: 'interviews',
    placement: 'placements',
    task: 'tasks',
    team_user: 'team_users',
  };
  if (primary && map[primary]) return map[primary];
  return 'counts';
}

function helpText() {
  return [
    '**HRYANTRA Enterprise Brain**',
    '',
    'I am the central intelligence layer for your tenant. I:',
    '• Understand CRM, recruitment, analytics, reports, notifications, and admin domains',
    '• Retrieve platform knowledge + schema relationships (RAG)',
    '• Query **your live authorized data** only — never invent numbers',
    '• Generate reports, analytics, and action recommendations',
    '• Execute **approved workflows** when your role allows',
    '',
    'I also run the same actions the screens do:',
    '• People: `punch Ada`, `approve leave`, `approve leave Ada`, `reject leave Theo`, `lock this month`, `run payroll`, `apply leave Ada Annual from 26 Nov 2026 to 28 Nov 2026`, `regularise Ada 26 Nov 2026`, `complete onboarding Ada bank details`, `join Ada`, `defer Ada`, `no show Ada`, `start exit Ada`, `complete exit Ada`, `assign asset LP-01 to Ada`, `return asset LP-01`, `issue letter relieving to Ada`, `approve inbox`, `approve payroll`, `lock payroll`',
    '• CRM: `create lead Acme`, `create job Frontend Dev for Acme`, `move Ada to Interview on Frontend Dev`, `schedule interview Ada Frontend Dev on 26 Nov 2026`, `add task Follow up for Theo`, `complete task Follow up`, `create placement Ada on Frontend Dev`, `mark Ada joined`',
    '• When I list options, reply with a number or a name. Say `cancel` to stop, `yes` to confirm, `undo` to reverse the last write (10 minutes).',
    '',
    'Try: “Summarize business performance”, “Report on open jobs”, “How many candidates?”, “Show schema for placements”.',
  ].join('\n');
}

const COMMAND_PERMISSION_LABELS = {
  punch: 'punch attendance',
  leave: 'approve or reject leave',
  lock: 'lock the attendance month',
  payroll: 'run payroll',
  'payroll-decide': 'approve or lock payroll',
  'apply-leave': 'apply leave',
  'apply-leave-resolve-type': 'apply leave',
  'apply-leave-final': 'apply leave',
  regularise: 'regularise attendance',
  onboarding: 'complete an onboarding task',
  join: 'mark an employee as joined',
  defer: 'defer an employee',
  noshow: 'mark an employee as no-show',
  'exit-start': 'start an exit',
  'exit-complete': 'complete an exit',
  'asset-assign': 'assign an asset',
  'asset-assign-pick-person': 'assign an asset',
  'asset-return': 'return an asset',
  letter: 'issue a letter',
  'letter-final': 'issue a letter',
  inbox: 'decide an inbox item',
};

const PENDING_TTL_MS = 10 * 60 * 1000;

// Same list peoplecore.routes.js uses for People writes.
const PEOPLE_WRITE_PERMISSIONS = ['candidates_create', 'candidates_update', 'add_candidate', 'edit_candidate'];

async function peopleWriteAllowed(user) {
  try {
    const resolved = await resolveEffectivePermissionNames(user?.id || user);
    if (resolved.isSuperAdmin) return true;
    return userHasAnyPermission(resolved.permissions || [], PEOPLE_WRITE_PERMISSIONS);
  } catch {
    return false;
  }
}

/**
 * Command front door. Runs before intent detection so `approve leave` is never
 * swallowed by the analytics summariser. Returns an ask-style result, or null
 * when the text is a normal question.
 */
async function tryBrainCommand(user, { question, sessionKey, memory, input, started }) {
  const cm = memory?.conversationMemory || {};
  let pending = cm.pendingCommand && typeof cm.pendingCommand === 'object' ? cm.pendingCommand : null;
  if (pending && pending.expiresAt && new Date(pending.expiresAt).getTime() < Date.now()) pending = null;
  const lastUndoId = cm.lastUndoActionId || null;
  const match = matchKnownPeopleCommand(question);

  let reply = null;
  let nextPending = pending;
  let nextUndoId = lastUndoId;
  let undoInfo = null;
  let ranCommand = null;
  let ranResult = null;
  let status = 'ok';

  if (match?.kind === 'undo') {
    if (!lastUndoId) {
      reply = 'Nothing to undo.';
    } else {
      const undone = await undoKnownPeopleCommand(user, lastUndoId);
      reply = undone.summary;
      if (undone.ok) nextUndoId = null;
    }
    nextPending = null;
    ranCommand = { kind: 'undo' };
  } else if (match?.kind === 'cancel' || (match?.kind === 'choice' && !pending)) {
    reply = pending ? 'Cancelled.' : 'Nothing is waiting for an answer.';
    nextPending = null;
    ranCommand = match;
  } else {
    let command = null;
    if (pending) {
      const resolved = resolvePendingReply(pending, question);
      if (resolved.type === 'cancel') {
        reply = 'Cancelled.';
        nextPending = null;
      } else if (resolved.type === 'reprompt') {
        reply = resolved.text;
        nextPending = { ...pending, expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString() };
      } else if (resolved.type === 'command' || resolved.type === 'fresh') {
        command = resolved.command;
      } else {
        nextPending = null;
      }
    } else if (match) {
      command = match;
    }

    if (command) {
      const isCrm = command.kind === 'crm';
      const allowed = isCrm ? canExecuteWorkflow(user) : await peopleWriteAllowed(user);
      if (!allowed) {
        const label = isCrm ? 'run that CRM action' : COMMAND_PERMISSION_LABELS[command.kind] || 'do that';
        reply = `You don't have permission to ${label}.`;
        nextPending = null;
        status = 'denied';
      } else {
        ranCommand = command;
        ranResult = await executeKnownPeopleCommand(user, command);
        if (ranResult?.workflowSpec) {
          const wf = await executeApprovedWorkflow(user, { ...ranResult.workflowSpec, confirm: true });
          if (wf?.ok) {
            reply = `${ranResult.summary.replace(/\.$/, '')} — done.`;
          } else {
            reply = wf?.error || wf?.message || 'That action failed.';
            status = 'error';
          }
        } else {
          reply = ranResult?.summary || (ranResult?.ok ? 'Done.' : 'Could not run that.');
          if (ranResult && !ranResult.ok && !ranResult.pending) status = 'error';
        }
        if (ranResult?.pending) {
          nextPending = { ...ranResult.pending, expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString() };
          status = 'ok';
        } else {
          nextPending = null;
        }
        if (ranResult?.undoPayload?.available) {
          nextUndoId = ranResult.undoPayload.actionId;
          undoInfo = ranResult.undoPayload;
          reply = `${reply} Say undo to take that back.`;
        }
      }
    }
  }

  if (!reply) return null;

  const audit = logBrainAction({
    user,
    action: 'brain.command',
    toolName: ranCommand?.kind || (pending ? 'pending' : 'command'),
    status,
    inputSummary: question.slice(0, 300),
    outputSummary: String(reply).slice(0, 400),
    durationMs: Date.now() - started,
  });

  await saveBrainTurn({
    userId: user.id,
    sessionKey,
    pathname: input.pathname || null,
    priorMessages: input.messages,
    userMessage: question,
    assistantMessage: reply,
    memoryUpdate: {
      userIntent: 'command',
      lastActions: ranCommand ? [ranCommand.kind] : [],
      pendingCommand: nextPending,
      lastUndoActionId: nextUndoId,
      currentPageContext: String(input.pathname || ''),
    },
    actionLogItem: {
      action_id: audit.id,
      entity: ranCommand?.kind || 'brain',
      operation: 'command',
      status: status === 'ok' ? 'SUCCESS' : status.toUpperCase(),
      createdAt: audit.at,
    },
  });

  return {
    reply,
    intent: 'command',
    entities: [],
    usedTools: ranCommand ? [ranCommand.kind] : [],
    undo: undoInfo,
    auditId: audit.id,
    durationMs: Date.now() - started,
  };
}

async function optionalLlmSynthesize({ question, contextBlock, toolFacts, memoryBlock }) {
  if (process.env.BRAIN_USE_LLM !== 'true' || !hasLlmProvider()) {
    return null;
  }
  try {
    const completion = await chatCompletionWithFallback(
      {
        model: env.OPENAI_CHAT_MODEL,
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: [
              'You are the HRYANTRA Enterprise Brain. Answer using ONLY the provided retrieved knowledge and live tool facts.',
              'Never invent records, counts, or names. If data is missing, say so.',
              'Be concise, professional, and cite that figures come from live tenant queries.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `Question: ${question}`,
              '',
              'Memory:',
              memoryBlock,
              '',
              contextBlock,
              '',
              'Live tool facts (JSON):',
              toolFacts,
            ].join('\n'),
          },
        ],
      },
      'brain-orchestrator',
    );
    const text = completion?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {any} user
 * @param {{ question: string; sessionKey?: string; pathname?: string; messages?: Array<{role:string;content:string}>; executeWorkflow?: object|null }} input
 */
export async function runBrainAsk(user, input = {}) {
  const started = Date.now();
  const question = normalizeQuestion(input.question || input.prompt);
  if (!question) {
    const err = new Error('question is required');
    err.code = 'VALIDATION';
    throw err;
  }

  assertPermission(user, 'brain_ask');

  const sessionKey = input.sessionKey || 'default';
  const memory = await loadBrainMemory(user.id, sessionKey);

  // One command front door: known People/CRM sentences execute here; anything
  // else falls through to the normal question path below.
  const commandResult = await tryBrainCommand(user, { question, sessionKey, memory, input, started });
  if (commandResult) return commandResult;

  const memoryBlock = buildMemoryContextBlock(memory);
  const retrieval = retrievePlatformKnowledge(question);
  const matchedEntities = filterEntitiesForUser(user, retrieval.entities.length ? retrieval.entities : matchEntitiesFromText(question));
  const intent = detectIntent(question);

  /** @type {Record<string, any>} */
  const toolResults = {};
  let answer = '';
  let usedTools = [];

  try {
    if (intent === 'help') {
      answer = helpText();
    } else if (intent === 'schema') {
      const schemaResult = await invokeBrainTool(user, 'get_schema_map', {
        entityId: matchedEntities[0] || undefined,
      });
      toolResults.schema = schemaResult;
      usedTools.push('get_schema_map');
      if (matchedEntities[0] && schemaResult?.entity) {
        const e = schemaResult.entity;
        answer = [
          `**Schema · ${e.label}** (${e.prismaModel})`,
          '',
          e.description,
          '',
          '**Fields**',
          ...e.fields.map((f) => `• ${f.name}: ${f.type}${f.pii ? ' (PII)' : ''}`),
          '',
          '**Relationships**',
          ...(e.relations.length
            ? e.relations.map((r) => `• ${r.type} → **${r.to}** via \`${r.via}\` — ${r.description}`)
            : ['• none registered']),
          '',
          '_From Brain schema registry — not invented._',
        ].join('\n');
      } else {
        const entities = schemaResult?.entities || [];
        answer = [
          '**HRYANTRA schema map**',
          '',
          ...entities.map((e) => `• **${e.label}** (${e.module}) — ${e.description}`),
          '',
          retrieval.contextBlock.split('### Retrieved')[0] || '',
        ].join('\n');
      }
    } else if (intent === 'analytics' || intent === 'recommend' || intent === 'general') {
      const snap = await buildTenantAnalyticsSnapshot(user);
      toolResults.analytics = snap;
      usedTools.push('run_analytics');
      if (snap.ok) {
        answer = summarizeBusinessPerformance(snap.metrics);
        if (intent === 'recommend') {
          answer = `${answer}\n\n_Recommendations are derived only from your live counts._`;
        }
        if (intent === 'general' && matchedEntities.length) {
          const qType = detectQueryType(question, matchedEntities);
          const data = await invokeBrainTool(user, 'query_tenant_data', {
            query_type: qType,
            search: question.slice(0, 80),
            limit: 10,
            detail_level: 'summary',
          });
          toolResults.query = data;
          usedTools.push('query_tenant_data');
        }
      } else {
        answer = snap.error || 'Analytics unavailable for your role.';
      }
      // Blend knowledge for how-to flavored generals
      if (intent === 'general' && /how |what is|explain/.test(question.toLowerCase())) {
        answer = [
          retrieval.chunks.map((c) => `**${c.title}**\n${c.text}`).join('\n\n'),
          '',
          answer,
        ].join('\n');
      }
    } else if (intent === 'report') {
      const entity = detectReportEntity(question);
      const report = await generateInlineBrainReport(user, entity, { limit: 25 });
      toolResults.report = report;
      usedTools.push('generate_report');
      answer = report.ok ? report.markdown : report.error || 'Report failed';
    } else if (intent === 'query') {
      const qType = detectQueryType(question, matchedEntities);
      const data = await invokeBrainTool(user, 'query_tenant_data', {
        query_type: qType,
        limit: 15,
        detail_level: 'summary',
      });
      toolResults.query = data;
      usedTools.push('query_tenant_data');
      const payload = data?.data ?? data;
      if (qType === 'counts' && payload && typeof payload === 'object') {
        answer = [
          '**Live tenant counts** (authorized scope)',
          '',
          ...Object.entries(payload)
            .filter(([, v]) => typeof v === 'number' || (v && typeof v.total === 'number'))
            .map(([k, v]) => `• ${k}: **${typeof v === 'number' ? v : v.total}**`),
          '',
          '_From secure Brain tool query_tenant_data — not estimates._',
        ].join('\n');
      } else {
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        answer = [
          `**Query result · ${qType}** · **${rows.length}** row(s) in your scope`,
          '',
          ...rows.slice(0, 12).map((row, i) => {
            const name =
              row.companyName || row.title || row.fullName || row.name || row.candidateName || row.id || 'Record';
            return `${i + 1}. ${name} — ${row.status || row.stage || '—'}`;
          }),
          rows.length ? '' : '_No matching rows in your authorized scope._',
          '',
          '_Live tool result — Brain does not invent records._',
        ].join('\n');
      }
    } else if (intent === 'knowledge') {
      answer = [
        ...retrieval.chunks.map((c) => `**${c.title}**\n${c.text}`),
        '',
        matchedEntities.length
          ? `Related entities: ${matchedEntities
              .map((id) => getEntitySchema(id)?.label || id)
              .join(', ')}`
          : '',
        '',
        '_From Brain retrieval corpus + schema registry._',
      ]
        .filter(Boolean)
        .join('\n');
    } else if (intent === 'workflow_hint') {
      const workflows = await invokeBrainTool(user, 'list_workflows', {});
      toolResults.workflows = workflows;
      usedTools.push('list_workflows');
      if (input.executeWorkflow && typeof input.executeWorkflow === 'object') {
        const exec = await invokeBrainTool(user, 'execute_workflow', {
          ...input.executeWorkflow,
          confirm: input.executeWorkflow.confirm !== false,
        });
        toolResults.workflowResult = exec;
        usedTools.push('execute_workflow');
        answer = exec?.ok
          ? `**Workflow completed:** \`${input.executeWorkflow.action_type}\`\n\n${safeSerialize(exec).slice(0, 1200)}`
          : `**Workflow not executed:** ${exec?.error || exec?.message || 'failed'}`;
      } else {
        answer = [
          'I can run **approved workflows** when you confirm.',
          '',
          'Allowed actions:',
          ...(workflows.actions || []).map((a) => `• \`${a}\``),
          '',
          'Send `executeWorkflow: { action_type, payload, confirm: true }` with your ask to execute.',
          '',
          '_Writes are RBAC-gated and audited. Deletes are forbidden._',
        ].join('\n');
      }
    }

    // Optional LLM polish
    const llmAnswer = await optionalLlmSynthesize({
      question,
      contextBlock: retrieval.contextBlock,
      toolFacts: safeSerialize(toolResults).slice(0, 6000),
      memoryBlock,
    });
    if (llmAnswer) {
      answer = llmAnswer;
      usedTools.push('llm_synthesize');
    }

    if (!answer) {
      const snap = await buildTenantAnalyticsSnapshot(user);
      answer = snap.ok
        ? summarizeBusinessPerformance(snap.metrics)
        : helpText();
      usedTools.push('run_analytics');
    }
  } catch (error) {
    logBrainAction({
      user,
      action: 'brain.ask',
      status: 'error',
      inputSummary: question.slice(0, 300),
      outputSummary: String(error?.message || error),
      durationMs: Date.now() - started,
    });
    throw error;
  }

  const audit = logBrainAction({
    user,
    action: 'brain.ask',
    status: 'ok',
    entityIds: matchedEntities,
    inputSummary: question.slice(0, 400),
    outputSummary: answer.slice(0, 500),
    durationMs: Date.now() - started,
    meta: { intent, usedTools, sessionKey },
  });

  await saveBrainTurn({
    userId: user.id,
    sessionKey,
    pathname: input.pathname || null,
    priorMessages: input.messages,
    userMessage: question,
    assistantMessage: answer,
    memoryUpdate: {
      userIntent: intent,
      lastActions: usedTools,
      currentPageContext: String(input.pathname || ''),
    },
    actionLogItem: {
      action_id: audit.id,
      entity: matchedEntities[0] || 'brain',
      operation: intent,
      status: 'SUCCESS',
      createdAt: audit.at,
    },
  });

  return {
    reply: answer,
    intent,
    entities: matchedEntities,
    usedTools,
    retrieval: {
      chunkIds: retrieval.chunks.map((c) => c.id),
      entities: retrieval.entities,
    },
    toolResults,
    auditId: audit.id,
    llmEnabled: process.env.BRAIN_USE_LLM === 'true' && hasLlmProvider(),
    durationMs: Date.now() - started,
  };
}

export const brainOrchestrator = {
  runBrainAsk,
  detectIntent,
};
