/**
 * Enterprise Brain — schema & relationship registry.
 * Auto-describes Phase 2 modules, entities, keys, and cross-module links.
 * Used by retrieval + orchestration so the Brain never invents schema.
 */

/** @typedef {{ name: string; type: string; description?: string; pii?: boolean }} SchemaField */
/** @typedef {{
 *  id: string;
 *  module: string;
 *  prismaModel: string;
 *  label: string;
 *  description: string;
 *  primaryKey: string;
 *  fields: SchemaField[];
 *  relations: Array<{ to: string; type: '1:1'|'1:n'|'n:1'|'n:n'; via: string; description: string }>;
 *  permissions: string[];
 *  queryTypes: string[];
 * }} EntitySchema */

/** @type {EntitySchema[]} */
export const ENTITY_SCHEMAS = [
  {
    id: 'lead',
    module: 'CRM',
    prismaModel: 'Lead',
    label: 'Leads',
    description: 'Prospect companies before conversion to clients.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'companyName', type: 'String' },
      { name: 'status', type: 'String' },
      { name: 'priority', type: 'String' },
      { name: 'industry', type: 'String' },
      { name: 'assignedToId', type: 'ObjectId' },
      { name: 'nextFollowUp', type: 'DateTime' },
      { name: 'email', type: 'String', pii: true },
      { name: 'phone', type: 'String', pii: true },
    ],
    relations: [
      { to: 'client', type: '1:1', via: 'conversion', description: 'Lead converts to Client' },
      { to: 'contact', type: '1:n', via: 'contacts', description: 'Lead contacts' },
      { to: 'task', type: '1:n', via: 'relatedEntity', description: 'Follow-up tasks' },
    ],
    permissions: ['leads_read', 'leads_write'],
    queryTypes: ['counts', 'leads', 'lead_by_id'],
  },
  {
    id: 'client',
    module: 'CRM',
    prismaModel: 'Client',
    label: 'Clients',
    description: 'Hiring company accounts.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'companyName', type: 'String' },
      { name: 'status', type: 'String' },
      { name: 'industry', type: 'String' },
      { name: 'assignedToId', type: 'ObjectId' },
    ],
    relations: [
      { to: 'job', type: '1:n', via: 'clientId', description: 'Client opens Jobs' },
      { to: 'placement', type: '1:n', via: 'clientId', description: 'Client placements' },
      { to: 'contact', type: '1:n', via: 'clientId', description: 'Client contacts' },
    ],
    permissions: ['clients_read', 'clients_write'],
    queryTypes: ['counts', 'clients', 'client_by_id'],
  },
  {
    id: 'job',
    module: 'Recruitment',
    prismaModel: 'Job',
    label: 'Jobs',
    description: 'Openings / requisitions linked to clients.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'title', type: 'String' },
      { name: 'status', type: 'String' },
      { name: 'clientId', type: 'ObjectId' },
      { name: 'location', type: 'String' },
      { name: 'assignedToId', type: 'ObjectId' },
    ],
    relations: [
      { to: 'client', type: 'n:1', via: 'clientId', description: 'Job belongs to Client' },
      { to: 'candidate', type: '1:n', via: 'jobId / pipeline', description: 'Candidates on job' },
      { to: 'interview', type: '1:n', via: 'jobId', description: 'Interviews for job' },
      { to: 'placement', type: '1:n', via: 'jobId', description: 'Placements from job' },
    ],
    permissions: ['jobs_read', 'jobs_write'],
    queryTypes: ['counts', 'jobs', 'job_by_id'],
  },
  {
    id: 'candidate',
    module: 'Recruitment',
    prismaModel: 'Candidate',
    label: 'Candidates',
    description: 'Talent profiles progressing through hiring stages.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'fullName', type: 'String', pii: true },
      { name: 'email', type: 'String', pii: true },
      { name: 'phone', type: 'String', pii: true },
      { name: 'stage', type: 'String' },
      { name: 'status', type: 'String' },
      { name: 'assignedToId', type: 'ObjectId' },
    ],
    relations: [
      { to: 'job', type: 'n:1', via: 'jobId', description: 'Candidate linked to Job' },
      { to: 'interview', type: '1:n', via: 'candidateId', description: 'Candidate interviews' },
      { to: 'placement', type: '1:1', via: 'candidateId', description: 'Hired placement' },
    ],
    permissions: ['candidates_read', 'candidates_write'],
    queryTypes: ['counts', 'candidates', 'candidate_by_id'],
  },
  {
    id: 'interview',
    module: 'Recruitment',
    prismaModel: 'Interview',
    label: 'Interviews',
    description: 'Scheduled panels and outcomes.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'scheduledAt', type: 'DateTime' },
      { name: 'status', type: 'String' },
      { name: 'candidateId', type: 'ObjectId' },
      { name: 'jobId', type: 'ObjectId' },
      { name: 'interviewerId', type: 'ObjectId' },
    ],
    relations: [
      { to: 'candidate', type: 'n:1', via: 'candidateId', description: 'Interview for candidate' },
      { to: 'job', type: 'n:1', via: 'jobId', description: 'Interview for job' },
    ],
    permissions: ['interviews_read', 'interviews_write'],
    queryTypes: ['counts', 'interviews', 'interview_by_id'],
  },
  {
    id: 'placement',
    module: 'Recruitment',
    prismaModel: 'Placement',
    label: 'Placements',
    description: 'Hires / joiners; feeds billing.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'status', type: 'String' },
      { name: 'joiningDate', type: 'DateTime' },
      { name: 'candidateId', type: 'ObjectId' },
      { name: 'clientId', type: 'ObjectId' },
      { name: 'jobId', type: 'ObjectId' },
      { name: 'recruiterId', type: 'ObjectId' },
    ],
    relations: [
      { to: 'candidate', type: 'n:1', via: 'candidateId', description: 'Placed candidate' },
      { to: 'client', type: 'n:1', via: 'clientId', description: 'Hiring client' },
      { to: 'job', type: 'n:1', via: 'jobId', description: 'Source job' },
      { to: 'billing', type: '1:n', via: 'placementId', description: 'Invoices from placement' },
    ],
    permissions: ['placements_read', 'placements_write'],
    queryTypes: ['counts', 'placements', 'placement_by_id'],
  },
  {
    id: 'task',
    module: 'Operations',
    prismaModel: 'Task',
    label: 'Tasks & Activities',
    description: 'To-dos linked to CRM/recruitment records.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'title', type: 'String' },
      { name: 'priority', type: 'String' },
      { name: 'status', type: 'String' },
      { name: 'dueDate', type: 'DateTime' },
      { name: 'assignedToId', type: 'ObjectId' },
    ],
    relations: [
      { to: 'lead', type: 'n:1', via: 'relatedEntity', description: 'Task on lead' },
      { to: 'client', type: 'n:1', via: 'relatedEntity', description: 'Task on client' },
    ],
    permissions: ['tasks_read', 'tasks_write'],
    queryTypes: ['counts', 'tasks'],
  },
  {
    id: 'notification',
    module: 'Administration',
    prismaModel: 'Notification',
    label: 'Notifications',
    description: 'In-app alerts and communication queue.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'title', type: 'String' },
      { name: 'read', type: 'Boolean' },
      { name: 'userId', type: 'ObjectId' },
    ],
    relations: [],
    permissions: ['notifications_read'],
    queryTypes: [],
  },
  {
    id: 'report',
    module: 'Analytics',
    prismaModel: 'Report',
    label: 'Reports',
    description: 'Saved / generated analytics exports.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'name', type: 'String' },
      { name: 'type', type: 'String' },
    ],
    relations: [],
    permissions: ['reports_read', 'export_data'],
    queryTypes: [],
  },
  {
    id: 'team_user',
    module: 'Administration',
    prismaModel: 'User',
    label: 'Team',
    description: 'Tenant users, roles, and access.',
    primaryKey: 'id',
    fields: [
      { name: 'id', type: 'ObjectId' },
      { name: 'email', type: 'String', pii: true },
      { name: 'name', type: 'String', pii: true },
      { name: 'role', type: 'String' },
      { name: 'isActive', type: 'Boolean' },
    ],
    relations: [],
    permissions: ['team_read'],
    queryTypes: ['team_users'],
  },
];

