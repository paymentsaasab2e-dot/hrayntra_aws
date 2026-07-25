/**
 * HRYantra local assistant — smarter answers from live tenant CRM data.
 * No OpenAI / Mistral / external AI API keys. Uses authenticated tenant APIs only.
 *
 * Smart layer = intent scoring, fuzzy search, priority ranking, cross-module
 * insights, and short conversation memory — all on-device over live APIs.
 */

import {
  apiGetCandidateStats,
  apiGetCandidates,
  apiGetClientMetrics,
  apiGetClients,
  apiGetContacts,
  apiGetInterviewKpis,
  apiGetInterviews,
  apiGetJobMetrics,
  apiGetJobs,
  apiGetLeads,
  apiGetPlacementStats,
  apiGetPlacements,
  apiGetTaskStats,
  apiGetTasks,
  apiGetUnifiedCalendar,
} from './api';

export type HrYantraChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type TenantSnapshot = {
  loadedAt: number;
  leads: any[];
  clients: any[];
  jobs: any[];
  candidates: any[];
  interviews: any[];
  placements: any[];
  tasks: any[];
  contacts: any[];
  calendarEvents: any[];
  metrics: {
    jobs: any;
    clients: any;
    candidates: any;
    interviews: any;
    placements: any;
    tasks: any;
  };
  /** Production diagnostics — which sources loaded. */
  loadHealth: {
    ok: string[];
    failed: string[];
    partial: boolean;
  };
};

type IntentId =
  | 'help'
  | 'howto'
  | 'pulse'
  | 'next_actions'
  | 'risks'
  | 'followups'
  | 'hot_leads'
  | 'leads'
  | 'clients'
  | 'contacts'
  | 'jobs'
  | 'candidates'
  | 'interviews'
  | 'calendar'
  | 'placements'
  | 'tasks'
  | 'compare'
  | 'search'
  | 'unknown';

type ScoredIntent = { id: IntentId; score: number };

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'is', 'are',
  'was', 'were', 'be', 'do', 'does', 'did', 'me', 'my', 'we', 'our', 'you', 'your',
  'please', 'can', 'could', 'would', 'should', 'what', 'which', 'who', 'how', 'many',
  'show', 'give', 'get', 'list', 'find', 'tell', 'about', 'with', 'from', 'this',
  'that', 'them', 'those', 'these', 'any', 'all', 'some', 'more', 'also',
]);

let snapshotCache: TenantSnapshot | null = null;
let snapshotInflight: Promise<TenantSnapshot> | null = null;
const CACHE_TTL_MS = 45_000;
/** Keep individual CRM calls short so production latency / slow routes don't hang the chat. */
const REQUEST_TIMEOUT_MS = 12_000;
const CORE_LIMIT = 150;
const EXTRA_LIMIT = 100;

async function withTimeout<T>(
  label: string,
  factory: () => Promise<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<{ label: string; ok: true; value: T } | { label: string; ok: false; error: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      factory(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    return { label, ok: true, value };
  } catch (error: any) {
    return { label, ok: false, error: String(error?.message || error || 'Request failed') };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function emptyHealth() {
  return { ok: [] as string[], failed: [] as string[], partial: false };
}

function totalRecords(snap: TenantSnapshot): number {
  return (
    snap.leads.length +
    snap.clients.length +
    snap.jobs.length +
    snap.candidates.length +
    snap.interviews.length +
    snap.placements.length +
    snap.tasks.length +
    snap.contacts.length +
    snap.calendarEvents.length
  );
}

function loadFailureMessage(snap: TenantSnapshot): string | null {
  if (totalRecords(snap) > 0) return null;
  const failed = snap.loadHealth.failed;
  if (!failed.length && !snap.loadHealth.ok.length) {
    return [
      '**Could not read live CRM data.**',
      'No tenant APIs responded. On production this usually means:',
      '• Session expired — sign out and log in again',
      '• `NEXT_PUBLIC_API_URL` points to the wrong API',
      '• Backend / tenant DB is unreachable from the production site',
      '',
      'After fixing, ask again or say “refresh”.',
    ].join('\n');
  }
  if (failed.length && !snap.loadHealth.ok.length) {
    return [
      '**CRM APIs failed in this environment.**',
      `Failed: ${failed.slice(0, 8).join(', ')}${failed.length > 8 ? '…' : ''}`,
      '',
      'Local often works while production fails when the deployed frontend still points at localhost, an old API URL, or an expired tenant session.',
      'Re-login, confirm production `NEXT_PUBLIC_API_URL`, redeploy frontend + backend, then try again.',
    ].join('\n');
  }
  return null;
}

function unwrapList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const data = root.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.events)) return nested.events;
  }
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.events)) return root.events;
  return [];
}

function unwrapData(payload: unknown): any {
  if (!payload || typeof payload !== 'object') return payload;
  const root = payload as Record<string, unknown>;
  if (root.data !== undefined) return root.data;
  return payload;
}

function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string): number {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[s.length][t.length];
}

/** CRM / how-to vocabulary the assistant should auto-correct toward. */
const SPELLING_CANONICAL = [
  'how', 'to', 'do', 'i', 'create', 'add', 'client', 'clients', 'lead', 'leads',
  'candidate', 'candidates', 'interview', 'interviews', 'job', 'jobs', 'placement',
  'placements', 'task', 'tasks', 'contact', 'contacts', 'calendar', 'process',
  'hryantra', 'system', 'follow', 'up', 'followup', 'priority', 'overdue', 'pulse',
  'risk', 'risks', 'compare', 'pipeline', 'company', 'account', 'accounts', 'open',
  'show', 'what', 'should', 'next', 'help', 'guide', 'steps', 'the', 'a', 'an',
  'in', 'this', 'that', 'please', 'make', 'new', 'use', 'using', 'works', 'work',
  'does', 'can', 'we', 'my', 'me', 'for', 'with', 'from', 'about', 'today',
  'billing', 'invoice', 'invoices', 'payment', 'payments', 'commission', 'payout',
  'pipeline', 'matches', 'inbox', 'reports', 'recycle', 'activity', 'team',
  'request', 'approvals', 'approval', 'settings', 'setting', 'dashboard', 'module',
];

const SPELLING_ALIASES: Record<string, string> = {
  clinet: 'client',
  cleint: 'client',
  clent: 'client',
  cliient: 'client',
  clientt: 'client',
  clients: 'clients',
  leed: 'lead',
  leeds: 'leads',
  leds: 'leads',
  leadss: 'leads',
  candiate: 'candidate',
  candidte: 'candidate',
  candidiate: 'candidate',
  interveiw: 'interview',
  inteview: 'interview',
  interviw: 'interview',
  intervieww: 'interview',
  placment: 'placement',
  placeement: 'placement',
  creat: 'create',
  crate: 'create',
  cerate: 'create',
  createe: 'create',
  ad: 'add',
  adde: 'add',
  proces: 'process',
  proccess: 'process',
  prosess: 'process',
  sytem: 'system',
  sistem: 'system',
  hryantr: 'hryantra',
  hrynatra: 'hryantra',
  hryanta: 'hryantra',
  qustion: 'question',
  quetion: 'question',
  anser: 'answer',
  steeps: 'steps',
  stepe: 'steps',
  guid: 'guide',
  guidence: 'guide',
  instruciton: 'instruction',
  instructon: 'instruction',
  follw: 'follow',
  folow: 'follow',
  prioriy: 'priority',
  prioroty: 'priority',
  overude: 'overdue',
  overdu: 'overdue',
  pipelin: 'pipeline',
  pipline: 'pipeline',
  pipeine: 'pipeline',
  matchs: 'matches',
  matching: 'matches',
  inbx: 'inbox',
  inbax: 'inbox',
  reportes: 'reports',
  raport: 'report',
  recyle: 'recycle',
  recycel: 'recycle',
  activty: 'activity',
  aproval: 'approval',
  aprovals: 'approvals',
  approvel: 'approval',
  requst: 'request',
  reqest: 'request',
  setings: 'settings',
  settigns: 'settings',
  settingss: 'settings',
  dashbord: 'dashboard',
  companey: 'company',
  compnay: 'company',
  accout: 'account',
  acount: 'account',
  teh: 'the',
  thsi: 'this',
  tihs: 'this',
  waht: 'what',
  wht: 'what',
  hwo: 'how',
  hoe: 'how',
  shoud: 'should',
  shud: 'should',
  plese: 'please',
  pls: 'please',
  jobe: 'job',
  jobs: 'jobs',
  taske: 'task',
  contac: 'contact',
  calender: 'calendar',
  calandar: 'calendar',
  billng: 'billing',
  bililng: 'billing',
  billling: 'billing',
  biling: 'billing',
  invoce: 'invoice',
  inoice: 'invoice',
  invoise: 'invoice',
  paymnt: 'payment',
  payement: 'payment',
  comission: 'commission',
  commision: 'commission',
};

