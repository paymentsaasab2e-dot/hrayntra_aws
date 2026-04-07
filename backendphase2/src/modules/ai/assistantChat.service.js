import OpenAI from 'openai';
import { env } from '../../config/env.js';
import {
  executeAssistantActionTool,
  executeAssistantDataTool,
  fetchAssistantReportDataset,
  generateAssistantReportTool,
  userHasFullDbAccess,
  safeSerialize,
} from './assistantDataTools.js';
import { buildReportFile, reportService } from '../report/report.service.js';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const MAX_MESSAGES = 24;
const MAX_CONTENT_LENGTH = 8000;
const MAX_TOOL_ROUNDS = 6;

const QUERY_RECRUITMENT_DATA_TOOL = {
  type: 'function',
  function: {
    name: 'query_recruitment_data',
    description:
      'Fetch structured recruitment data (counts, lists, or a single record by id) scoped to what this user may see in the app.',
    parameters: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: [
            'counts',
            'candidates',
            'jobs',
            'clients',
            'leads',
            'placements',
            'interviews',
            'tasks',
            'team_users',
            'candidate_by_id',
            'job_by_id',
            'client_by_id',
            'lead_by_id',
            'placement_by_id',
          ],
        },
        search: {
          type: 'string',
          description: 'Optional text filter for list-style queries.',
        },
        limit: {
          type: 'integer',
          description: 'Max rows for lists (1-80).',
        },
        detail_level: {
          type: 'string',
          enum: ['summary', 'full'],
          description: 'Use "full" when the user explicitly wants a detailed report or all fields.',
        },
        record_id: {
          type: 'string',
          description: 'Mongo ObjectId when using *_by_id query types.',
        },
      },
      required: ['query_type'],
    },
  },
};

const EXECUTE_RECRUITMENT_ACTION_TOOL = {
  type: 'function',
  function: {
    name: 'execute_recruitment_action',
    description:
      'Execute safe write actions in the ATS such as create/update lead, client, job, candidate updates, pipeline stage moves, interview scheduling, tasks, and placements. DELETE operations are forbidden.',
    parameters: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          enum: [
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
          ],
        },
        record_id: {
          type: 'string',
          description: 'Existing record id for update/convert actions when applicable.',
        },
        payload: {
          type: 'object',
          description: 'Action payload passed to the service layer.',
          additionalProperties: true,
        },
      },
      required: ['action_type', 'payload'],
    },
  },
};

