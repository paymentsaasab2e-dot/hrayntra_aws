/**
 * Retrieval-Augmented Generation corpus for HRYANTRA platform knowledge.
 * Deterministic lexical retrieval (no fabricated facts). Extensible to vector embeddings later.
 */

import {
  buildSchemaKnowledgeText,
  getEntitySchema,
  listModules,
  matchEntitiesFromText,
} from '../schema/brainSchemaRegistry.service.js';

/** Curated platform knowledge chunks — facts only. */
const PLATFORM_CHUNKS = [
  {
    id: 'platform-overview',
    module: 'platform',
    title: 'HRYANTRA Phase 2 overview',
    text: 'HRYANTRA Phase 2 is a multi-tenant recruitment CRM ATS. Core flow: Leads → Clients → Jobs → Candidates → Interviews → Placements → Billing. Supporting modules: Pipeline, Matches, Tasks, Inbox, Contacts, Reports, Recycle Bin, Activity log, Team, Requests, Approvals, Settings.',
    tags: ['overview', 'platform', 'hryantra', 'ats', 'crm'],
  },
  {
    id: 'crm-flow',
    module: 'CRM',
    title: 'CRM lead to client',
    text: 'Leads capture prospects. Convert qualified leads into Clients. Clients own Jobs. Contacts attach to leads/clients. Follow-ups and tasks keep pipeline healthy.',
    tags: ['crm', 'lead', 'client', 'contact', 'follow-up'],
  },
  {
    id: 'recruitment-flow',
    module: 'Recruitment',
    title: 'Recruitment hiring flow',
    text: 'Jobs are openings under a Client. Candidates progress through stages (Pipeline). Matches suggest candidate↔job fit. Interviews schedule panels. Placements record hires and joining. Billing invoices from placements.',
    tags: ['recruitment', 'job', 'candidate', 'interview', 'placement', 'pipeline', 'matches'],
  },
  {
    id: 'analytics-reports',
    module: 'Analytics',
    title: 'Analytics and reports',
    text: 'Reports and Dashboard expose hiring KPIs, pipeline health, placements, and exports (CSV/Excel/PDF). The Brain may generate reports only from authorized live tenant queries — never invented numbers.',
    tags: ['reports', 'analytics', 'dashboard', 'kpi', 'export'],
  },
  {
    id: 'admin-security',
    module: 'Administration',
    title: 'Admin, roles, tenant isolation',
    text: 'Each company uses an isolated tenant database. Role-based access scopes records. The Brain enforces permissions before tool calls and never returns other tenants’ data.',
    tags: ['admin', 'team', 'roles', 'permissions', 'tenant', 'security'],
  },
  {
    id: 'hrms-lms-reserved',
    module: 'HRMS',
    title: 'HRMS / LMS extensibility',
    text: 'HRMS and LMS domains are reserved extension points in the Brain schema registry. Until those modules are mounted in Phase 2, the Brain states they are not available rather than inventing data.',
    tags: ['hrms', 'lms', 'learning', 'hr'],
  },
  {
    id: 'ai-credits',
    module: 'AI Credits',
    title: 'AI credits',
    text: 'AI credit metering is an extensible Brain domain. Usage of optional language models should be attributed per tenant when enabled via BRAIN_USE_LLM.',
    tags: ['ai', 'credits', 'usage', 'llm'],
  },
  {
    id: 'notifications',
    module: 'Administration',
    title: 'Notifications',
    text: 'Notifications deliver in-app alerts. Inbox is the communication queue. Brain can summarize unread patterns when notification APIs are permitted.',
    tags: ['notifications', 'inbox', 'alerts'],
  },
];

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function scoreChunk(chunk, tokens) {
  const hay = `${chunk.title} ${chunk.text} ${(chunk.tags || []).join(' ')}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += 2;
    if ((chunk.tags || []).some((tag) => tag.includes(t) || t.includes(tag))) score += 3;
  }
  return score;
}

/**
 * Retrieve top knowledge chunks + schema snippets for a question.
 * @returns {{ chunks: Array<{id:string;title:string;text:string;score:number}>; entities: string[]; schemaText: string; contextBlock: string }}
 */
export function retrievePlatformKnowledge(question, { limit = 5 } = {}) {
  const tokens = tokenize(question);
  const entities = matchEntitiesFromText(question);

  const scored = PLATFORM_CHUNKS.map((chunk) => ({
    ...chunk,
    score: scoreChunk(chunk, tokens),
  }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Always include schema facts for matched entities
  const schemaBits = [];
  for (const eid of entities) {
    const e = getEntitySchema(eid);
    if (!e) continue;
    schemaBits.push(
      `${e.label}: ${e.description} Fields: ${e.fields.map((f) => f.name).join(', ')}. Relations: ${e.relations
        .map((r) => `${r.to}(${r.via})`)
        .join(', ') || 'none'}.`,
    );
  }

  if (!scored.length) {
    scored.push({
      ...PLATFORM_CHUNKS[0],
      score: 1,
    });
  }

  const schemaText = schemaBits.length ? schemaBits.join('\n') : buildSchemaKnowledgeText().slice(0, 2500);

  const contextBlock = [
    '### Retrieved platform knowledge (authoritative)',
    ...scored.map((c) => `- ${c.title}: ${c.text}`),
    '',
    '### Schema facts',
    schemaText,
    '',
    `### Modules catalog: ${listModules()
      .map((m) => m.label)
      .join(', ')}`,
    '',
    'RULE: Answer only with retrieved knowledge + live tool results. Never fabricate records or metrics.',
  ].join('\n');

  return {
    chunks: scored.map(({ id, title, text, score, module }) => ({ id, title, text, score, module })),
    entities,
    schemaText,
    contextBlock,
  };
}

export const brainRetrieval = {
  retrievePlatformKnowledge,
  PLATFORM_CHUNKS,
};