function bestSpellingMatch(token: string): string | null {
  const t = token.toLowerCase();
  if (!t || t.length < 2) return null;
  if (SPELLING_ALIASES[t]) return SPELLING_ALIASES[t];
  if (SPELLING_CANONICAL.includes(t)) return t;

  let best: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const word of SPELLING_CANONICAL) {
    if (Math.abs(word.length - t.length) > 2) continue;
    const dist = editDistance(t, word);
    const maxDist = word.length <= 4 ? 1 : 2;
    if (dist > 0 && dist <= maxDist && dist < bestDist) {
      best = word;
      bestDist = dist;
    }
  }
  return best;
}

type SpellingCorrection = {
  corrected: string;
  changed: boolean;
  replacements: Array<{ from: string; to: string }>;
};

function correctSpelling(prompt: string): SpellingCorrection {
  const original = String(prompt || '').trim();
  if (!original) return { corrected: '', changed: false, replacements: [] };

  const parts = original.split(/(\s+)/);
  const replacements: Array<{ from: string; to: string }> = [];
  const rebuilt = parts.map((part) => {
    if (!part || /^\s+$/.test(part)) return part;
    const match = part.match(/^([^a-zA-Z]*)([a-zA-Z]+)([^a-zA-Z]*)$/);
    if (!match) return part;
    const [, prefix, word, suffix] = match;
    const fixed = bestSpellingMatch(word);
    if (!fixed || fixed.toLowerCase() === word.toLowerCase()) return part;
    replacements.push({ from: word, to: fixed });
    const cased =
      word === word.toUpperCase()
        ? fixed.toUpperCase()
        : word[0] === word[0].toUpperCase()
          ? fixed[0].toUpperCase() + fixed.slice(1)
          : fixed;
    return `${prefix}${cased}${suffix}`;
  });

  const corrected = rebuilt.join('').replace(/\s+/g, ' ').trim();
  return {
    corrected: corrected || original,
    changed: replacements.length > 0 && corrected.toLowerCase() !== original.toLowerCase(),
    replacements,
  };
}

function withSpellingNote(answer: string, correction: SpellingCorrection): string {
  if (!correction.changed) return answer;
  const pairs = correction.replacements
    .map(({ from, to }) => `“${from}” → “${to}”`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 6)
    .join(', ');
  return [
    `_Understood as: “${correction.corrected}”${pairs ? ` (${pairs})` : ''}._`,
    '',
    answer,
  ].join('\n');
}

function tokensOf(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function includesAny(haystack: string, words: string[]): boolean {
  return words.some((w) => haystack.includes(w));
}

function scoreKeywords(q: string, groups: Array<{ words: string[]; weight: number }>): number {
  let score = 0;
  for (const group of groups) {
    for (const word of group.words) {
      if (q.includes(word)) score += group.weight;
    }
  }
  return score;
}

function statusOf(item: any): string {
  return String(item?.status || item?.stage || '').toLowerCase();
}

function nameOf(item: any): string {
  return String(
    item?.companyName ||
      item?.title ||
      item?.name ||
      item?.fullName ||
      `${item?.firstName || ''} ${item?.lastName || ''}`.trim() ||
      item?.candidateName ||
      item?.jobTitle ||
      item?.contactPerson ||
      '',
  );
}

function searchableText(item: any): string {
  return normalize(
    [
      nameOf(item),
      item?.email,
      item?.phone,
      item?.status,
      item?.stage,
      item?.priority,
      item?.industry,
      item?.location,
      item?.city,
      item?.contactPerson,
      item?.designation,
      item?.clientName,
      item?.jobTitle,
      item?.title,
      item?.notes,
      item?.type,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/** Simple fuzzy score: token overlap + substring bonus. */
function fuzzyScore(query: string, item: any): number {
  const qTokens = tokensOf(query);
  if (!qTokens.length) return 0;
  const hay = searchableText(item);
  if (!hay) return 0;
  let score = 0;
  for (const token of qTokens) {
    if (hay.includes(token)) score += token.length >= 4 ? 3 : 2;
    else if (token.length >= 4 && hay.split(' ').some((h) => h.startsWith(token.slice(0, 3)))) {
      score += 1;
    }
  }
  const name = normalize(nameOf(item));
  if (name && qTokens.every((t) => name.includes(t))) score += 6;
  return score;
}

function topFuzzy(list: any[], query: string, limit = 8): Array<{ item: any; score: number }> {
  return list
    .map((item) => ({ item, score: fuzzyScore(query, item) }))
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function countBy(list: any[], keyFn: (item: any) => string): Record<string, number> {
  return list.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function formatBreakdown(map: Record<string, number>, limit = 8): string {
  const rows = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, v]) => `  · ${k}: ${v}`);
  return rows.length ? rows.join('\n') : '  · No breakdown available';
}

function isOpenJob(job: any): boolean {
  const s = statusOf(job);
  return !s || s.includes('open') || s.includes('active') || s.includes('published');
}

function isHotLead(lead: any): boolean {
  const p = String(lead?.priority || '').toLowerCase();
  const s = statusOf(lead);
  return p === 'high' || s.includes('hot') || s.includes('qualified') || s.includes('interested');
}

function isOverdueFollowUp(lead: any): boolean {
  const due = lead?.nextFollowUp;
  if (!due) return false;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  if (statusOf(lead).includes('converted') || statusOf(lead).includes('lost')) return false;
  return d.getTime() < Date.now();
}

function isDueSoonFollowUp(lead: any, hours = 48): boolean {
  const due = lead?.nextFollowUp;
  if (!due || isOverdueFollowUp(lead)) return false;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  const diff = d.getTime() - Date.now();
  return diff >= 0 && diff <= hours * 60 * 60 * 1000;
}

function isOverdueTask(task: any): boolean {
  const due = task?.dueDate || task?.dueAt;
  if (!due) return false;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  const done = ['completed', 'done', 'cancelled'].includes(statusOf(task));
  return !done && d.getTime() < Date.now();
}

function interviewWhen(interview: any): string | null {
  return interview?.scheduledAt || interview?.dateTime || interview?.startAt || interview?.date || null;
}

function isUpcomingInterview(interview: any): boolean {
  const when = interviewWhen(interview);
  if (!when) return true;
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() >= Date.now() - 60 * 60 * 1000;
}

function isToday(iso: any): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isWithinDays(iso: any, days: number): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const diff = d.getTime() - Date.now();
  return diff >= -60 * 60 * 1000 && diff <= days * 24 * 60 * 60 * 1000;
}

function formatWhen(iso: any): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function listPreview(items: any[], mapLabel: (item: any) => string, limit = 8): string {
  if (!items.length) return 'None found.';
  const rows = items.slice(0, limit).map((item, i) => `${i + 1}. ${mapLabel(item)}`);
  const more = items.length > limit ? `\n…and ${items.length - limit} more.` : '';
  return `${rows.join('\n')}${more}`;
}

function metricValue(obj: any, ...paths: string[]): number | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const path of paths) {
    const parts = path.split('.');
    let cur: any = obj;
    for (const part of parts) {
      if (cur == null) {
        cur = undefined;
        break;
      }
      cur = cur[part];
    }
    if (typeof cur === 'number' && Number.isFinite(cur)) return cur;
    if (cur && typeof cur === 'object' && typeof cur.value === 'number') return cur.value;
  }
  return null;
}

function leadUrgencyScore(lead: any): number {
  let score = 0;
  if (isOverdueFollowUp(lead)) score += 40;
  else if (isDueSoonFollowUp(lead, 24)) score += 25;
  else if (isDueSoonFollowUp(lead, 48)) score += 15;
  if (isHotLead(lead)) score += 20;
  const p = String(lead?.priority || '').toLowerCase();
  if (p === 'high') score += 10;
  if (p === 'medium') score += 4;
  if (!lead?.nextFollowUp && !statusOf(lead).includes('converted') && !statusOf(lead).includes('lost')) {
    score += 12;
  }
  if (statusOf(lead).includes('new')) score += 5;
  return score;
}

