import type { TenantActivityCategory } from './types';
import { categorizePhase2Path } from './categories';

export type TenantActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'import'
  | 'schedule'
  | 'assign'
  | 'convert'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'upload'
  | 'send'
  | 'cancel'
  | 'restore'
  | 'other';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SKIP_API_PREFIXES = [
  '/auth/',
  '/tenant-behavior',
  '/notifications/unread',
  '/settings/org',
  '/pdf-proxy',
  '/public/',
];

const ACTION_HINTS: Array<{ pattern: RegExp; action: TenantActionType }> = [
  { pattern: /\/(export|download)/i, action: 'export' },
  { pattern: /\/(import|bulk-import|bulk-cv)/i, action: 'import' },
  { pattern: /\/(upload|media|parse-resume|process-jd)/i, action: 'upload' },
  { pattern: /\/(schedule|calendar)/i, action: 'schedule' },
  { pattern: /\/(assign|handoff)/i, action: 'assign' },
  { pattern: /\/(convert|conversion)/i, action: 'convert' },
  { pattern: /\/(submit|apply)/i, action: 'submit' },
  { pattern: /\/(approve|accept)/i, action: 'approve' },
  { pattern: /\/(reject|decline)/i, action: 'reject' },
  { pattern: /\/(cancel)/i, action: 'cancel' },
  { pattern: /\/(restore|undelete)/i, action: 'restore' },
  { pattern: /\/(send|notify|email|whatsapp|sms)/i, action: 'send' },
];

const ENTITY_PREFIXES: Array<{ prefix: RegExp; entityType: string; category: TenantActivityCategory }> = [
  { prefix: /^\/jobs?/i, entityType: 'job', category: 'jobs' },
  { prefix: /^\/candidates?/i, entityType: 'candidate', category: 'candidates' },
  { prefix: /^\/leads?/i, entityType: 'lead', category: 'leads' },
  { prefix: /^\/clients?/i, entityType: 'client', category: 'clients' },
  { prefix: /^\/contacts?/i, entityType: 'contact', category: 'contacts' },
  { prefix: /^\/interviews?/i, entityType: 'interview', category: 'interviews' },
  { prefix: /^\/placements?/i, entityType: 'placement', category: 'placements' },
  { prefix: /^\/pipeline/i, entityType: 'pipeline', category: 'pipeline' },
  { prefix: /^\/matches?/i, entityType: 'match', category: 'matches' },
  { prefix: /^\/tasks?/i, entityType: 'task', category: 'pipeline' },
  { prefix: /^\/teams?/i, entityType: 'team_member', category: 'team' },
  { prefix: /^\/portal-events/i, entityType: 'event', category: 'calendar' },
  { prefix: /^\/billing/i, entityType: 'invoice', category: 'billing' },
  { prefix: /^\/agreements?/i, entityType: 'agreement', category: 'clients' },
  { prefix: /^\/brain/i, entityType: 'ai_session', category: 'ai' },
  { prefix: /^\/ai/i, entityType: 'ai_session', category: 'ai' },
];

function inferActionType(method: string, path: string): TenantActionType {
  const m = method.toUpperCase();
  for (const hint of ACTION_HINTS) {
    if (hint.pattern.test(path)) return hint.action;
  }
  if (m === 'POST') return 'create';
  if (m === 'PUT' || m === 'PATCH') return 'update';
  if (m === 'DELETE') return 'delete';
  return 'other';
}

function inferEntity(path: string) {
  const normalized = path.split('?')[0];
  for (const row of ENTITY_PREFIXES) {
    if (row.prefix.test(normalized)) {
      const parts = normalized.split('/').filter(Boolean);
      const id = parts.length >= 2 ? parts[1] : undefined;
      return { entityType: row.entityType, category: row.category, entityId: id };
    }
  }
  return { entityType: undefined, category: categorizePhase2Path(normalized), entityId: undefined };
}

export function classifyTenantApiCall(
  path: string,
  method = 'GET',
): {
  trackable: boolean;
  category: TenantActivityCategory;
  actionType: TenantActionType;
  entityType?: string;
  entityId?: string;
} | null {
  const normalized = (path || '').split('?')[0];
  if (!normalized.startsWith('/')) return null;
  if (!MUTATION_METHODS.has(method.toUpperCase())) return null;
  if (SKIP_API_PREFIXES.some((p) => normalized.startsWith(p))) return null;

  const entity = inferEntity(normalized);
  return {
    trackable: true,
    category: entity.category,
    actionType: inferActionType(method, normalized),
    entityType: entity.entityType,
    entityId: entity.entityId,
  };
}

export function extractEntityLabelFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as Record<string, unknown>;
  const title = b.title || b.jobTitle || b.companyName || b.name || b.subject || b.taskTitle;
  if (typeof title === 'string' && title.trim()) return title.trim().slice(0, 120);
  const first = b.firstName;
  const last = b.lastName;
  if (typeof first === 'string' || typeof last === 'string') {
    return [first, last].filter(Boolean).join(' ').trim().slice(0, 120) || undefined;
  }
  return undefined;
}
