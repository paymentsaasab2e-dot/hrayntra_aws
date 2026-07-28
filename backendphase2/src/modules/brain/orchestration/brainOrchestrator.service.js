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
import { assertPermission, filterEntitiesForUser } from '../permissions/brainPermissions.service.js';
import { invokeBrainTool } from '../tools/brainTools.registry.js';
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
    'Try: “Summarize business performance”, “Report on open jobs”, “How many candidates?”, “Show schema for placements”.',
  ].join('\n');
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