async function loadTenantSnapshot(force = false): Promise<TenantSnapshot> {
  if (!force && snapshotCache && Date.now() - snapshotCache.loadedAt < CACHE_TTL_MS) {
    return snapshotCache;
  }
  if (!force && snapshotInflight) return snapshotInflight;

  snapshotInflight = (async () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    const end = new Date(now);
    end.setDate(end.getDate() + 14);
    const health = emptyHealth();

    const runList = async (label: string, fn: () => Promise<any>) => {
      const result = await withTimeout(label, fn);
      if (result.ok) {
        health.ok.push(label);
        return unwrapList((result.value as any)?.data ?? result.value);
      }
      health.failed.push(`${label} (${result.error})`);
      return [] as any[];
    };

    const runMetric = async (label: string, fn: () => Promise<any>) => {
      const result = await withTimeout(label, fn);
      if (result.ok) {
        health.ok.push(label);
        return unwrapData(result.value);
      }
      health.failed.push(`${label} (${result.error})`);
      return null;
    };

    // Wave 1 — core CRM (enough to answer most questions)
    const [leads, clients, jobs, candidates, tasks] = await Promise.all([
      runList('leads', () => apiGetLeads({ page: 1, limit: CORE_LIMIT })),
      runList('clients', () => apiGetClients({ page: 1, limit: CORE_LIMIT })),
      runList('jobs', () => apiGetJobs({ page: 1, limit: CORE_LIMIT })),
      runList('candidates', () => apiGetCandidates({ page: 1, limit: CORE_LIMIT })),
      runList('tasks', () => apiGetTasks({ page: 1, limit: CORE_LIMIT })),
    ]);

    // Wave 2 — extras (must not block core answers if production route is slow/missing)
    const [interviews, placements, contacts, calendarEvents, jobMetrics, clientMetrics, candidateStats, interviewKpis, placementStats, taskStats] =
      await Promise.all([
        runList('interviews', () => apiGetInterviews({ page: 1, limit: EXTRA_LIMIT })),
        runList('placements', () => apiGetPlacements({ page: 1, limit: EXTRA_LIMIT })),
        runList('contacts', () => apiGetContacts({ page: 1, limit: EXTRA_LIMIT })),
        runList('calendar', () =>
          apiGetUnifiedCalendar({
            start: start.toISOString(),
            end: end.toISOString(),
          }),
        ),
        runMetric('jobMetrics', () => apiGetJobMetrics()),
        runMetric('clientMetrics', () => apiGetClientMetrics()),
        runMetric('candidateStats', () => apiGetCandidateStats()),
        runMetric('interviewKpis', () => apiGetInterviewKpis()),
        runMetric('placementStats', () => apiGetPlacementStats()),
        runMetric('taskStats', () => apiGetTaskStats()),
      ]);

    health.partial = health.failed.length > 0 && health.ok.length > 0;

    const snap: TenantSnapshot = {
      loadedAt: Date.now(),
      leads,
      clients,
      jobs,
      candidates,
      interviews,
      placements,
      tasks,
      contacts,
      calendarEvents,
      metrics: {
        jobs: jobMetrics,
        clients: clientMetrics,
        candidates: candidateStats,
        interviews: interviewKpis,
        placements: placementStats,
        tasks: taskStats,
      },
      loadHealth: health,
    };
    snapshotCache = snap;
    return snap;
  })();

  try {
    return await snapshotInflight;
  } finally {
    snapshotInflight = null;
  }
}

export const HRYANTRA_AI_WELCOME = [
  '**HRYantra AI** is ready.',
  '',
  'I think across your **live CRM** — leads, clients, jobs, candidates, interviews, placements, tasks, contacts, and calendar — then rank what matters most.',
  '',
  'I can also explain **any sidebar module**:',
  '• Pipeline, Matches, Tasks & Activities, Inbox, Contacts',
  '• Reports, Billing, Recycle Bin, Activity log',
  '• Team, Request, Approvals, Settings',
  '',
  'Try: “How does Pipeline work?”, “How do I use Matches?”, “How do Approvals work?”',
  '',
  'Ask smart CRM questions like:',
  '• “What should I do next?”',
  '• “Where are the risks today?”',
  '• “Which leads need follow-up?”',
  '• “Find Acme across CRM”',
  '',
  '_Private to your company · no OpenAI · no external AI keys._',
].join('\n');

function helpText(): string {
  return [
    '**Smart mode · what I can do**',
    'I score intents, search fuzzily, recommend next actions from live data, and explain **every Phase 2 sidebar module**.',
    '',
    '**How-to guides (ask any of these)**',
    '• CRM: lead, client, dashboard',
    '• Recruitment: job, candidate, interview, placement, recruitment dashboard',
    '• Recruitment Hub: pipeline, matches',
    '• Tasks & Activities, Inbox, Contacts',
    '• Reports, Billing, Recycle Bin, Activity log',
    '• Team Management: team, request, approvals',
    '• Settings',
    '',
    '**Best CRM prompts**',
    '• What should I focus on today?',
    '• Show risks / bottlenecks',
    '• Overdue follow-ups + hot leads',
    '• Open jobs vs candidates in pipeline',
    '• Interviews this week',
    '• Overdue tasks by priority',
    '• Search “Apex” or any company/person',
    '',
    'Tip: ask “how does X work?” for any menu name — even with spelling mistakes.',
  ].join('\n');
}

type HowToTopic =
  | 'overview'
  | 'lead'
  | 'client'
  | 'job'
  | 'candidate'
  | 'interview'
  | 'placement'
  | 'task'
  | 'contact'
  | 'calendar'
  | 'billing'
  | 'pipeline'
  | 'matches'
  | 'inbox'
  | 'reports'
  | 'recycle_bin'
  | 'activity_log'
  | 'team'
  | 'request'
  | 'approvals'
  | 'settings'
  | 'recruitment_hub'
  | 'dashboard';