const MODULE_GROUPS = [
  {
    id: 'crm',
    label: 'CRM',
    entities: ['lead', 'client'],
    description: 'Lead capture → client accounts.',
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    entities: ['job', 'candidate', 'interview', 'placement'],
    description: 'Jobs → candidates → interviews → placements.',
  },
  {
    id: 'operations',
    label: 'Operations',
    entities: ['task', 'notification'],
    description: 'Daily work queues.',
  },
  {
    id: 'analytics',
    label: 'Analytics & Reports',
    entities: ['report'],
    description: 'KPIs, exports, performance summaries.',
  },
  {
    id: 'administration',
    label: 'Administration',
    entities: ['team_user'],
    description: 'Team, roles, org settings.',
  },
  {
    id: 'hrms',
    label: 'HRMS',
    entities: [],
    description: 'HRMS domain (extensible — Phase 2 hooks reserved).',
  },
  {
    id: 'lms',
    label: 'LMS',
    entities: [],
    description: 'Learning management (extensible — Phase 2 hooks reserved).',
  },
  {
    id: 'ai_credits',
    label: 'AI Credits',
    entities: [],
    description: 'AI usage / credit metering (extensible).',
  },
];

export function listEntities() {
  return ENTITY_SCHEMAS.map((e) => ({
    id: e.id,
    module: e.module,
    label: e.label,
    description: e.description,
    prismaModel: e.prismaModel,
  }));
}