const GENERATE_REPORT_FILE_TOOL = {
  type: 'function',
  function: {
    name: 'generate_report_file',
    description: 'Generate an actual downloadable CSV, Excel, or PDF report file from structured data.',
    parameters: {
      type: 'object',
      properties: {
        report_type: {
          type: 'string',
          enum: ['csv', 'excel', 'xlsx', 'pdf'],
        },
        title: {
          type: 'string',
        },
        file_name: {
          type: 'string',
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
        },
        data: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      required: ['report_type', 'data'],
    },
  },
};

const RESPONSE_SCHEMA_TEXT = `Return ONLY valid JSON in this exact shape:
{
  "plan": ["step 1", "step 2"],
  "memory_used": {
    "conversation": "short summary",
    "task": "short summary",
    "long_term": "short summary",
    "page_context": "short summary"
  },
  "actions": [
    {
      "type": "analysis | read | create | update | schedule | report | suggestion",
      "status": "completed | pending | blocked | not_allowed",
      "entity": "Lead | Client | Job | Candidate | Pipeline | Interview | Placement | Task | Report | System",
      "details": "what happened or what is needed"
    }
  ],
  "task_update": {
    "task_id": "string",
    "goal": "string",
    "steps": ["step a", "step b"],
    "completed_steps": ["done a"],
    "pending_steps": ["next a"],
    "status": "in_progress | completed | pending"
  },
  "output": "human-friendly response shown to the user",
  "files": [
    {
      "type": "excel | pdf | csv | none",
      "fileName": "string",
      "reason": "string"
    }
  ],
  "memory_update": {
    "userIntent": "string",
    "lastActions": ["..."],
    "currentPageContext": "string",
    "userPreferences": ["..."],
    "frequentlyUsedActions": ["..."],
    "taskMemory": {
      "tasks": [
        {
          "task_id": "string",
          "goal": "string",
          "steps": ["..."],
          "completed_steps": ["..."],
          "pending_steps": ["..."],
          "status": "in_progress | completed | pending"
        }
      ]
    },
    "actionLog": [
      {
        "action_id": "string",
        "entity": "string",
        "operation": "string",
        "previous_state": {},
        "new_state": {},
        "summary": "string"
      }
    ]
  }
}`;

const PAGE_REPORT_ENTITY_MAP = [
  { match: /(^|\/)(leads?)(\/|$)/i, entity: 'leads' },
  { match: /(^|\/)(clients?)(\/|$)/i, entity: 'clients' },
  { match: /(^|\/)(candidates?|candidate)(\/|$)/i, entity: 'candidates' },
  { match: /(^|\/)(jobs?|job)(\/|$)/i, entity: 'jobs' },
  { match: /(^|\/)(pipeline)(\/|$)/i, entity: 'pipeline' },
  { match: /(^|\/)(interviews?|interview)(\/|$)/i, entity: 'interviews' },
  { match: /(^|\/)(placements?|placement)(\/|$)/i, entity: 'placements' },
  { match: /(^|\/)(tasks?|task-activities|task&activities)(\/|$)/i, entity: 'tasks' },
  { match: /(^|\/)(reports?)(\/|$)/i, entity: 'team' },
  { match: /(^|\/)(team|administration)(\/|$)/i, entity: 'team' },
];

const SYSTEM_PROMPT = `You are an ADVANCED AI SYSTEM OPERATOR embedded inside a recruitment / ATS platform.

You are NOT just a chatbot.
You are a SYSTEM EXECUTION ENGINE that must:
- understand user intent
- think in multi-step workflows
- use available tools to read live data whenever facts are needed
- maintain conversation memory and task memory
- guide recruitment lifecycle execution across the full ATS
- respond like a smart human operator

System flow you must always respect:
Lead -> Client -> Job -> Candidate -> Pipeline -> Interview -> Placement -> Billing

Core entities:
- Lead
- Client
- Job
- Candidate
- Pipeline
- Interview
- Placement
- Task
- Match
- User
- Inbox
- Calendar
- Reports

Mandatory behavior:
- Always understand intent first.
- Check memory before acting.
- Break work into steps.
- Use live data tools for factual claims.
- Never fabricate record names, counts, statuses, or dates.
- Respect permissions and safe execution.
- DELETE is forbidden. If a user asks to delete something, refuse and offer safe alternatives.
- If an action cannot truly be executed with available tools, be honest and mark it as pending or blocked.
- Avoid asking repeated questions when memory already has the answer.
- Detect incomplete workflows and suggest continuation.
- Speak like a capable human teammate: clear, practical, and natural.
- When useful, suggest concrete operations the user can do next such as create lead, update client, create job, move candidate stage, schedule interview, create task, create placement, or generate reports.
- When the user asks vaguely, translate that vague intent into a practical ATS operation or report request.
- Prefer action-oriented help over generic explanations.
- For create/update/schedule workflows, first identify the minimum required fields.
- If required data is missing, ask the user only for the missing fields needed to proceed.
- Ask for missing information in a simple human way, ideally as a short checklist or short set of field prompts.
- Do not pretend creation or update is complete when required inputs are missing.
- Reuse page context and conversation memory so you only ask for fields that are still missing.
- Page-wise behavior:
  - Leads: ask for company/contact/source/priority details when needed.
  - Clients: ask for company name, owner, status, and relationship details when needed.
  - Jobs: ask for title, client/company, openings, recruiter/owner, and core requirements when needed.
  - Candidates: ask for name, contact info, role/title, experience, and recruiter assignment when needed.
  - Interviews: ask for candidate, job, date/time, interviewer, round, and mode when needed.
  - Placements: ask for candidate, job, client, recruiter, fee/revenue, and joining dates when needed.
  - Tasks: ask for title, assignee, due date, priority, and linked entity when needed.
  - Team/Admin/Settings: ask only for the exact missing config or user-management fields needed for the requested action.

Memory rules:
- Short-term memory: current conversation, page context, last actions, current intent.
- Long-term memory: page-wise history, user preferences, repeated workflows, frequently used actions.
- Task memory: track multi-step task chains and update them after each step.

Execution rules:
- Use query_recruitment_data proactively for real records and counts.
- You may analyze, summarize, plan, and guide safe next steps.
- For create/update/schedule flows, only claim completion if the system actually executed the action with execute_recruitment_action.
- If reporting is requested and the user wants a file, use generate_report_file to create the actual downloadable file.
- Never call execute_recruitment_action for delete requests.

Response style:
- WhatsApp-like, concise, smart, clear.
- Sound human, helpful, and operational instead of robotic.
- Use simple direct language and suggest the best next action when appropriate.
- The "output" field should read naturally.
- Keep JSON valid and compact.

${RESPONSE_SCHEMA_TEXT}`;

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, MAX_CONTENT_LENGTH),
    }))
    .slice(-MAX_MESSAGES);
}