const HOW_TO_GUIDES: Record<HowToTopic, string> = {
  overview: [
    '**How HRYantra Phase 2 works**',
    '',
    '**CRM**',
    '1. **Leads** — capture prospects',
    '2. **Clients** — company accounts',
    '3. **Dashboard** — CRM overview',
    '',
    '**Recruitment**',
    '4. **Jobs → Candidates → Interviews → Placements**',
    '5. **Recruitment Dashboard** — hiring KPIs',
    '',
    '**Recruitment Hub**',
    '6. **Pipeline** — stage board across roles',
    '7. **Matches** — candidate ↔ job matching',
    '',
    '**Daily work**',
    '8. **Tasks & Activities** · **Inbox** · **Contacts**',
    '',
    '**Ops**',
    '9. **Reports** · **Billing** · **Recycle Bin** · **Activity log**',
    '',
    '**Team Management**',
    '10. **Team** · **Request** · **Approvals**',
    '',
    '11. **Settings** — org, permissions, notifications, billing prefs',
    '',
    'Ask: “How does Pipeline work?”, “How do I use Inbox?”, “How do Approvals work?”',
  ].join('\n'),

  lead: [
    '**How to create a Lead — step by step**',
    '',
    '**Step 1.** Open the left sidebar → **CRM → Leads** (route `/leads`).',
    '**Step 2.** Click **Add Lead** at the top of the Leads page.',
    '**Step 3.** Fill company details in the Add Lead drawer:',
    '   • Company name, industry, location',
    '   • Status, priority, and assignee',
    '**Step 4.** Add the primary contact:',
    '   • Name, email, phone',
    '**Step 5.** Add agreements / notes if needed.',
    '**Step 6.** Click **Create Lead** to save.',
    '**Step 7.** Open the lead afterward to set follow-ups, documents, or convert toward a client.',
    '',
    '**Tips**',
    '• Mark hot prospects as high priority — ask me “Show hot leads”.',
    '• Set a next follow-up date so overdue follow-ups stay visible.',
    '',
    'Also ask: “How do I add a client?” or “What should I do next?”',
  ].join('\n'),

  client: [
    '**How to create a Client — step by step**',
    '',
    '**Step 1.** Open the left sidebar → **CRM → Clients** (route `/client`).',
    '**Step 2.** Click the **Add Client** button at the top of the Clients page.',
    '**Step 3.** In the Add Client drawer, fill the required company details:',
    '   • Company / account name',
    '   • Industry, location, and status',
    '   • Assignees / owners',
    '**Step 4.** Add the primary director / contact:',
    '   • Name, email, phone, salutation',
    '**Step 5.** Optionally attach logo, agreements, or extra notes.',
    '**Step 6.** Click **Create Client** / save to submit the form.',
    '**Step 7.** Open the new client record to add more contacts, jobs, or activity.',
    '',
    '**Tips**',
    '• Clients = hiring company accounts. Leads = earlier prospects.',
    '• After the client is created, go to **Recruitment → Jobs** to open roles under that client.',
    '',
    'Also ask: “How do I create a job?” or “How do I create a lead?”',
  ].join('\n'),

  job: [
    '**How to create a Job / opening — step by step**',
    '',
    '**Step 1.** Open **Recruitment → Jobs** (`/job`).',
    '**Step 2.** Click **Add Job** / create opening.',
    '**Step 3.** Choose the **client**, role title, location, and hiring details.',
    '**Step 4.** Set status (open / on hold / closed) and owners.',
    '**Step 5.** Save the job, then add candidates from Jobs or Candidates.',
    '',
    '**Tips**',
    '• Keep jobs linked to the right client for clean reporting.',
    '• Ask “Compare open jobs vs candidates” for pipeline health.',
  ].join('\n'),

  candidate: [
    '**How to add a Candidate — step by step**',
    '',
    '**Step 1.** Open **Recruitment → Candidates** (`/candidate`), or open a **Job**.',
    '**Step 2.** Click **Add Candidate** (or add-to-job from the job page).',
    '**Step 3.** Enter profile: name, contact, skills, experience, stage.',
    '**Step 4.** Link to the relevant job / client.',
    '**Step 5.** Save, then move stages → interviews → placement.',
    '',
    'Also ask: “How does Pipeline work?” or “How does the interview process work?”',
  ].join('\n'),

  interview: [
    '**Interview process in HRYantra — step by step**',
    '',
    '**Step 1.** Keep the candidate on a **Job** pipeline stage.',
    '**Step 2.** Open **Recruitment → Interviews** (`/interviews`) or schedule from candidate/job.',
    '**Step 3.** Set date, time, panel, and mode (online/onsite).',
    '**Step 4.** Track status: scheduled → completed / no-show / cancelled.',
    '**Step 5.** Capture feedback / outcome.',
    '**Step 6.** Advance round, reject, or move to **Placement**.',
    '',
    'Also ask: “How do I create a placement?”',
  ].join('\n'),

  placement: [
    '**How to create a Placement — step by step**',
    '',
    '**Step 1.** Open **Recruitment → Placements** (`/placement`).',
    '**Step 2.** Create placement for hired candidate + client/job.',
    '**Step 3.** Fill offer / joining details: package, joining date, status.',
    '**Step 4.** Save and track joining / replacement if needed.',
    '**Step 5.** Create invoice from placement via **Billing** when fees apply.',
    '',
    'Also ask: “How does billing work?”',
  ].join('\n'),

  task: [
    '**How Tasks & Activities works — step by step**',
    '',
    '**Step 1.** Open **Tasks & Activities** from the sidebar (`/Task&Activites`).',
    '**Step 2.** Click **Add Task** / create activity.',
    '**Step 3.** Set title, priority, due date, assignee, and related CRM record.',
    '**Step 4.** Save and complete/check off when done.',
    '**Step 5.** Use filters for overdue / today / my tasks.',
    '',
    '**Tips**',
    '• Pair tasks with lead follow-ups so nothing slips.',
    '• Ask me “Show overdue tasks”.',
  ].join('\n'),

  contact: [
    '**How Contacts works — step by step**',
    '',
    '**Step 1.** Open **Contacts** from the sidebar (`/contacts`), or a Lead/Client **Contacts** tab.',
    '**Step 2.** Click **Add Contact**.',
    '**Step 3.** Enter name, email, phone, role/title.',
    '**Step 4.** Link the contact to the company (lead/client).',
    '**Step 5.** Save — use contacts for follow-ups and outreach.',
    '',
    'Tip: every client should have at least one primary contact.',
  ].join('\n'),

  calendar: [
    '**How to use Calendar**',
    '',
    '1. Open **Calendar** from the sidebar.',
    '2. Review scheduled interviews and CRM events.',
    '3. Create/schedule interview events from Interviews or related drawers.',
    '4. Ask me “Show interviews this week” or “calendar agenda”.',
  ].join('\n'),

  billing: [
    '**How Billing works in HRYantra — step by step**',
    '',
    'Billing sits after placements: invoice clients, track payments, manage commission/tax.',
    '',
    '**Step 1.** Open **Billing** (`/billing`) — needs billing access.',
    '**Step 2.** Use tabs: Drafts · Invoices · Payments · Clients & Contracts · Commission · Taxes · Settings.',
    '**Step 3.** Create invoice from a **Placement** (Create invoice in Billing).',
    '**Step 4.** Track payment until paid.',
    '**Step 5.** Configure currency, tax, bank details in Billing Settings / Settings → Billing.',
    '',
    'Also ask: “How do I create a placement?”',
  ].join('\n'),

  pipeline: [
    '**How Pipeline works — step by step**',
    '',
    'Pipeline is under **Recruitment Hub** and shows candidates moving across hiring stages.',
    '',
    '**Step 1.** Open **Pipeline** (`/pipeline`).',
    '**Step 2.** Review the stage board (e.g. sourced → screening → interview → offer → joined).',
    '**Step 3.** Filter by job / client / owner if needed.',
    '**Step 4.** Drag or update candidate stage as progress happens.',
    '**Step 5.** Click a card to open candidate/job details for next actions.',
    '',
    '**Tips**',
    '• Keep stages updated so Matches and next-action recommendations stay accurate.',
    '• Ask: “How do Matches work?” or “How do I add a candidate?”',
  ].join('\n'),

  matches: [
    '**How Matches works — step by step**',
    '',
    'Matches helps connect the right **candidates** to open **jobs**.',
    '',
    '**Step 1.** Open **Matches** (`/matches`).',
    '**Step 2.** Pick a job or candidate context to review suggested matches.',
    '**Step 3.** Review fit signals (skills, experience, role alignment).',
    '**Step 4.** Shortlist / advance strong matches into the pipeline.',
    '**Step 5.** Reject or park weak matches and continue reviewing.',
    '',
    'Also ask: “How does Pipeline work?”',
  ].join('\n'),

  inbox: [
    '**How Inbox works — step by step**',
    '',
    '**Step 1.** Open **Inbox** (`/inbox`) — badge shows unread items.',
    '**Step 2.** Review messages / notifications / conversation threads.',
    '**Step 3.** Open an item to read details and linked CRM records.',
    '**Step 4.** Reply, assign, or mark as done/read.',
    '**Step 5.** Use filters (unread / all) to clear backlog.',
    '',
    'Tip: treat Inbox as your communication queue alongside Tasks & Activities.',
  ].join('\n'),

  reports: [
    '**How Reports works — step by step**',
    '',
    '**Step 1.** Open **Reports** (`/reports`).',
    '**Step 2.** Choose the report type (hiring, pipeline, placements, billing, etc.).',
    '**Step 3.** Set date range / filters (client, job, owner).',
    '**Step 4.** Run / view the report charts and tables.',
    '**Step 5.** Export if you need to share with leadership.',
    '',
    'Also ask: “What should I do next?” for live action ranking.',
  ].join('\n'),

  recycle_bin: [
    '**How Recycle Bin works — step by step**',
    '',
    'Deleted leads / clients / candidates / jobs land here (soft delete).',
    '',
    '**Step 1.** Open **Recycle Bin** (`/recycle-bin`).',
    '**Step 2.** Find the deleted record (filter by module/type if available).',
    '**Step 3.** **Restore** if it was deleted by mistake.',
    '**Step 4.** Or permanently delete if your role allows.',
    '',
    'Tip: you need delete permission on the related module to see Recycle Bin.',
  ].join('\n'),

  activity_log: [
    '**How Activity log works — step by step**',
    '',
    '**Step 1.** Open **Activity log** (`/activity-feed`).',
    '**Step 2.** Scan recent CRM actions (creates, updates, status changes).',
    '**Step 3.** Filter by module / user / time if needed.',
    '**Step 4.** Open a row to jump to the related record.',
    '',
    'Use this for audit trails and “who changed what”.',
  ].join('\n'),

  team: [
    '**How Team works — step by step**',
    '',
    '**Step 1.** Open **Team Management → Team** (`/team`).',
    '**Step 2.** View members, roles, and access.',
    '**Step 3.** Click **Add member** to invite someone.',
    '**Step 4.** Assign role / permissions.',
    '**Step 5.** Save — member can then use allowed modules.',
    '',
    'Also ask: “How do Approvals work?” or “How do Requests work?”',
  ].join('\n'),

  request: [
    '**How Request works — step by step**',
    '',
    '**Step 1.** Open **Team Management → Request** (`/request`).',
    '**Step 2.** Create a new request (access, change, or team workflow item).',
    '**Step 3.** Fill details and submit.',
    '**Step 4.** Wait for an approver under **Approvals**.',
    '**Step 5.** Track status until approved / rejected.',
    '',
    'Also ask: “How do Approvals work?”',
  ].join('\n'),

  approvals: [
    '**How Approvals works — step by step**',
    '',
    '**Step 1.** Open **Team Management → Approvals** (`/request/approval`).',
    '**Step 2.** Review pending requests assigned to you / your role.',
    '**Step 3.** Open a request and check details.',
    '**Step 4.** **Approve** or **Reject** with a note if needed.',
    '**Step 5.** Requester is updated; access/workflow continues.',
    '',
    'Also ask: “How do I use Team?” or “How do Requests work?”',
  ].join('\n'),

  settings: [
    '**How Settings works — step by step**',
    '',
    '**Step 1.** Open **Settings** (`/setting`).',
    '**Step 2.** Pick a section (profile, notifications, recruitment workflow, billing/subscription, security, customization, etc.).',
    '**Step 3.** Update org preferences and save.',
    '**Step 4.** Confirm permissions/roles if you manage team access.',
    '',
    'Tip: Billing settings also appear under **Billing → Billing Settings**.',
  ].join('\n'),

  recruitment_hub: [
    '**Recruitment Hub overview**',
    '',
    'Recruitment Hub groups hiring workflow views:',
    '• **Pipeline** (`/pipeline`) — stage board for candidates across roles',
    '• **Matches** (`/matches`) — suggested candidate ↔ job fits',
    '',
    'Ask: “How does Pipeline work?” or “How do Matches work?”',
  ].join('\n'),

  dashboard: [
    '**How Dashboards work**',
    '',
    'There are two main dashboards:',
    '• **CRM → Dashboard** (`/dashboard`) — leads/clients CRM KPIs',
    '• **Recruitment → Dashboard** (`/recruitment`) — jobs/candidates/interviews/placements KPIs',
    '',
    '**Step 1.** Open the dashboard from the matching sidebar group.',
    '**Step 2.** Review cards/charts for today’s health.',
    '**Step 3.** Drill into modules that need attention.',
    '',
    'Also ask: “Give me today’s pulse” for a ranked live summary.',
  ].join('\n'),
};

