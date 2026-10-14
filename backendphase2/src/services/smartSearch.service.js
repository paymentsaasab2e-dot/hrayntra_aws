import { chatCompletionWithFallback, hasLlmProvider } from './llmChatFallback.service.js';
import { env } from '../config/env.js';
import { ENTITY_TENANT_LOADERS } from './smartSearchTenantContext.service.js';
import { SMART_SEARCH_LIGHT_LOADERS } from './smartSearchLightContext.service.js';
import { executeSmartSearchDbQuery } from './smartSearchDbQuery.service.js';
import { buildEntityInstructionsFromSchema } from './smartSearchSchema.config.js';

const SMART_SEARCH_ENTITIES = new Set([
  'leads',
  'jobs',
  'clients',
  'candidates',
  'interviews',
  'placements',
]);

const smartSearchJsonSchema = {
  name: 'smart_search_parse',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      keywords: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: {
              type: 'string',
              enum: [
                'status',
                'source',
                'stage',
                'recruiter',
                'client',
                'mode',
                'round',
                'priority',
                'employment',
                'text',
              ],
            },
            value: { type: 'string' },
            label: { type: 'string' },
          },
          required: ['kind', 'value', 'label'],
        },
      },
      filters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string' },
          source: { type: 'string' },
          recruiterId: { type: 'string' },
          clientId: { type: 'string' },
          companyId: { type: 'string' },
          activeTab: { type: 'string' },
          priority: { type: 'string' },
          ownerScope: { type: 'string' },
          stage: { type: 'string' },
          ownerId: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string' },
          jobId: { type: 'string' },
          experienceRange: { type: 'string' },
          round: { type: 'string' },
          mode: { type: 'string' },
          interviewer: { type: 'string' },
          clientJob: { type: 'string' },
          employmentType: { type: 'string' },
          searchText: { type: 'string' },
        },
        required: [
          'status',
          'source',
          'recruiterId',
          'clientId',
          'companyId',
          'activeTab',
          'priority',
          'ownerScope',
          'stage',
          'ownerId',
          'company',
          'location',
          'jobId',
          'experienceRange',
          'round',
          'mode',
          'interviewer',
          'clientJob',
          'employmentType',
          'searchText',
        ],
      },
      summary: { type: 'string' },
    },
    required: ['keywords', 'filters', 'summary'],
  },
  strict: true,
};

const ENTITY_INSTRUCTIONS = Object.fromEntries(
  ['leads', 'jobs', 'clients', 'candidates', 'interviews', 'placements'].map((key) => [
    key,
    buildEntityInstructionsFromSchema(key),
  ]),
);

function normalizeKeyword(chip) {
  const kind = String(chip?.kind || 'text').trim();
  const value = String(chip?.value || '').trim();
  const label = String(chip?.label || value).trim() || value;
  if (!value) return null;
  const allowed = smartSearchJsonSchema.schema.properties.keywords.items.properties.kind.enum;
  const safeKind = allowed.includes(kind) ? kind : 'text';
  return { kind: safeKind, value, label };
}

function normalizeFilters(raw = {}) {
  const keys = smartSearchJsonSchema.schema.properties.filters.required;
  const out = {};
  for (const key of keys) {
    out[key] = typeof raw[key] === 'string' ? raw[key].trim() : '';
  }
  return out;
}

/** If the model left searchText empty, keep the prompt words so DB search still runs. */
function ensureFiltersHaveSearchText(filters, keywords, prompt) {
  const current = String(filters?.searchText || '').trim();
  if (current) return filters;
  const fromKeywords = (Array.isArray(keywords) ? keywords : [])
    .filter((chip) => chip && String(chip.kind || 'text') === 'text')
    .map((chip) => String(chip.value || chip.label || '').trim())
    .filter(Boolean)
    .join(' ');
  const searchText = fromKeywords || String(prompt || '').trim();
  return { ...filters, searchText };
}

function buildSummary(keywords, entity) {
  if (!keywords.length) {
    return `No keywords detected — matching full prompt in ${entity}`;
  }
  return `Found ${keywords.length} keyword${keywords.length === 1 ? '' : 's'} — showing matching ${entity}`;
}

/**
 * Smart search: fast AI parse (mini model, prompt only) in parallel with
 * tenant name→id maps, then one DB query. Do not dump the candidate table into GPT.
 */