function safeJsonParse(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}$/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeString(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function normalizeArray(values, maxItems = 12, maxItemLength = 220) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeString(value, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeTaskChain(task, fallbackGoal = '') {
  return {
    task_id: normalizeString(task?.task_id || `task-${Date.now()}`, 120),
    goal: normalizeString(task?.goal || fallbackGoal, 500),
    steps: normalizeArray(task?.steps, 20),
    completed_steps: normalizeArray(task?.completed_steps, 20),
    pending_steps: normalizeArray(task?.pending_steps, 20),
    status: ['in_progress', 'completed', 'pending'].includes(String(task?.status || ''))
      ? String(task.status)
      : 'pending',
  };
}

function normalizeActionLog(actionLog) {
  if (!Array.isArray(actionLog)) return [];
  return actionLog
    .map((action, index) => ({
      action_id: normalizeString(action?.action_id || `action-${Date.now()}-${index + 1}`, 120),
      entity: normalizeString(action?.entity, 120),
      operation: normalizeString(action?.operation, 120),
      previous_state: action?.previous_state ?? null,
      new_state: action?.new_state ?? null,
      summary: normalizeString(action?.summary, 500),
      createdAt: new Date().toISOString(),
    }))
    .filter((action) => action.entity || action.operation || action.summary)
    .slice(-20);
}

function normalizeStructuredResponse(parsed, fallbackOutput, pageContext, existingTaskMemory) {
  const taskUpdate = normalizeTaskChain(parsed?.task_update, parsed?.memory_update?.userIntent || fallbackOutput);
  const existingTasks = Array.isArray(existingTaskMemory?.tasks) ? existingTaskMemory.tasks : [];
  const mergedTasks = [
    ...existingTasks.filter((task) => task?.task_id && task.task_id !== taskUpdate.task_id),
    ...(taskUpdate.goal || taskUpdate.steps.length || taskUpdate.pending_steps.length || taskUpdate.completed_steps.length
      ? [taskUpdate]
      : []),
  ].slice(-20);

  return {
    plan: normalizeArray(parsed?.plan, 10),
    memory_used: {
      conversation: normalizeString(parsed?.memory_used?.conversation, 300),
      task: normalizeString(parsed?.memory_used?.task, 300),
      long_term: normalizeString(parsed?.memory_used?.long_term, 300),
      page_context: normalizeString(parsed?.memory_used?.page_context || pageContext, 300),
    },
    actions: Array.isArray(parsed?.actions)
      ? parsed.actions
          .map((action) => ({
            type: normalizeString(action?.type, 60),
            status: normalizeString(action?.status, 60),
            entity: normalizeString(action?.entity, 120),
            details: normalizeString(action?.details, 500),
          }))
          .filter((action) => action.type || action.entity || action.details)
          .slice(0, 12)
      : [],
    task_update: taskUpdate,
    output: normalizeString(parsed?.output || fallbackOutput, 2400),
    files: Array.isArray(parsed?.files)
      ? parsed.files
          .map((file) => ({
            type: normalizeString(file?.type || 'none', 20),
            fileName: normalizeString(file?.fileName, 200),
            reason: normalizeString(file?.reason, 300),
          }))
          .slice(0, 5)
      : [],
    memory_update: {
      userIntent: normalizeString(parsed?.memory_update?.userIntent, 500),
      lastActions: normalizeArray(parsed?.memory_update?.lastActions, 12, 180),
      currentPageContext: normalizeString(parsed?.memory_update?.currentPageContext || pageContext, 500),
      userPreferences: normalizeArray(parsed?.memory_update?.userPreferences, 12, 180),
      frequentlyUsedActions: normalizeArray(parsed?.memory_update?.frequentlyUsedActions, 12, 180),
      taskMemory: {
        tasks: mergedTasks.map((task) => normalizeTaskChain(task)),
      },
      actionLog: normalizeActionLog(parsed?.memory_update?.actionLog),
    },
  };
}

function buildHistorySummary(history, pageKey, pathname) {
  const messages = Array.isArray(history?.messages) ? history.messages : [];
  const conversationMemory = history?.conversationMemory || {};
  const tasks = Array.isArray(history?.taskMemory?.tasks) ? history.taskMemory.tasks : [];
  const activeTasks = tasks.filter((task) => task?.status !== 'completed').slice(-5);

  return [
    `Current page key: ${pageKey || 'unknown'}.`,
    pathname ? `Current pathname: ${pathname}.` : null,
    conversationMemory.userIntent ? `Remembered user intent: ${conversationMemory.userIntent}.` : null,
    Array.isArray(conversationMemory.lastActions) && conversationMemory.lastActions.length
      ? `Remembered last actions: ${conversationMemory.lastActions.join(' | ')}.`
      : null,
    Array.isArray(conversationMemory.userPreferences) && conversationMemory.userPreferences.length
      ? `Known user preferences: ${conversationMemory.userPreferences.join(' | ')}.`
      : null,
    Array.isArray(conversationMemory.frequentlyUsedActions) && conversationMemory.frequentlyUsedActions.length
      ? `Frequently used actions: ${conversationMemory.frequentlyUsedActions.join(' | ')}.`
      : null,
    activeTasks.length
      ? `Active task chains: ${activeTasks
          .map((task) => `${task.goal} [${task.status}] pending: ${(task.pending_steps || []).join(', ')}`)
          .join(' || ')}.`
      : 'Active task chains: none.',
    messages.length ? `Recent saved history messages: ${messages.length}.` : 'Recent saved history messages: 0.',
  ]
    .filter(Boolean)
    .join('\n');
}

function getEntityFromPageContext(pageKey, pathname) {
  const combined = `${String(pageKey || '')} ${String(pathname || '')}`.trim();
  if (!combined) return null;
  const match = PAGE_REPORT_ENTITY_MAP.find((entry) => entry.match.test(combined));
  return match?.entity || null;
}

function extractReportFilters(message) {
  const original = String(message || '');
  const text = original.toLowerCase();
  const filters = {};

  if (text.includes('last 7 days') || text.includes('last seven days')) {
    filters.dateRange = 'last_7_days';
  } else if (text.includes('last 30 days') || text.includes('last thirty days')) {
    filters.dateRange = 'last_30_days';
  } else if (text.includes('this month') || text.includes('current month')) {
    filters.dateRange = 'this_month';
  }

  const assignedToMatch =
    original.match(/assigned\s+to\s*[:=]?\s*([a-zA-Z][a-zA-Z\s.-]{1,60})/i) ||
    original.match(/owner\s*[:=]?\s*([a-zA-Z][a-zA-Z\s.-]{1,60})/i) ||
    original.match(/for\s+([a-zA-Z][a-zA-Z\s.-]{1,60})'s\s+(?:leads|clients|candidates|jobs|tasks|placements|interviews)/i);
  if (assignedToMatch?.[1]) {
    filters.assignedTo = assignedToMatch[1].trim();
  }

  const locationMatch =
    original.match(/location\s*[:=]?\s*([a-zA-Z][a-zA-Z\s,-]{1,80})/i) ||
    original.match(/city\s*[:=]?\s*([a-zA-Z][a-zA-Z\s,-]{1,80})/i) ||
    original.match(/(?:leads|clients|candidates|jobs|tasks|placements|interviews|pipeline)\s+(?:report|reports|export)\s+(?:for|in)\s+([a-zA-Z][a-zA-Z\s,-]{1,80})/i);
  if (locationMatch?.[1]) {
    filters.location = locationMatch[1].trim();
  }

  const statusMatch = original.match(/status\s*[:=]?\s*([a-zA-Z_ -]{2,40})/i);
  if (statusMatch?.[1]) {
    filters.status = statusMatch[1].trim();
  }

  const searchMatch = original.match(/search\s*[:=]?\s*([^\n]+)/i);
  if (searchMatch?.[1]) {
    filters.search = searchMatch[1].trim();
  }

  return filters;
}

function normalizeEntityWord(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('lead')) return 'leads';
  if (text.includes('client') || text.includes('compan')) return 'clients';
  if (text.includes('job')) return 'jobs';
  if (text.includes('candidate') || text.includes('canddiate')) return 'candidates';
  return '';
}

function extractNamedTarget(message) {
  const original = String(message || '').trim();
  if (!original) return '';

  const quoted =
    original.match(/["“”'`]+([^"“”'`]{2,120})["“”'`]+/) ||
    original.match(/about\s+([a-z0-9&.,()\- ]{3,120})$/i) ||
    original.match(/for\s+([a-z0-9&.,()\- ]{3,120})$/i) ||
    original.match(/^([a-z0-9&.,()\- ]{3,120})\s+(give me|show me|genarate|generate|report|csv|excel|pdf)/i) ||
    original.match(/(?:report|details|data)\s+of\s+([a-z0-9&.,()\- ]{3,120})/i);

  return quoted?.[1]?.trim() || '';
}

function extractNamedTargetSmart(message) {
  const original = String(message || '').trim();
  if (!original) return '';

  const firstLine = original.split(/\r?\n/).find((line) => String(line || '').trim()) || original;
  const cleanedLine = firstLine.replace(/\s+/g, ' ').trim();
  const patterns = [
    /["'`]+([^"'`]{2,120})["'`]+/i,
    /^(.+?)\s+(?:give me|show me|genarate|generate)\s+(?:the\s+)?(?:report|csv|excel|pdf|data|details)\b/i,
    /^(.+?)\s+(?:give me|show me)\s+the\s+report\s+of\s+this\s+(?:lead|leads|client|company|job|candidate|candidates)\b/i,
    /^(.+?)\s+(?:report|data|details)\s+of\s+this\s+(?:lead|leads|client|company|job|candidate|candidates)\b/i,
    /(?:report|details|data)\s+of\s+([a-z0-9&.,()\- ]{3,120})/i,
    /about\s+([a-z0-9&.,()\- ]{3,120})$/i,
    /for\s+([a-z0-9&.,()\- ]{3,120})$/i,
  ];

  for (const pattern of patterns) {
    const match = cleanedLine.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return extractNamedTarget(message);
}

function findRelevantHistoryEntry(history, preferredEntity = '') {
  const messages = Array.isArray(history?.messages) ? history.messages : [];
  const normalizedPreferred = normalizeEntityWord(preferredEntity);

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'user') continue;
    const content = String(message.content || '');
    const entity = normalizeEntityWord(content);
    if (normalizedPreferred && entity && entity !== normalizedPreferred) continue;
    const target = extractNamedTargetSmart(content);
    if (target) {
      return { content, entity: entity || normalizedPreferred, target };
    }
  }

  return null;
}

function enrichReportRequestFromHistory(request, history) {
  if (!request) return request;

  const next = {
    ...request,
    filters: { ...(request.filters || {}) },
  };

  const explicitTarget = extractNamedTargetSmart(next.filters.search || '');
  if (!next.filters.search || explicitTarget) {
    const currentTarget = explicitTarget || extractNamedTargetSmart(String(next.originalMessage || ''));
    if (currentTarget && !next.filters.search) {
      next.filters.search = currentTarget;
    }
  }

  if (!next.filters.search) {
    const remembered = findRelevantHistoryEntry(history, next.dataset);
    if (remembered?.target) {
      next.filters.search = remembered.target;
    }
  }

  return next;
}

function getDirectReportRequest(message, context = {}) {
  const original = String(message || '');
  const text = original.toLowerCase();
  const wantsReport =
    text.includes('report') || text.includes('export') || text.includes('excel') || text.includes('pdf') || text.includes('csv');

  if (!wantsReport) return null;

  const format = text.includes('pdf')
    ? 'pdf'
    : text.includes('excel') || text.includes('xlsx')
      ? 'excel'
      : text.includes('csv')
        ? 'csv'
        : null;

  const dataset =
    text.includes('lead') ? 'leads'
    : text.includes('client') ? 'clients'
    : text.includes('job') ? 'jobs'
    : text.includes('candidate') ? 'candidates'
    : text.includes('pipeline') ? 'pipeline'
    : text.includes('placement') ? 'placements'
    : text.includes('interview') ? 'interviews'
    : text.includes('team') ? 'team'
    : text.includes('task') ? 'tasks'
    : getEntityFromPageContext(context.pageKey, context.pathname) ||
      findRelevantHistoryEntry(context.history)?.entity;

  if (!format || !dataset) return null;

  return {
    format,
    dataset,
    filters: extractReportFilters(message),
    originalMessage: original,
  };
}

function extractInlineReportDatasets(message, context = {}) {
  const original = String(message || '');
  const text = original.toLowerCase();
  const onReportsPage = /(^|\/)reports?(\/|$)/i.test(String(context.pathname || context.pageKey || ''));
  const wantsInlineReport =
    text.includes('report') ||
    text.includes('summary') ||
    text.includes('show all data') ||
    text.includes('show the data') ||
    text.includes('extract all data');

  if (!wantsInlineReport) return [];

  const found = [];
  const add = (value) => {
    if (value && !found.includes(value)) found.push(value);
  };

  if (/\bcompan(y|ies)\b/.test(text) || /\bclient(s)?\b/.test(text)) add('clients');
  if (/\blead(s)?\b/.test(text)) add('leads');
  if (/\bjob(s)?\b/.test(text)) add('jobs');
  if (/\bcandidate(s)?\b/.test(text) || /\bcanddiate(s)?\b/.test(text)) add('candidates');
  if (/\bplacement(s)?\b/.test(text) || /\brevenue\b/.test(text)) add('placements');
  if (/\binterview(s)?\b/.test(text)) add('interviews');
  if (/\bpipeline\b/.test(text) || /\bfunnel\b/.test(text)) add('pipeline');
  if (/\btask(s)?\b/.test(text) || /\bactivity\b/.test(text) || /\bproductivity\b/.test(text)) add('tasks');
  if (/\bteam\b/.test(text) || /\brecruiter(s)?\b/.test(text) || /\bteam performance\b/.test(text)) add('team');

  if (/\brecruitment performance\b/.test(text)) {
    add('jobs');
    add('candidates');
    add('interviews');
    add('placements');
  }
  if (/\bjobs?\s*&\s*clients?\b/.test(text) || /\bjobs and clients\b/.test(text)) {
    add('jobs');
    add('clients');
  }
  if (onReportsPage && (/\ball reports?\b/.test(text) || /\ball tabs?\b/.test(text) || /\breports page\b/.test(text))) {
    ['clients', 'leads', 'jobs', 'candidates', 'placements', 'interviews', 'pipeline', 'tasks', 'team'].forEach(add);
  }

  if (found.length === 0) {
    add(getEntityFromPageContext(context.pageKey, context.pathname));
  }

  return found.filter(Boolean);
}

function summarizeInlineRows(dataset, rows) {
  const limitedRows = Array.isArray(rows) ? rows.slice(0, 5) : [];
  switch (dataset) {
    case 'clients':
      return limitedRows
        .map(
          (row, index) =>
            `${index + 1}. ${row.companyName || 'Unnamed client'} | status: ${row.status || '-'} | industry: ${row.industry || '-'} | location: ${row.location || '-'} | assigned: ${row.assignedTo?.name || '-'} | jobs: ${row.jobs?.length || 0} | contacts: ${row.contacts?.length || 0}`
        )
        .join('\n');
    case 'leads':
      return limitedRows
        .map(
          (row, index) =>
            `${index + 1}. ${row.companyName || row.contactPerson || 'Unnamed lead'} | contact: ${row.contactPerson || '-'} | status: ${row.status || '-'} | source: ${row.source || '-'} | priority: ${row.priority || '-'} | assigned: ${row.assignedTo?.name || '-'}`
        )
        .join('\n');
    case 'jobs':
      return limitedRows
        .map(
          (row, index) =>
            `${index + 1}. ${row.title || 'Untitled job'} | status: ${row.status || '-'} | type: ${row.type || '-'} | client: ${row.client?.companyName || '-'} | location: ${row.location || '-'} | openings: ${row.openings ?? 0}`
        )
        .join('\n');
    case 'candidates':
      return limitedRows
        .map(
          (row, index) =>
            `${index + 1}. ${[row.firstName, row.lastName].filter(Boolean).join(' ') || row.email || 'Unnamed candidate'} | stage: ${row.stage || '-'} | status: ${row.status || '-'} | title: ${row.currentTitle || '-'} | company: ${row.currentCompany || '-'} | assigned: ${row.assignedTo?.name || '-'}`
        )
        .join('\n');
    case 'placements':
      return limitedRows
        .map(
          (row, index) =>
            `${index + 1}. ${row.id || 'Placement'} | status: ${row.status || '-'} | offer: ${row.offerDate || '-'} | joining: ${row.joiningDate || '-'} | fee: ${row.placementFee ?? '-'} | revenue: ${row.revenue ?? '-'}`
        )
        .join('\n');
    case 'interviews':
      return limitedRows
        .map(
          (row, index) =>
            `${index + 1}. ${row.id || 'Interview'} | status: ${row.status || '-'} | type: ${row.type || '-'} | round: ${row.round || '-'} | scheduled: ${row.scheduledAt || '-'}`
        )
        .join('\n');
    case 'pipeline':
      return limitedRows
        .map((row, index) => `${index + 1}. ${safeSerialize(row)}`)
        .join('\n');
    case 'tasks':
      return limitedRows
        .map(
          (row, index) =>
            `${index + 1}. ${row.title || 'Untitled task'} | status: ${row.status || '-'} | priority: ${row.priority || '-'} | due: ${row.dueDate || '-'} | type: ${row.taskType || '-'}`
        )
        .join('\n');
    case 'team':
      return limitedRows
        .map(
          (row, index) =>
            `${index + 1}. ${row.name || row.email || 'Unnamed user'} | role: ${row.role || '-'} | department: ${row.department || '-'} | jobs: ${row.assignedJobs ?? 0} | clients: ${row.assignedClients ?? 0} | placements: ${row.placements ?? 0} | revenue: ${row.revenueGenerated ?? 0}`
        )
        .join('\n');
    default:
      return limitedRows.map((row, index) => `${index + 1}. ${safeSerialize(row)}`).join('\n');
  }
}

function summarizeReportsSummaryRows(dataset, summary) {
  switch (dataset) {
    case 'team':
      return (summary?.teamPerformance?.leaderboard || [])
        .slice(0, 8)
        .map(
          (row) =>
            `#${row.rank}. ${row.name} | jobs: ${row.jobs} | submissions: ${row.submissions} | interviews: ${row.interviews} | placements: ${row.placements}`
        )
        .join('\n');
    case 'pipeline':
      return (summary?.pipelineFunnel?.funnel || [])
        .map((row, index) => `${index + 1}. ${row.name} | count: ${row.value}`)
        .join('\n');
    case 'placements':
      return [
        `Total placements: ${summary?.placementsRevenue?.kpis?.totalPlacements ?? 0}`,
        `Total revenue: ${summary?.placementsRevenue?.kpis?.totalRevenue ?? 0}`,
        `Average billing: ${summary?.placementsRevenue?.kpis?.avgBilling ?? 0}`,
        ...(summary?.placementsRevenue?.trend || [])
          .slice(0, 6)
          .map((row) => `${row.label} | revenue: ${row.revenue}`),
      ].join('\n');
    case 'interviews':
      return [
        ...((summary?.interviews?.trend || []).slice(0, 6).map(
          (row) => `${row.label} | scheduled: ${row.scheduled} | completed: ${row.completed}`
        )),
        ...((summary?.interviews?.feedbackPending || []).slice(0, 5).map(
          (row) => `${row.name} | feedback pending: ${row.pending}`
        )),
      ].join('\n');
    case 'tasks':
      return [
        `Calls made: ${summary?.activityProductivity?.kpis?.callsMade ?? 0}`,
        `Emails sent: ${summary?.activityProductivity?.kpis?.emailsSent ?? 0}`,
        `Tasks completed: ${summary?.activityProductivity?.kpis?.tasksCompleted ?? 0}`,
        `Overdue tasks: ${summary?.activityProductivity?.kpis?.overdueTasks ?? 0}`,
        ...((summary?.activityProductivity?.trend || []).slice(0, 6).map(
          (row) => `${row.label} | calls: ${row.calls} | emails: ${row.emails} | tasks: ${row.tasks}`
        )),
      ].join('\n');
    case 'jobs':
      return (summary?.jobsClients?.jobs || [])
        .slice(0, 8)
        .map(
          (row, index) =>
            `${index + 1}. ${row.title} | client: ${row.client} | status: ${row.status} | candidates: ${row.count} | aging: ${row.aging}`
        )
        .join('\n');
    case 'clients':
      return (summary?.jobsClients?.topClients || [])
        .slice(0, 8)
        .map((row, index) => `${index + 1}. ${row.name} | job volume: ${row.volume}`)
        .join('\n');
    case 'candidates':
      return [
        ...((summary?.candidates?.sources || []).slice(0, 6).map(
          (row, index) => `${index + 1}. source: ${row.name} | count: ${row.value}`
        )),
        ...((summary?.candidates?.skills || []).slice(0, 6).map(
          (row) => `skill: ${row.skill} | count: ${row.count} | score: ${row.percentage}%`
        )),
      ].join('\n');
    default:
      return '';
  }
}

function getReportsSummaryCount(dataset, summary) {
  switch (dataset) {
    case 'team':
      return summary?.teamPerformance?.leaderboard?.length || 0;
    case 'pipeline':
      return summary?.pipelineFunnel?.funnel?.length || 0;
    case 'placements':
      return summary?.placementsRevenue?.trend?.length || 0;
    case 'interviews':
      return (summary?.interviews?.trend?.length || 0) + (summary?.interviews?.feedbackPending?.length || 0);
    case 'tasks':
      return summary?.activityProductivity?.trend?.length || 0;
    case 'jobs':
      return summary?.jobsClients?.jobs?.length || 0;
    case 'clients':
      return summary?.jobsClients?.topClients?.length || 0;
    case 'candidates':
      return (summary?.candidates?.sources?.length || 0) + (summary?.candidates?.skills?.length || 0);
    default:
      return 0;
  }
}

function isReportsPageContext(context = {}) {
  return /(^|\/)reports?(\/|$)/i.test(String(context.pathname || context.pageKey || ''));
}

function mapDatasetToSummaryTab(dataset) {
  switch (String(dataset || '').trim().toLowerCase()) {
    case 'team':
      return 'team-performance';
    case 'pipeline':
      return 'pipeline-funnel';
    case 'placements':
      return 'placements-revenue';
    case 'interviews':
      return 'interviews';
    case 'tasks':
      return 'activity-productivity';
    case 'jobs':
    case 'clients':
      return 'jobs-clients';
    case 'candidates':
      return 'candidates';
    default:
      return null;
  }
}

async function buildInlineDatabaseReport(user, message, context = {}) {
  const datasets = extractInlineReportDatasets(message, context);
  if (!datasets.length) return null;
  const onReportsPage = isReportsPageContext(context);

  const filters = extractReportFilters(message);
  const namedTarget =
    filters.search ||
    extractNamedTargetSmart(message) ||
    findRelevantHistoryEntry(context.history, datasets[0])?.target ||
    '';
  const searchTerm = namedTarget || filters.location || filters.status || '';

  const sections = [];
  const actions = [];
  const reportsSummary = onReportsPage ? await reportService.getSummary({}, user) : null;

  for (const dataset of datasets) {
    const summaryDrivenText = onReportsPage ? summarizeReportsSummaryRows(dataset, reportsSummary) : '';
    const summaryDrivenCount = onReportsPage ? getReportsSummaryCount(dataset, reportsSummary) : 0;

    if (summaryDrivenText) {
      sections.push(`${dataset.toUpperCase()} REPORT\nTotal records: ${summaryDrivenCount}\n${summaryDrivenText}`);
      actions.push({
        type: 'report',
        status: 'completed',
        entity:
          dataset === 'clients' ? 'Client' :
          dataset === 'leads' ? 'Lead' :
          dataset === 'jobs' ? 'Job' :
          dataset === 'candidates' ? 'Candidate' :
          dataset === 'team' ? 'Report' : 'Report',
        details: `Fetched ${summaryDrivenCount} ${dataset} records from reports summary data.`,
      });
      continue;
    }

    const rows = await fetchAssistantReportDataset(user, dataset, searchTerm, 'full');
    const count = Array.isArray(rows) ? rows.length : 0;
    sections.push(`${dataset.toUpperCase()} REPORT\nTotal records: ${count}\n${count ? summarizeInlineRows(dataset, rows) : 'No records found in your current access scope.'}`);
    actions.push({
      type: 'report',
      status: 'completed',
      entity:
        dataset === 'clients' ? 'Client' :
        dataset === 'leads' ? 'Lead' :
        dataset === 'jobs' ? 'Job' :
        dataset === 'candidates' ? 'Candidate' : 'Report',
      details: `Fetched ${count} ${dataset} records with full detail scope for the assistant report.`,
    });
  }

  const output =
    `Here is the live database report from the assistant for ${datasets.join(', ')}.\n\n` +
    `${sections.join('\n\n')}\n\n` +
    'If you want, I can also generate the same data as CSV, Excel, or PDF.';

  return {
    reply: output,
    structured: {
      plan: [
        'Detect requested report entities',
        'Fetch live database data with full detail',
        'Show the report inside the assistant',
      ],
      memory_used: {
        conversation: 'User asked for a report shown inside the AI assistant.',
        task: 'Inline report generation.',
        long_term: '',
        page_context: context.pathname || context.pageKey || '',
      },
      actions,
      task_update: {
        task_id: `inline-report-${Date.now()}`,
        goal: `Show inline report for ${datasets.join(', ')}`,
        steps: ['Identify datasets', 'Fetch database rows', 'Render report in chat'],
        completed_steps: ['Identify datasets', 'Fetch database rows', 'Render report in chat'],
        pending_steps: [],
        status: 'completed',
      },
      output,
      files: [],
      memory_update: {
        userIntent: `Show inline report for ${datasets.join(', ')}`,
        lastActions: [`Fetched inline report for ${datasets.join(', ')}`],
        currentPageContext: context.pathname || context.pageKey || '',
        userPreferences: [],
        frequentlyUsedActions: ['Generate inline reports'],
        taskMemory: {
          tasks: [],
        },
        actionLog: [],
      },
    },
  };
}

/**
 * @param {{ role: string; content: string }[]} messages
 * @param {{ id?: string; name?: string | null; role?: string | null } | null | undefined} user
 * @param {{ pageKey?: string; pathname?: string | null; history?: any }} context
 */
export async function runAssistantChat(messages, user, context = {}) {
  const cleaned = sanitizeMessages(messages);
  if (cleaned.length === 0) {
    const err = new Error('At least one valid message is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const model = env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini';
  const latestUserMessage = [...cleaned].reverse().find((message) => message.role === 'user')?.content || '';
  const directReportRequest = enrichReportRequestFromHistory(
    getDirectReportRequest(latestUserMessage, context),
    context.history
  );
  const inlineReportResult = directReportRequest ? null : await buildInlineDatabaseReport(user, latestUserMessage, context);
  const userLine = user?.name ? `Signed-in user: ${user.name} (${user.role || 'user'}).` : 'Signed-in user unavailable.';
  const scopeHint = userHasFullDbAccess(user)
    ? 'Data access: organization-wide read access.'
    : 'Data access: scoped to records the user can legitimately access.';
  const historySummary = buildHistorySummary(context.history, context.pageKey, context.pathname);
  const systemContent = `${SYSTEM_PROMPT}\n\n${scopeHint}\n${userLine}\n\nMemory context:\n${historySummary}`;

  if (inlineReportResult) {
    return inlineReportResult;
  }

  if (directReportRequest) {
    const summaryTab = isReportsPageContext(context) ? mapDatasetToSummaryTab(directReportRequest.dataset) : null;
    const reportResult = summaryTab
      ? await reportService.exportSummaryTab(
          summaryTab,
          directReportRequest.format,
          directReportRequest.filters,
          user
        )
      : await buildReportFile(
          directReportRequest.dataset,
          directReportRequest.format,
          directReportRequest.filters,
          user
        );

    if (!reportResult?.ok) {
      const unavailableMessage =
        reportResult?.error === 'No data available for this report'
          ? `No data available for this ${directReportRequest.dataset} report in your current scope.`
          : reportResult?.error || 'File generation service is not configured yet';
      return {
        reply: unavailableMessage,
        structured: {
          plan: [
            `Identify ${directReportRequest.dataset} report request`,
            Object.keys(directReportRequest.filters || {}).length
              ? 'Apply requested report filters'
              : 'Use current page scope with no extra filters',
            `Generate ${directReportRequest.format.toUpperCase()} report`,
          ],
          memory_used: {
            conversation: 'User asked for a direct downloadable report.',
            task: 'No active task chain required.',
            long_term: '',
            page_context: context.pathname || context.pageKey || '',
          },
          actions: [
            {
              type: 'report',
              status: reportResult?.error === 'No data available for this report' ? 'blocked' : 'pending',
              entity: 'Report',
              details: unavailableMessage,
            },
          ],
          task_update: {
            task_id: `report-${Date.now()}`,
            goal: `Generate ${directReportRequest.dataset} report`,
            steps: ['Identify entity', 'Apply filters', 'Generate file'],
            completed_steps: [],
            pending_steps: [reportResult?.error === 'No data available for this report' ? 'Wait for matching data' : 'Wait for export service configuration'],
            status: reportResult?.error === 'No data available for this report' ? 'pending' : 'blocked',
          },
          output: unavailableMessage,
          files: [],
          memory_update: {
            userIntent: `Generate ${directReportRequest.format.toUpperCase()} report for ${directReportRequest.dataset}${directReportRequest.filters?.search ? ` matching ${directReportRequest.filters.search}` : ''}`,
            lastActions: [`Tried to generate ${directReportRequest.format.toUpperCase()} report for ${directReportRequest.dataset}${directReportRequest.filters?.search ? ` matching ${directReportRequest.filters.search}` : ''}`],
            currentPageContext: context.pathname || context.pageKey || '',
            userPreferences: [],
            frequentlyUsedActions: [`Generate ${directReportRequest.format.toUpperCase()} reports`],
            taskMemory: {
              tasks: [],
            },
            actionLog: [],
          },
        },
      };
    }
    if (reportResult.fileUrl) {
      const downloadMessage = `I generated the ${directReportRequest.format.toUpperCase()} report for ${directReportRequest.dataset}. Download it here: ${reportResult.fileUrl}`;
      return {
        reply: downloadMessage,
        structured: {
          plan: [
            `Identify ${directReportRequest.dataset} report request`,
            Object.keys(directReportRequest.filters || {}).length
              ? 'Apply requested report filters'
              : 'Use current page scope with no extra filters',
            `Generate ${directReportRequest.format.toUpperCase()} report file`,
          ],
          memory_used: {
            conversation: 'User asked for a direct downloadable report.',
            task: 'Direct report generation request.',
            long_term: '',
            page_context: context.pathname || context.pageKey || '',
          },
          actions: [
            {
              type: 'report',
              status: 'completed',
              entity: 'Report',
              details: `Generated ${reportResult.fileName} from ${reportResult.rowCount} ${directReportRequest.dataset} records.`,
            },
          ],
          task_update: {
            task_id: `report-${Date.now()}`,
            goal: `Generate ${directReportRequest.dataset} report`,
            steps: ['Identify entity', 'Apply filters', 'Generate file', 'Return download link'],
            completed_steps: ['Identify entity', 'Apply filters', 'Generate file', 'Return download link'],
            pending_steps: [],
            status: 'completed',
          },
          output: downloadMessage,
          files: [
            {
              type: directReportRequest.format,
              fileName: reportResult.fileName,
              reason: `Generated from ${reportResult.rowCount} ${directReportRequest.dataset} records.`,
            },
          ],
          memory_update: {
            userIntent: `Generate ${directReportRequest.format.toUpperCase()} report for ${directReportRequest.dataset}${directReportRequest.filters?.search ? ` matching ${directReportRequest.filters.search}` : ''}`,
            lastActions: [`Generated ${reportResult.fileName}${directReportRequest.filters?.search ? ` for ${directReportRequest.filters.search}` : ''}`],
            currentPageContext: context.pathname || context.pageKey || '',
            userPreferences: [],
            frequentlyUsedActions: [`Generate ${directReportRequest.format.toUpperCase()} reports`],
            taskMemory: {
              tasks: [],
            },
            actionLog: [
              {
                action_id: `action-${Date.now()}`,
                entity: 'Report',
                operation: 'generate',
                previous_state: null,
                new_state: {
                  fileName: reportResult.fileName,
                  fileUrl: reportResult.fileUrl,
                  rowCount: reportResult.rowCount,
                  filters: directReportRequest.filters,
                },
                summary: `Generated ${directReportRequest.format.toUpperCase()} report for ${directReportRequest.dataset}.`,
              },
            ],
          },
        },
      };
    }
  }

  if (!openai) {
    const err = new Error('AI assistant is not configured. Set OPENAI_API_KEY on the server.');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  /** @type {any[]} */
  let apiMessages = [{ role: 'system', content: systemContent }, ...cleaned];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await openai.chat.completions.create({
      model,
      messages: apiMessages,
      tools: [QUERY_RECRUITMENT_DATA_TOOL, EXECUTE_RECRUITMENT_ACTION_TOOL, GENERATE_REPORT_FILE_TOOL],
      tool_choice: 'auto',
      max_tokens: 2400,
      temperature: 0.35,
    });

    const msg = response.choices?.[0]?.message;
    if (!msg) {
      const err = new Error('Empty response from AI');
      err.code = 'AI_EMPTY';
      throw err;
    }

    if (msg.tool_calls?.length) {
      apiMessages.push({
        role: 'assistant',
        content: msg.content && String(msg.content).trim() ? msg.content : null,
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        if (tc.type !== 'function') continue;
        const fn = tc.function;
        let payload = {};
        try {
          payload = JSON.parse(fn.arguments || '{}');
        } catch {
          payload = {};
        }

        let toolResult;
        if (fn.name === 'query_recruitment_data') {
          toolResult = await executeAssistantDataTool(user, payload);
        } else if (fn.name === 'execute_recruitment_action') {
          toolResult = await executeAssistantActionTool(user, payload);
        } else if (fn.name === 'generate_report_file') {
          toolResult = await generateAssistantReportTool(user, payload);
        } else {
          toolResult = { ok: false, error: `Unknown tool: ${fn.name}` };
        }

        apiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: safeSerialize(toolResult),
        });
      }
      continue;
    }

    const text = typeof msg.content === 'string' ? msg.content.trim() : '';
    if (!text) {
      const err = new Error('Empty response from AI');
      err.code = 'AI_EMPTY';
      throw err;
    }

    const parsed = safeJsonParse(text);
    const structured = normalizeStructuredResponse(
      parsed,
      text,
      context.pathname || context.pageKey || '',
      context.history?.taskMemory
    );

    return {
      reply: structured.output,
      structured,
    };
  }

  const err = new Error('Assistant could not finish within tool round limit. Please try a simpler question.');
  err.code = 'TOOL_LIMIT';
  throw err;
}