function tokenMatchesAny(token: string, targets: string[]): boolean {
  const t = token.toLowerCase();
  if (t.length < 3) return false;
  return targets.some((target) => {
    if (t === target || t.includes(target) || target.includes(t)) return true;
    // Allow common typos like "clinet" → "client"
    const maxDist = target.length <= 5 ? 1 : 2;
    return Math.abs(t.length - target.length) <= maxDist && editDistance(t, target) <= maxDist;
  });
}

function promptMentionsModule(q: string, aliases: string[]): boolean {
  if (includesAny(q, aliases)) return true;
  const toks = normalize(q).split(' ').filter(Boolean);
  return toks.some((tok) => tokenMatchesAny(tok, aliases));
}

function detectHowToTopic(prompt: string): HowToTopic {
  const q = normalize(prompt);

  // Prefer the module named with create/add/how language (typo-tolerant).
  const checks: Array<{ topic: HowToTopic; aliases: string[] }> = [
    { topic: 'task', aliases: ['tasks and activities', 'task and activities', 'task & activities', 'tasks & activities', 'task', 'tasks', 'todo', 'todos'] },
    { topic: 'pipeline', aliases: ['pipeline', 'pipelines', 'kanban', 'stage board'] },
    { topic: 'matches', aliases: ['match', 'matches', 'matching', 'matchs'] },
    { topic: 'inbox', aliases: ['inbox', 'inboxes', 'messages', 'mailbox'] },
    { topic: 'reports', aliases: ['report', 'reports', 'analytics', 'reporting'] },
    { topic: 'recycle_bin', aliases: ['recycle bin', 'recycle', 'trash', 'soft delete'] },
    { topic: 'activity_log', aliases: ['activity log', 'activity feed', 'activities feed', 'audit log', 'audit trail'] },
    { topic: 'approvals', aliases: ['approval', 'approvals', 'approve', 'approver'] },
    { topic: 'request', aliases: ['request', 'requests', 'raise request'] },
    { topic: 'team', aliases: ['team management', 'team', 'teams', 'members'] },
    { topic: 'settings', aliases: ['setting', 'settings', 'preferences', 'configuration', 'config'] },
    { topic: 'billing', aliases: ['billing', 'billings', 'invoice', 'invoices', 'payment', 'payments', 'commission', 'payout', 'payouts'] },
    { topic: 'dashboard', aliases: ['dashboard', 'dashboards', 'kpi board'] },
    { topic: 'recruitment_hub', aliases: ['recruitment hub', 'recruitmenthub'] },
    { topic: 'client', aliases: ['client', 'clients', 'account', 'accounts', 'clinet', 'cleint', 'clent'] },
    { topic: 'lead', aliases: ['lead', 'leads', 'prospect', 'prospects', 'leed', 'leds'] },
    { topic: 'interview', aliases: ['interview', 'interviews', 'panel', 'interveiw', 'inteview'] },
    { topic: 'placement', aliases: ['placement', 'placements', 'offer', 'joining', 'joiner', 'hired'] },
    { topic: 'candidate', aliases: ['candidate', 'candidates', 'talent', 'applicant', 'candiate', 'candidte'] },
    { topic: 'job', aliases: ['job', 'jobs', 'opening', 'vacancy', 'requisition', 'role'] },
    { topic: 'contact', aliases: ['contact', 'contacts'] },
    { topic: 'calendar', aliases: ['calendar', 'agenda', 'schedule'] },
  ];

  for (const check of checks) {
    if (promptMentionsModule(q, check.aliases)) return check.topic;
  }
  return 'overview';
}

function answerHowTo(prompt: string): string {
  const topic = detectHowToTopic(prompt);
  const guide = HOW_TO_GUIDES[topic];
  if (topic === 'overview') {
    return [
      guide,
      '',
      '_Tip: name the module for a full guide — e.g. “how to create a client” or “how to create a lead”._',
    ].join('\n');
  }
  return guide;
}