export async function parseSmartSearchPrompt({ entity, prompt, context = {}, req = null }) {
  const normalizedEntity = String(entity || '').trim().toLowerCase();
  if (!SMART_SEARCH_ENTITIES.has(normalizedEntity)) {
    throw new Error(`Unsupported smart search entity: ${entity}`);
  }

  const trimmedPrompt = String(prompt || '').trim();
  if (!trimmedPrompt) {
    return {
      keywords: [],
      filters: normalizeFilters(),
      summary: 'Enter a prompt first.',
      source: 'local',
    };
  }

  if (!hasLlmProvider()) {
    throw new Error('No LLM provider configured (set OPENAI_API_KEY or MISTRAL_API_KEY)');
  }

  const entityConfig = ENTITY_TENANT_LOADERS[normalizedEntity];
  const lightLoader = SMART_SEARCH_LIGHT_LOADERS[normalizedEntity];
  const instructions = ENTITY_INSTRUCTIONS[normalizedEntity];
  const started = Date.now();

  const lightPromise =
    lightLoader && req
      ? lightLoader(req).catch((err) => {
          console.warn('[smart-search] light context failed', err?.message || err);
          return null;
        })
      : Promise.resolve(null);

  const llmPromise = chatCompletionWithFallback(
    {
      model: env.SMART_SEARCH_CHAT_MODEL || 'gpt-4.1-mini',
      temperature: 0,
      max_tokens: 400,
      response_format: {
        type: 'json_schema',
        json_schema: smartSearchJsonSchema,
      },
      messages: [
        {
          role: 'system',
          content: [
            'You parse recruitment CRM smart-search prompts into structured filters.',
            'Return only JSON matching the schema. Unused filter fields must be empty strings.',
            'Do NOT search records. The server runs the database query.',
            'Put skills, titles, and other free text in filters.searchText and text keywords.',
            'Put city/country in filters.location (example: Bangalore), not only in searchText.',
            'Put recruiter or owner names in filters.ownerId (name is OK; server maps to id).',
            'Put job titles in filters.jobId (title is OK; server maps to id).',
            'Put pipeline stage in filters.stage when the user names a stage.',
            instructions,
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({ entity: normalizedEntity, prompt: trimmedPrompt }),
        },
      ],
    },
    `smart-search-${normalizedEntity}`,
  );

  const [completion, lightContext] = await Promise.all([llmPromise, lightPromise]);
  const llmMs = Date.now() - started;

  const raw = completion?.choices?.[0]?.message?.content;
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('Smart search AI returned invalid JSON');
  }

  let keywords = (Array.isArray(parsed?.keywords) ? parsed.keywords : [])
    .map(normalizeKeyword)
    .filter(Boolean);

  let filters = normalizeFilters(parsed?.filters);

  const matchingIdsResult = {};
  let matchCount = 0;
  let useFiltersOnly = false;

  if (entityConfig && req) {
    const normalized = entityConfig.normalize(filters, keywords, lightContext || {});
    filters = normalizeFilters(normalized.filters);
    keywords = normalized.keywords.map(normalizeKeyword).filter(Boolean);
    filters = ensureFiltersHaveSearchText(filters, keywords, trimmedPrompt);

    const dbResult = await executeSmartSearchDbQuery(normalizedEntity, filters, req);
    matchCount = dbResult.matchCount;
    useFiltersOnly = dbResult.useFiltersOnly;

    if (dbResult.matchingIdsField && dbResult.matchingIds.length > 0) {
      matchingIdsResult[dbResult.matchingIdsField] = dbResult.matchingIds;
    }
  }

  let summary =
    typeof parsed?.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : buildSummary(keywords, normalizedEntity);

  if (matchCount > 0) {
    const label = normalizedEntity.endsWith('s')
      ? normalizedEntity.slice(0, -1)
      : normalizedEntity;
    if (useFiltersOnly) {
      summary = `Matched ${matchCount} ${label}${matchCount === 1 ? '' : 's'} from your database (using filters)`;
    } else {
      summary = `Matched ${matchCount} ${label}${matchCount === 1 ? '' : 's'} from your database`;
    }
  } else if (keywords.length > 0) {
    summary = `No ${normalizedEntity} matched — try adjusting your prompt`;
  }

  console.info('[smart-search] parse', {
    entity: normalizedEntity,
    prompt: trimmedPrompt.slice(0, 60),
    matchCount,
    llmMs,
    totalMs: Date.now() - started,
    model: env.SMART_SEARCH_CHAT_MODEL,
  });

  return {
    keywords,
    filters,
    ...matchingIdsResult,
    matchCount,
    useFiltersOnly,
    summary,
    source: 'ai',
    searchMode: 'ai_parse_db_query',
    tenantDatabase: lightContext
      ? {
          tenantDbName: lightContext.tenantDbName,
          totalRecords:
            lightContext.totalLeads ??
            lightContext.totalJobs ??
            lightContext.totalClients ??
            lightContext.totalCandidates ??
            lightContext.totalInterviews ??
            lightContext.totalPlacements,
          searchMode: 'ai_parse_db_query',
        }
      : undefined,
  };
}