export function getEntitySchema(entityId) {
  return ENTITY_SCHEMAS.find((e) => e.id === entityId || e.prismaModel === entityId) || null;
}

export function listModules() {
  return MODULE_GROUPS;
}

export function discoverRelationships(entityId) {
  const entity = getEntitySchema(entityId);
  if (!entity) return [];
  return entity.relations.map((r) => ({
    from: entity.id,
    ...r,
    toSchema: getEntitySchema(r.to),
  }));
}

/** Compact text for RAG / system context — facts only, never fabricated counts. */
export function buildSchemaKnowledgeText() {
  const lines = [
    'HRYANTRA Phase 2 schema map (authoritative — do not invent tables/fields):',
    '',
  ];
  for (const mod of MODULE_GROUPS) {
    lines.push(`## ${mod.label}`);
    lines.push(mod.description);
    for (const eid of mod.entities) {
      const e = getEntitySchema(eid);
      if (!e) continue;
      lines.push(
        `- ${e.label} (${e.prismaModel}): ${e.description}. PK=${e.primaryKey}. Relations: ${
          e.relations.map((r) => `${r.to} via ${r.via}`).join(', ') || 'none'
        }.`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function matchEntitiesFromText(text) {
  const q = String(text || '').toLowerCase();
  const hits = [];
  for (const e of ENTITY_SCHEMAS) {
    const aliases = [e.id, e.label, e.prismaModel, e.module].map((s) => String(s).toLowerCase());
    if (aliases.some((a) => q.includes(a.toLowerCase()) || q.includes(a.replace(/s$/, '')))) {
      hits.push(e.id);
    }
  }
  // keyword extras
  if (/follow[- ]?up|prospect/.test(q) && !hits.includes('lead')) hits.push('lead');
  if (/pipeline|match|matching/.test(q) && !hits.includes('candidate')) hits.push('candidate');
  if (/invoice|billing|commission/.test(q) && !hits.includes('placement')) hits.push('placement');
  if (/overdue|todo|to-do/.test(q) && !hits.includes('task')) hits.push('task');
  return [...new Set(hits)];
}

export const brainSchemaRegistry = {
  listEntities,
  getEntitySchema,
  listModules,
  discoverRelationships,
  buildSchemaKnowledgeText,
  matchEntitiesFromText,
  ENTITY_SCHEMAS,
};