function detectIntent(prompt: string, history: HrYantraChatMessage[] = []): ScoredIntent[] {
  let q = normalize(prompt);
  const lastUser = [...history].reverse().find((m) => m.role === 'user' && m.id !== 'welcome');
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant' && m.id !== 'welcome');

  // Short follow-ups inherit previous topic
  if (
    includesAny(q, ['more', 'same', 'those', 'them', 'details', 'continue', 'next', 'only high', 'only overdue']) &&
    lastUser?.content
  ) {
    q = `${normalize(lastUser.content)} ${q}`;
  }

  const scores: Record<IntentId, number> = {
    help: 0,
    howto: 0,
    pulse: 0,
    next_actions: 0,
    risks: 0,
    followups: 0,
    hot_leads: 0,
    leads: 0,
    clients: 0,
    contacts: 0,
    jobs: 0,
    candidates: 0,
    interviews: 0,
    calendar: 0,
    placements: 0,
    tasks: 0,
    compare: 0,
    search: 0,
    unknown: 0.1,
  };

  scores.help += scoreKeywords(q, [
    { words: ['help', 'what can you', 'capabilities', 'who are you', 'commands'], weight: 5 },
  ]);
  scores.howto += scoreKeywords(q, [
    {
      words: [
        'how to',
        'how do i',
        'how can i',
        'how does',
        'how do we',
        'how billing',
        'billing works',
        'how invoice',
        'create invoice',
        'steps to',
        'guide',
        'instruction',
        'instructions',
        'walkthrough',
        'tutorial',
        'process in',
        'process of',
        'create a',
        'create the',
        'add a',
        'add new',
        'make a',
        'explain how',
        'what is the process',
        'what is interview process',
        'how does the',
      ],
      weight: 7,
    },
  ]);
  // “how X works” / “how billing works”
  if (includesAny(q, ['how']) && includesAny(q, ['work', 'works', 'working', 'workings'])) {
    scores.howto += 10;
  }
  // Strong boost when user asks process/create/add about a known module
  if (
    includesAny(q, ['how', 'create', 'add', 'process', 'steps', 'guide', 'instruction', 'walkthrough', 'works', 'work', 'explain', 'use', 'using', 'what is', 'what are']) &&
    includesAny(q, [
      'lead',
      'client',
      'job',
      'candidate',
      'interview',
      'placement',
      'task',
      'tasks',
      'activit',
      'contact',
      'calendar',
      'billing',
      'invoice',
      'payment',
      'commission',
      'pipeline',
      'match',
      'matches',
      'inbox',
      'report',
      'reports',
      'recycle',
      'trash',
      'activity',
      'audit',
      'team',
      'request',
      'approval',
      'setting',
      'settings',
      'dashboard',
      'recruitment hub',
      'hryantra',
      'system',
      'sidebar',
      'menu',
      'module',
    ])
  ) {
    scores.howto += 8;
  }
  // Bare sidebar module names with light question words still count as how-to
  if (
    includesAny(q, [
      'pipeline',
      'matches',
      'inbox',
      'reports',
      'recycle bin',
      'activity log',
      'approvals',
      'billing',
      'settings',
      'team management',
    ]) &&
    includesAny(q, ['how', 'what', 'explain', 'tell', 'guide', 'work', 'works', 'use', 'using', 'mean', 'about'])
  ) {
    scores.howto += 9;
  }
  scores.pulse += scoreKeywords(q, [
    { words: ['pulse', 'overview', 'summary', 'dashboard', 'kpi', 'brief', 'today', 'status', 'health'], weight: 4 },
  ]);
  scores.next_actions += scoreKeywords(q, [
    { words: ['what should i', 'next action', 'focus', 'priorit', 'recommend', 'do next', 'action plan', 'where to start'], weight: 6 },
  ]);
  scores.risks += scoreKeywords(q, [
    { words: ['risk', 'bottleneck', 'stuck', 'blocker', 'problem', 'issue', 'alert', 'warning', 'attention'], weight: 6 },
  ]);
  scores.followups += scoreKeywords(q, [
    { words: ['follow up', 'followup', 'next follow', 'call back', 'overdue follow'], weight: 6 },
  ]);
  scores.hot_leads += scoreKeywords(q, [
    { words: ['hot lead', 'high priority', 'priority lead', 'warm lead', 'qualified lead'], weight: 6 },
  ]);
  scores.leads += scoreKeywords(q, [{ words: ['lead', 'leads', 'prospect'], weight: 4 }]);
  scores.clients += scoreKeywords(q, [{ words: ['client', 'clients', 'account', 'accounts'], weight: 4 }]);
  scores.contacts += scoreKeywords(q, [{ words: ['contact', 'contacts'], weight: 4 }]);
  scores.jobs += scoreKeywords(q, [
    { words: ['job', 'jobs', 'opening', 'openings', 'vacancy', 'vacancies', 'requisition', 'role'], weight: 4 },
  ]);
  scores.candidates += scoreKeywords(q, [
    { words: ['candidate', 'candidates', 'talent', 'pipeline', 'applicant', 'applicants'], weight: 4 },
  ]);
  scores.interviews += scoreKeywords(q, [
    { words: ['interview', 'interviews', 'panel'], weight: 5 },
  ]);
  scores.calendar += scoreKeywords(q, [
    { words: ['calendar', 'agenda', 'schedule', 'events'], weight: 4 },
  ]);
  scores.placements += scoreKeywords(q, [
    { words: ['placement', 'placements', 'joined', 'offer', 'hired', 'joiners'], weight: 5 },
  ]);
  scores.tasks += scoreKeywords(q, [
    { words: ['task', 'tasks', 'todo', 'to do', 'checklist'], weight: 5 },
  ]);
  scores.compare += scoreKeywords(q, [
    { words: ['compare', 'vs', 'versus', 'against', 'ratio', 'gap between'], weight: 5 },
  ]);

  // Bare name-like queries → search (skip when this looks like a how-to question)
  const toks = tokensOf(prompt);
  const looksLikeHowTo =
    scores.howto >= 7 ||
    includesAny(q, [
      'how to',
      'how do',
      'how can',
      'how does',
      'how billing',
      'billing works',
      'process',
      'steps to',
      'create a',
      'add a',
      'explain',
    ]) ||
    (includesAny(q, ['how', 'what', 'explain']) &&
      includesAny(q, [
        'work',
        'works',
        'working',
        'billing',
        'invoice',
        'pipeline',
        'matches',
        'inbox',
        'reports',
        'recycle',
        'activity',
        'team',
        'request',
        'approval',
        'setting',
        'settings',
        'task',
        'contact',
      ]));
  if (
    !looksLikeHowTo &&
    toks.length >= 1 &&
    toks.length <= 4 &&
    !includesAny(q, ['how many', 'show', 'list', 'overview'])
  ) {
    const entityHint = scores.leads + scores.clients + scores.jobs + scores.candidates;
    if (entityHint < 3) scores.search += 3 + toks.join('').length * 0.2;
  }
  if (includesAny(q, ['find', 'search', 'look up', 'lookup', 'who is', 'where is'])) {
    scores.search += 5;
  }

  // If assistant previously talked about an entity and user says "more"
  if (lastAssistant?.content && includesAny(normalize(prompt), ['more', 'continue', 'details'])) {
    const prev = normalize(lastAssistant.content);
    if (prev.includes('how to') || prev.includes('process')) scores.howto += 4;
    if (prev.includes('lead')) scores.leads += 3;
    if (prev.includes('job')) scores.jobs += 3;
    if (prev.includes('interview')) scores.interviews += 3;
    if (prev.includes('task')) scores.tasks += 3;
    if (prev.includes('candidate')) scores.candidates += 3;
  }

  return (Object.entries(scores) as Array<[IntentId, number]>)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

function buildPulse(snap: TenantSnapshot): string {
  const openJobs = snap.jobs.filter(isOpenJob).length;
  const hotLeads = snap.leads.filter(isHotLead).length;
  const overdueFollowUps = snap.leads.filter(isOverdueFollowUp).length;
  const dueSoon = snap.leads.filter((l) => isDueSoonFollowUp(l, 48)).length;
  const convertedLeads = snap.leads.filter((l) => statusOf(l).includes('converted')).length;
  const overdueTasks = snap.tasks.filter(isOverdueTask).length;
  const upcomingInterviews = snap.interviews.filter(isUpcomingInterview).length;
  const interviewsToday = snap.interviews.filter((i) => isToday(interviewWhen(i))).length;
  const interviewsWeek = snap.interviews.filter((i) => isWithinDays(interviewWhen(i), 7)).length;

  const m = snap.metrics;
  const hired = metricValue(m.candidates, 'hired');
  const interviewing = metricValue(m.candidates, 'interviewing');
  const activeClients = metricValue(m.clients, 'activeClients');
  const placementsMonth = metricValue(m.clients, 'placementsThisMonth');
  const revenue = m.clients?.revenueGenerated?.formatted || null;

  return [
    '**Recruiting pulse · live workspace**',
    '',
    '**Attention now**',
    `• Overdue follow-ups: **${overdueFollowUps}** · due in 48h: **${dueSoon}**`,
    `• Overdue tasks: **${overdueTasks}** · interviews today: **${interviewsToday}**`,
    '',
    '**Pipeline**',
    `• Leads **${snap.leads.length}** (hot **${hotLeads}**, converted **${convertedLeads}**)`,
    `• Clients **${snap.clients.length}**${activeClients != null ? ` · active **${activeClients}**` : ''}`,
    `• Jobs **${snap.jobs.length}** · open **${openJobs}**`,
    `• Candidates **${snap.candidates.length}**${interviewing != null ? ` · interviewing **${interviewing}**` : ''}${hired != null ? ` · hired **${hired}**` : ''}`,
    `• Interviews upcoming **${upcomingInterviews}** · this week **${interviewsWeek}**`,
    `• Placements **${snap.placements.length}**${placementsMonth != null ? ` · this month **${placementsMonth}**` : ''}`,
    `• Contacts **${snap.contacts.length}** · calendar events **${snap.calendarEvents.length}**`,
    revenue ? `• Revenue signal: **${revenue}**` : null,
    '',
    '_Ask “what should I do next?” for a ranked action plan._',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildNextActions(snap: TenantSnapshot): string {
  type Action = { score: number; title: string; why: string };
  const actions: Action[] = [];

  const overdueFollowUps = snap.leads
    .filter(isOverdueFollowUp)
    .sort((a, b) => leadUrgencyScore(b) - leadUrgencyScore(a));
  if (overdueFollowUps.length) {
    const top = overdueFollowUps[0];
    actions.push({
      score: 100 + overdueFollowUps.length,
      title: `Clear ${overdueFollowUps.length} overdue lead follow-up${overdueFollowUps.length > 1 ? 's' : ''}`,
      why: `Start with **${nameOf(top) || 'top lead'}** (due ${formatWhen(top.nextFollowUp)}).`,
    });
  }

  const dueSoon = snap.leads.filter((l) => isDueSoonFollowUp(l, 24));
  if (dueSoon.length) {
    actions.push({
      score: 80 + dueSoon.length,
      title: `Prep ${dueSoon.length} follow-up${dueSoon.length > 1 ? 's' : ''} due in 24h`,
      why: dueSoon
        .slice(0, 2)
        .map((l) => nameOf(l) || 'Lead')
        .join(', '),
    });
  }

  const overdueTasks = snap.tasks.filter(isOverdueTask);
  if (overdueTasks.length) {
    actions.push({
      score: 70 + overdueTasks.length,
      title: `Close ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`,
      why: overdueTasks
        .slice(0, 2)
        .map((t) => t.title || t.name || 'Task')
        .join(', '),
    });
  }

  const interviewsToday = snap.interviews.filter((i) => isToday(interviewWhen(i)));
  if (interviewsToday.length) {
    actions.push({
      score: 90 + interviewsToday.length,
      title: `Run ${interviewsToday.length} interview${interviewsToday.length > 1 ? 's' : ''} today`,
      why: interviewsToday
        .slice(0, 2)
        .map((i) => i.candidateName || i.candidate?.name || 'Candidate')
        .join(', '),
    });
  }

  const openJobs = snap.jobs.filter(isOpenJob);
  const interviewing = snap.candidates.filter((c) =>
    statusOf(c).includes('interview'),
  ).length;
  if (openJobs.length && interviewing === 0) {
    actions.push({
      score: 55,
      title: 'Push candidates into interview for open roles',
      why: `You have **${openJobs.length}** open jobs but no candidates marked interviewing.`,
    });
  }

  const hotNoFollowUp = snap.leads.filter(
    (l) => isHotLead(l) && !l.nextFollowUp && !statusOf(l).includes('converted'),
  );
  if (hotNoFollowUp.length) {
    actions.push({
      score: 65 + hotNoFollowUp.length,
      title: `Schedule follow-ups for ${hotNoFollowUp.length} hot lead${hotNoFollowUp.length > 1 ? 's' : ''}`,
      why: hotNoFollowUp
        .slice(0, 2)
        .map((l) => nameOf(l) || 'Lead')
        .join(', '),
    });
  }

  const noOwnerLeads = snap.leads.filter(
    (l) => !l.assignedToId && !(Array.isArray(l.assignedToIds) && l.assignedToIds.length),
  );
  if (noOwnerLeads.length) {
    actions.push({
      score: 40 + Math.min(noOwnerLeads.length, 20),
      title: `Assign owners to ${noOwnerLeads.length} unassigned lead${noOwnerLeads.length > 1 ? 's' : ''}`,
      why: 'Unowned leads stall conversion.',
    });
  }

  actions.sort((a, b) => b.score - a.score);
  if (!actions.length) {
    return [
      '**Next actions**',
      'Your workspace looks calm — no urgent overdue follow-ups, tasks, or interviews today.',
      'Try: “show open jobs” or “candidate pipeline summary”.',
    ].join('\n');
  }

  return [
    '**What you should do next** (ranked)',
    '',
    ...actions.slice(0, 6).map((a, i) => `${i + 1}. **${a.title}**\n   ${a.why}`),
    '',
    '_Ask “show overdue follow-ups” or “interviews today” to dive in._',
  ].join('\n');
}

function buildRisks(snap: TenantSnapshot): string {
  const risks: string[] = [];
  const overdueFollowUps = snap.leads.filter(isOverdueFollowUp).length;
  const overdueTasks = snap.tasks.filter(isOverdueTask).length;
  const hotNoFollowUp = snap.leads.filter(
    (l) => isHotLead(l) && !l.nextFollowUp && !statusOf(l).includes('converted'),
  ).length;
  const openJobs = snap.jobs.filter(isOpenJob).length;
  const activeCandidates = snap.candidates.filter(
    (c) => !['rejected', 'hired', 'joined', 'withdrawn'].includes(statusOf(c)),
  ).length;
  const interviewsToday = snap.interviews.filter((i) => isToday(interviewWhen(i))).length;
  const lostish = snap.leads.filter((l) => statusOf(l).includes('lost') || statusOf(l).includes('cold')).length;

  if (overdueFollowUps > 0) {
    risks.push(`🔴 **${overdueFollowUps}** overdue lead follow-ups — conversion risk.`);
  }
  if (overdueTasks > 0) {
    risks.push(`🟠 **${overdueTasks}** overdue tasks — execution backlog.`);
  }
  if (hotNoFollowUp > 0) {
    risks.push(`🟠 **${hotNoFollowUp}** hot/high leads with no next follow-up scheduled.`);
  }
  if (openJobs > 0 && activeCandidates < openJobs) {
    risks.push(
      `🟡 Pipeline thin vs demand — **${openJobs}** open jobs vs **${activeCandidates}** active candidates.`,
    );
  }
  if (interviewsToday > 3) {
    risks.push(`🟡 Heavy interview day — **${interviewsToday}** interviews today. Protect prep time.`);
  }
  if (lostish > snap.leads.length * 0.25 && snap.leads.length > 8) {
    risks.push(`🟡 Elevated lost/cold share — **${lostish}** of **${snap.leads.length}** leads.`);
  }

  if (!risks.length) {
    return '**Risk scan**\nNo major red flags from current live data. Keep momentum with open jobs and hot leads.';
  }

  return ['**Risk & bottleneck scan**', '', ...risks, '', '_Ask “what should I do next?” for a fix order._'].join(
    '\n',
  );
}

function buildCompare(snap: TenantSnapshot): string {
  const openJobs = snap.jobs.filter(isOpenJob).length;
  const activeCandidates = snap.candidates.filter(
    (c) => !['rejected', 'hired', 'joined', 'withdrawn'].includes(statusOf(c)),
  ).length;
  const interviewing = snap.candidates.filter((c) => statusOf(c).includes('interview')).length;
  const upcomingInterviews = snap.interviews.filter(isUpcomingInterview).length;
  const hotLeads = snap.leads.filter(isHotLead).length;
  const clients = snap.clients.length;
  const placements = snap.placements.length;
  const ratio = openJobs > 0 ? (activeCandidates / openJobs).toFixed(1) : '—';

  return [
    '**Compare · demand vs supply**',
    '',
    `• Open jobs: **${openJobs}**`,
    `• Active candidates: **${activeCandidates}** (≈ **${ratio}** per open job)`,
    `• In interviewing stage: **${interviewing}**`,
    `• Upcoming interviews: **${upcomingInterviews}**`,
    `• Hot leads: **${hotLeads}** · Clients: **${clients}** · Placements: **${placements}**`,
    '',
    openJobs > activeCandidates
      ? '_Insight: demand exceeds active talent — prioritize sourcing/screening._'
      : '_Insight: talent supply looks healthy vs open roles — push interviews & offers._',
  ].join('\n');
}

function answerEntity(
  intent: IntentId,
  prompt: string,
  snap: TenantSnapshot,
): string {
  const q = normalize(prompt);
  const wantsCount = includesAny(q, ['how many', 'count', 'total', 'number']);

  if (intent === 'followups') {
    const overdue = snap.leads
      .filter(isOverdueFollowUp)
      .sort((a, b) => leadUrgencyScore(b) - leadUrgencyScore(a));
    const upcoming = snap.leads
      .filter((l) => l?.nextFollowUp && !isOverdueFollowUp(l))
      .sort(
        (a, b) =>
          new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime(),
      );
    if (includesAny(q, ['overdue', 'missed', 'late'])) {
      return `Overdue lead follow-ups: **${overdue.length}**\n${listPreview(
        overdue,
        (l) =>
          `${nameOf(l) || 'Lead'} — ${l.priority || '—'} — ${l.status || '—'} — due ${formatWhen(l.nextFollowUp)}`,
      )}`;
    }
    return [
      `Follow-ups — overdue **${overdue.length}**, upcoming **${upcoming.length}**`,
      '',
      '**Overdue (priority ranked)**',
      listPreview(overdue, (l) => `${nameOf(l)} — ${formatWhen(l.nextFollowUp)}`),
      '',
      '**Next up**',
      listPreview(upcoming, (l) => `${nameOf(l)} — ${formatWhen(l.nextFollowUp)}`),
    ].join('\n');
  }

  if (intent === 'hot_leads') {
    const hot = snap.leads
      .filter(isHotLead)
      .sort((a, b) => leadUrgencyScore(b) - leadUrgencyScore(a));
    return `Hot / high-priority leads: **${hot.length}**\n${listPreview(
      hot,
      (l) =>
        `${nameOf(l)} — ${l.priority || '—'} — ${l.status || '—'} — next ${formatWhen(l.nextFollowUp)}`,
    )}`;
  }

  if (intent === 'leads') {
    if (wantsCount) {
      return [
        `You have **${snap.leads.length}** leads.`,
        '',
        '**By status**',
        formatBreakdown(countBy(snap.leads, (l) => String(l?.status || 'Unknown'))),
        '',
        '**By priority**',
        formatBreakdown(countBy(snap.leads, (l) => String(l?.priority || 'Unset'))),
      ].join('\n');
    }
    const ranked = [...snap.leads].sort((a, b) => leadUrgencyScore(b) - leadUrgencyScore(a));
    return `Leads ranked by urgency (**${snap.leads.length}**):\n${listPreview(
      ranked,
      (l) =>
        `${nameOf(l) || 'Untitled'} — ${l.status || '—'} — ${l.priority || '—'} — next ${formatWhen(l.nextFollowUp)}`,
    )}`;
  }

  if (intent === 'clients') {
    if (wantsCount) {
      const active = metricValue(snap.metrics.clients, 'activeClients');
      return [
        `You have **${snap.clients.length}** clients${active != null ? ` (active metric **${active}**)` : ''}.`,
        '',
        '**By status**',
        formatBreakdown(countBy(snap.clients, (c) => String(c?.status || c?.stage || 'Unknown'))),
      ].join('\n');
    }
    return `Clients (**${snap.clients.length}**):\n${listPreview(
      snap.clients,
      (c) =>
        `${nameOf(c) || 'Untitled'} — ${c.status || c.stage || '—'} — ${c.industry || c.location || '—'}`,
    )}`;
  }

  if (intent === 'contacts') {
    return wantsCount
      ? `You have **${snap.contacts.length}** contacts.`
      : `Contacts (**${snap.contacts.length}**):\n${listPreview(
          snap.contacts,
          (c) =>
            `${c.name || c.fullName || nameOf(c) || 'Contact'} — ${c.email || '—'} — ${c.type || c.designation || '—'}`,
        )}`;
  }

  if (intent === 'jobs') {
    const openJobs = snap.jobs.filter(isOpenJob);
    if (includesAny(q, ['open', 'active', 'published']) || (!wantsCount && includesAny(q, ['show', 'list']))) {
      if (includesAny(q, ['open', 'active', 'published'])) {
        return `Open/active jobs: **${openJobs.length}**\n${listPreview(
          openJobs,
          (j) =>
            `${nameOf(j) || 'Role'} — ${j.status || 'Open'} — ${j.location || j.clientName || j.companyName || '—'}`,
        )}`;
      }
    }
    if (wantsCount) {
      return [
        `Jobs **${snap.jobs.length}** · open **${openJobs.length}**`,
        '',
        '**By status**',
        formatBreakdown(countBy(snap.jobs, (j) => String(j?.status || 'Unknown'))),
      ].join('\n');
    }
    return `Jobs (**${snap.jobs.length}**):\n${listPreview(
      snap.jobs,
      (j) => `${nameOf(j) || 'Role'} — ${j.status || '—'} — ${j.location || '—'}`,
    )}`;
  }

  if (intent === 'candidates') {
    const stats = snap.metrics.candidates || {};
    if (wantsCount || includesAny(q, ['pipeline', 'stage', 'summary'])) {
      const metricLines = Object.entries(stats)
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => `  · ${k}: ${v}`)
        .join('\n');
      return [
        `Candidates **${snap.candidates.length}**`,
        '',
        '**Pipeline metrics**',
        metricLines ||
          formatBreakdown(countBy(snap.candidates, (c) => String(c?.stage || c?.status || 'Unknown'))),
      ].join('\n');
    }
    return `Candidates (**${snap.candidates.length}**):\n${listPreview(
      snap.candidates,
      (c) =>
        `${c.fullName || c.name || nameOf(c) || 'Unnamed'} — ${c.stage || c.status || '—'} — ${c.email || '—'}`,
    )}`;
  }

  if (intent === 'interviews' || intent === 'calendar') {
    if (intent === 'calendar' || includesAny(q, ['calendar', 'agenda', 'events'])) {
      return `Calendar events: **${snap.calendarEvents.length}**\n${listPreview(
        snap.calendarEvents,
        (e) =>
          `${e.title || e.name || e.type || 'Event'} — ${formatWhen(e.start || e.scheduledAt || e.date)} — ${e.status || '—'}`,
      )}`;
    }
    const upcoming = snap.interviews.filter(isUpcomingInterview);
    const today = snap.interviews.filter((i) => isToday(interviewWhen(i)));
    const week = snap.interviews.filter((i) => isWithinDays(interviewWhen(i), 7));
    const list = includesAny(q, ['today'])
      ? today
      : includesAny(q, ['week'])
        ? week
        : upcoming;
    if (wantsCount) {
      return `Interviews **${snap.interviews.length}** · upcoming **${upcoming.length}** · today **${today.length}** · this week **${week.length}**.`;
    }
    return [
      `Interviews — showing **${list.length}** (${includesAny(q, ['today']) ? 'today' : includesAny(q, ['week']) ? 'this week' : 'upcoming'})`,
      listPreview(
        list,
        (i) =>
          `${i.candidateName || i.candidate?.name || 'Candidate'} — ${
            i.jobTitle || i.job?.title || 'Role'
          } — ${formatWhen(interviewWhen(i))}`,
      ),
    ].join('\n');
  }

  if (intent === 'placements') {
    if (wantsCount || includesAny(q, ['stat', 'summary'])) {
      const month = metricValue(snap.metrics.clients, 'placementsThisMonth');
      return [
        `Placements **${snap.placements.length}**${month != null ? ` · this month **${month}**` : ''}`,
        '',
        '**By status**',
        formatBreakdown(countBy(snap.placements, (p) => String(p?.status || 'Unknown'))),
      ].join('\n');
    }
    return `Placements (**${snap.placements.length}**):\n${listPreview(
      snap.placements,
      (p) =>
        `${p.candidateName || p.candidate?.name || 'Candidate'} → ${
          p.clientName || p.client?.companyName || 'Client'
        } — ${p.status || '—'}`,
    )}`;
  }

  if (intent === 'tasks') {
    const overdue = snap.tasks.filter(isOverdueTask);
    if (includesAny(q, ['overdue', 'pending', 'due']) || !wantsCount) {
      if (includesAny(q, ['overdue', 'pending', 'due'])) {
        return `Overdue tasks: **${overdue.length}**\n${listPreview(
          overdue,
          (t) =>
            `${t.title || t.name || 'Task'} — due ${formatWhen(t.dueDate || t.dueAt)} — ${t.priority || '—'}`,
        )}`;
      }
    }
    if (wantsCount) {
      return [
        `Tasks **${snap.tasks.length}** · overdue **${overdue.length}**`,
        '',
        '**By status**',
        formatBreakdown(countBy(snap.tasks, (t) => String(t?.status || 'Unknown'))),
      ].join('\n');
    }
    return `Tasks (**${snap.tasks.length}**):\n${listPreview(
      snap.tasks,
      (t) => `${t.title || t.name || 'Task'} — ${t.status || '—'} — ${t.priority || '—'}`,
    )}`;
  }

  return '';
}

function answerSearch(prompt: string, snap: TenantSnapshot): string {
  const query = tokensOf(prompt).join(' ') || normalize(prompt);
  const buckets: Array<{ label: string; rows: Array<{ item: any; score: number }> }> = [
    { label: 'Leads', rows: topFuzzy(snap.leads, query) },
    { label: 'Clients', rows: topFuzzy(snap.clients, query) },
    { label: 'Jobs', rows: topFuzzy(snap.jobs, query) },
    { label: 'Candidates', rows: topFuzzy(snap.candidates, query) },
    { label: 'Contacts', rows: topFuzzy(snap.contacts, query) },
  ].filter((b) => b.rows.length);

  const total = buckets.reduce((n, b) => n + b.rows.length, 0);
  if (!total) {
    return `No strong matches for “${prompt.trim()}”. Try another name, or ask “what should I do next?”.`;
  }

  const sections = [`**Smart search** · **${total}** best matches for “${prompt.trim()}”:`];
  for (const bucket of buckets) {
    sections.push(
      `\n${bucket.label} (${bucket.rows.length}):\n${bucket.rows
        .map(
          (r, i) =>
            `${i + 1}. ${nameOf(r.item) || 'Untitled'} — ${r.item.status || r.item.stage || '—'}`,
        )
        .join('\n')}`,
    );
  }
  return sections.join('\n');
}

function answerFromSnapshot(
  prompt: string,
  snap: TenantSnapshot,
  history: HrYantraChatMessage[] = [],
): string {
  const loadError = loadFailureMessage(snap);
  if (loadError) return loadError;

  const intents = detectIntent(prompt, history);
  const top = intents[0];
  const second = intents[1];

  if (!top || top.score < 1.5) {
    const searchHit = answerSearch(prompt, snap);
    if (!searchHit.startsWith('No strong matches')) return searchHit;
    return ['I need a clearer CRM question.', '', helpText()].join('\n');
  }

  if (top.id === 'help') return helpText();
  if (top.id === 'howto') return answerHowTo(prompt);
  if (top.id === 'pulse') {
    const body = buildPulse(snap);
    return snap.loadHealth.partial
      ? `${body}\n\n_Note: some production APIs failed (${snap.loadHealth.failed.length}). Answers use the modules that loaded._`
      : body;
  }
  if (top.id === 'next_actions') return buildNextActions(snap);
  if (top.id === 'risks') return buildRisks(snap);
  if (top.id === 'compare') return buildCompare(snap);
  if (top.id === 'search') return answerSearch(prompt, snap);

  const entityAnswer = answerEntity(top.id, prompt, snap);
  if (entityAnswer) {
    if (second && second.score >= top.score * 0.7 && second.id !== top.id) {
      if (second.id === 'next_actions') {
        return `${entityAnswer}\n\n_Tip: ask “what should I do next?” for a ranked plan._`;
      }
    }
    return entityAnswer;
  }

  return answerSearch(prompt, snap);
}

export async function askHrYantraLocalAssistant(
  prompt: string,
  history: HrYantraChatMessage[] = [],
): Promise<string> {
  const rawQuestion = String(prompt || '').trim();
  if (!rawQuestion) {
    return 'Ask anything — try “What should I do next?”, “How do I create a lead?”, or “Give me today’s pulse”.';
  }

  const spelling = correctSpelling(rawQuestion);
  const question = spelling.corrected;

  // How-to / help answers don't need live CRM data — respond immediately.
  const early = detectIntent(question, history)[0];
  if (early && early.score >= 1.5) {
    if (early.id === 'howto') return withSpellingNote(answerHowTo(question), spelling);
    if (early.id === 'help') return withSpellingNote(helpText(), spelling);
  }

  try {
    const forceRefresh = /fresh|reload|refresh|latest|live now/i.test(question);
    const snap = await loadTenantSnapshot(forceRefresh);
    return withSpellingNote(answerFromSnapshot(question, snap, history), spelling);
  } catch (error: any) {
    const message = String(error?.message || '');
    if (/auth|login|token/i.test(message)) {
      return 'Please sign in to use HRYantra AI. I need your tenant session to read CRM data.';
    }
    return `I could not load tenant data right now. ${message || 'Try again in a moment.'}`;
  }
}

export const HRYANTRA_AI_SUGGESTIONS = [
  { label: 'Do next', prompt: 'What should I do next?' },
  { label: 'How-to', prompt: 'How do I use HRYantra? Show system guides' },
  { label: 'Pipeline', prompt: 'How does Pipeline work?' },
  { label: 'Matches', prompt: 'How do Matches work?' },
  { label: 'Tasks', prompt: 'How do Tasks & Activities work?' },
  { label: 'Inbox', prompt: 'How does Inbox work?' },
  { label: 'Billing', prompt: 'How does billing work?' },
  { label: 'Approvals', prompt: 'How do Approvals work?' },
  { label: 'Settings', prompt: 'How do Settings work?' },
  { label: 'Create lead', prompt: 'How do I create a lead?' },
  { label: 'Add client', prompt: 'How do I add a client?' },
  { label: 'Risks', prompt: 'Where are the risks today?' },
  { label: 'Pulse', prompt: 'Give me today’s recruiting pulse' },
  { label: 'Help', prompt: 'What can you do?' },
];
