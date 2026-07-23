/**
 * HRYantra local assistant — answers from live tenant CRM data.
 * No OpenAI / Mistral / external AI API keys. Uses authenticated tenant APIs only.
 */

import {
  apiGetCandidates,
  apiGetClients,
  apiGetInterviews,
  apiGetJobs,
  apiGetLeads,
  apiGetPlacements,
  apiGetTasks,
} from './api';

export type HrYantraChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type TenantSnapshot = {
  leads: any[];
  clients: any[];
  jobs: any[];
  candidates: any[];
  interviews: any[];
  placements: any[];
  tasks: any[];
};

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
  }
  if (Array.isArray(root.items)) return root.items;
  return [];
}

function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(haystack: string, words: string[]): boolean {
  return words.some((w) => haystack.includes(w));
}

function statusOf(item: any): string {
  return String(item?.status || '').toLowerCase();
}

function nameOf(item: any): string {
  return String(
    item?.companyName ||
      item?.title ||
      item?.name ||
      item?.fullName ||
      item?.candidateName ||
      item?.jobTitle ||
      '',
  );
}

function isOpenJob(job: any): boolean {
  const s = statusOf(job);
  return !s || s.includes('open') || s.includes('active') || s.includes('published');
}

function isOverdueTask(task: any): boolean {
  const due = task?.dueDate || task?.dueAt;
  if (!due) return false;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  const done = ['completed', 'done', 'cancelled'].includes(statusOf(task));
  return !done && d.getTime() < Date.now();
}

function isUpcomingInterview(interview: any): boolean {
  const when = interview?.scheduledAt || interview?.dateTime || interview?.startAt;
  if (!when) return true;
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() >= Date.now() - 60 * 60 * 1000;
}

function listPreview(items: any[], mapLabel: (item: any) => string, limit = 8): string {
  if (!items.length) return 'None found.';
  const rows = items.slice(0, limit).map((item, i) => `${i + 1}. ${mapLabel(item)}`);
  const more = items.length > limit ? `\n…and ${items.length - limit} more.` : '';
  return `${rows.join('\n')}${more}`;
}

async function loadTenantSnapshot(): Promise<TenantSnapshot> {
  const settled = await Promise.allSettled([
    apiGetLeads({ page: 1, limit: 200 }),
    apiGetClients({ page: 1, limit: 200 }),
    apiGetJobs({ page: 1, limit: 200 }),
    apiGetCandidates({ page: 1, limit: 200 }),
    apiGetInterviews({ page: 1, limit: 100 }),
    apiGetPlacements({ page: 1, limit: 100 }),
    apiGetTasks({ page: 1, limit: 200 }),
  ]);

  const pick = (index: number) => {
    const result = settled[index];
    if (result.status !== 'fulfilled') return [];
    return unwrapList(result.value?.data ?? result.value);
  };

  return {
    leads: pick(0),
    clients: pick(1),
    jobs: pick(2),
    candidates: pick(3),
    interviews: pick(4),
    placements: pick(5),
    tasks: pick(6),
  };
}

function helpText(): string {
  return [
    'I am **HRYantra AI** — your tenant CRM assistant.',
    'I answer from your live company data only (no OpenAI / external AI keys).',
    '',
    'Try asking:',
    '• How many leads / clients / jobs / candidates?',
    '• Show open jobs',
    '• Upcoming interviews',
    '• Overdue tasks',
    '• Placement summary',
    '• Find lead ApexForge',
    '• Company overview / dashboard summary',
  ].join('\n');
}

function answerFromSnapshot(prompt: string, snap: TenantSnapshot): string {
  const q = normalize(prompt);

  if (!q || includesAny(q, ['help', 'what can you', 'capabilities', 'who are you'])) {
    return helpText();
  }

  if (includesAny(q, ['overview', 'summary', 'dashboard', 'kpi', 'how is my', 'company status'])) {
    const openJobs = snap.jobs.filter(isOpenJob).length;
    const convertedLeads = snap.leads.filter((l) => statusOf(l).includes('converted')).length;
    const overdueTasks = snap.tasks.filter(isOverdueTask).length;
    const upcomingInterviews = snap.interviews.filter(isUpcomingInterview).length;
    return [
      '**Tenant overview (live data)**',
      `• Leads: ${snap.leads.length} (converted: ${convertedLeads})`,
      `• Clients: ${snap.clients.length}`,
      `• Jobs: ${snap.jobs.length} (open/active: ${openJobs})`,
      `• Candidates: ${snap.candidates.length}`,
      `• Interviews: ${snap.interviews.length} (upcoming: ${upcomingInterviews})`,
      `• Placements: ${snap.placements.length}`,
      `• Tasks: ${snap.tasks.length} (overdue: ${overdueTasks})`,
    ].join('\n');
  }

  if (includesAny(q, ['lead'])) {
    if (includesAny(q, ['how many', 'count', 'total', 'number'])) {
      const byStatus = snap.leads.reduce<Record<string, number>>((acc, lead) => {
        const key = String(lead?.status || 'Unknown');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const statusLines = Object.entries(byStatus)
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => `  - ${status}: ${count}`)
        .join('\n');
      return `You have **${snap.leads.length}** leads.\nBreakdown:\n${statusLines || '  - No status data'}`;
    }
    const searchMatch = q.match(/(?:find|search|show|get)\s+(?:lead|leads)?\s*(.+)$/);
    const term = (searchMatch?.[1] || '').replace(/^(named|called|for)\s+/, '').trim();
    if (term && term !== 'leads' && term !== 'lead') {
      const hits = snap.leads.filter((lead) =>
        normalize(`${nameOf(lead)} ${lead?.email || ''} ${lead?.contactPerson || ''}`).includes(term),
      );
      return `Found **${hits.length}** lead(s) matching “${term}”:\n${listPreview(
        hits,
        (l) => `${nameOf(l) || 'Untitled'} — ${l.status || '—'} — ${l.email || 'no email'}`,
      )}`;
    }
    const recent = [...snap.leads].slice(0, 10);
    return `Showing recent leads (**${snap.leads.length}** total):\n${listPreview(
      recent,
      (l) => `${nameOf(l) || 'Untitled'} — ${l.status || '—'}`,
    )}`;
  }

  if (includesAny(q, ['client', 'clients'])) {
    if (includesAny(q, ['how many', 'count', 'total', 'number'])) {
      return `You have **${snap.clients.length}** clients in this tenant.`;
    }
    return `Clients (**${snap.clients.length}**):\n${listPreview(
      snap.clients,
      (c) => `${nameOf(c) || 'Untitled'} — ${c.status || c.stage || '—'}`,
    )}`;
  }

  if (includesAny(q, ['job', 'jobs', 'opening', 'openings', 'vacancy', 'vacancies'])) {
    const openJobs = snap.jobs.filter(isOpenJob);
    if (includesAny(q, ['open', 'active', 'published'])) {
      return `Open/active jobs: **${openJobs.length}**\n${listPreview(
        openJobs,
        (j) => `${nameOf(j) || 'Untitled role'} — ${j.status || 'Open'}`,
      )}`;
    }
    if (includesAny(q, ['how many', 'count', 'total', 'number'])) {
      return `You have **${snap.jobs.length}** jobs (**${openJobs.length}** open/active).`;
    }
    return `Jobs (**${snap.jobs.length}**):\n${listPreview(
      snap.jobs,
      (j) => `${nameOf(j) || 'Untitled role'} — ${j.status || '—'}`,
    )}`;
  }

  if (includesAny(q, ['candidate', 'candidates', 'talent', 'applicants'])) {
    if (includesAny(q, ['how many', 'count', 'total', 'number'])) {
      return `You have **${snap.candidates.length}** candidates.`;
    }
    return `Candidates (**${snap.candidates.length}**):\n${listPreview(
      snap.candidates,
      (c) =>
        `${c.fullName || c.name || nameOf(c) || 'Unnamed'} — ${c.stage || c.status || '—'}`,
    )}`;
  }

  if (includesAny(q, ['interview', 'interviews'])) {
    const upcoming = snap.interviews.filter(isUpcomingInterview);
    if (includesAny(q, ['upcoming', 'today', 'scheduled', 'next'])) {
      return `Upcoming interviews: **${upcoming.length}**\n${listPreview(
        upcoming,
        (i) =>
          `${i.candidateName || i.candidate?.name || 'Candidate'} — ${
            i.jobTitle || i.job?.title || 'Role'
          } — ${i.scheduledAt || i.dateTime || i.status || '—'}`,
      )}`;
    }
    if (includesAny(q, ['how many', 'count', 'total', 'number'])) {
      return `You have **${snap.interviews.length}** interviews (**${upcoming.length}** upcoming).`;
    }
    return `Interviews (**${snap.interviews.length}**):\n${listPreview(
      snap.interviews,
      (i) =>
        `${i.candidateName || i.candidate?.name || 'Candidate'} — ${i.status || '—'}`,
    )}`;
  }

  if (includesAny(q, ['placement', 'placements', 'joined', 'offer'])) {
    if (includesAny(q, ['how many', 'count', 'total', 'number'])) {
      return `You have **${snap.placements.length}** placements.`;
    }
    return `Placements (**${snap.placements.length}**):\n${listPreview(
      snap.placements,
      (p) =>
        `${p.candidateName || p.candidate?.name || 'Candidate'} → ${
          p.clientName || p.client?.companyName || 'Client'
        } — ${p.status || '—'}`,
    )}`;
  }

  if (includesAny(q, ['task', 'tasks', 'todo', 'to do', 'activity', 'activities'])) {
    const overdue = snap.tasks.filter(isOverdueTask);
    if (includesAny(q, ['overdue', 'pending', 'due'])) {
      return `Overdue tasks: **${overdue.length}**\n${listPreview(
        overdue,
        (t) => `${t.title || t.name || 'Task'} — due ${t.dueDate || t.dueAt || '—'}`,
      )}`;
    }
    if (includesAny(q, ['how many', 'count', 'total', 'number'])) {
      return `You have **${snap.tasks.length}** tasks (**${overdue.length}** overdue).`;
    }
    return `Tasks (**${snap.tasks.length}**):\n${listPreview(
      snap.tasks,
      (t) => `${t.title || t.name || 'Task'} — ${t.status || '—'}`,
    )}`;
  }

  // Generic search across entities
  const tokens = q.split(' ').filter((t) => t.length > 2);
  if (tokens.length) {
    const matchText = (item: any) =>
      normalize(
        `${nameOf(item)} ${item?.email || ''} ${item?.phone || ''} ${item?.status || ''} ${
          item?.title || ''
        }`,
      );
    const hit = (list: any[]) =>
      list.filter((item) => tokens.every((token) => matchText(item).includes(token)));

    const leadHits = hit(snap.leads);
    const clientHits = hit(snap.clients);
    const jobHits = hit(snap.jobs);
    const candidateHits = hit(snap.candidates);
    const total = leadHits.length + clientHits.length + jobHits.length + candidateHits.length;

    if (total > 0) {
      const sections: string[] = [`Found **${total}** matches for “${prompt.trim()}”:`];
      if (leadHits.length) {
        sections.push(
          `\nLeads (${leadHits.length}):\n${listPreview(leadHits, (l) => `${nameOf(l)} — ${l.status || '—'}`)}`,
        );
      }
      if (clientHits.length) {
        sections.push(
          `\nClients (${clientHits.length}):\n${listPreview(clientHits, (c) => `${nameOf(c)} — ${c.status || '—'}`)}`,
        );
      }
      if (jobHits.length) {
        sections.push(
          `\nJobs (${jobHits.length}):\n${listPreview(jobHits, (j) => `${nameOf(j)} — ${j.status || '—'}`)}`,
        );
      }
      if (candidateHits.length) {
        sections.push(
          `\nCandidates (${candidateHits.length}):\n${listPreview(
            candidateHits,
            (c) => `${c.fullName || c.name || nameOf(c)} — ${c.stage || c.status || '—'}`,
          )}`,
        );
      }
      return sections.join('\n');
    }
  }

  return [
    'I could not map that question to a clear CRM query.',
    'Ask about leads, clients, jobs, candidates, interviews, placements, or tasks.',
    'Example: “How many open jobs?” or “Show overdue tasks”.',
    '',
    helpText(),
  ].join('\n');
}

export async function askHrYantraLocalAssistant(prompt: string): Promise<string> {
  const question = String(prompt || '').trim();
  if (!question) {
    return 'Please type a question about your tenant CRM data.';
  }

  try {
    const snap = await loadTenantSnapshot();
    return answerFromSnapshot(question, snap);
  } catch (error: any) {
    const message = String(error?.message || '');
    if (/auth|login|token/i.test(message)) {
      return 'Please sign in to use HRYantra AI. I need your tenant session to read CRM data.';
    }
    return `I could not load tenant data right now. ${message || 'Try again in a moment.'}`;
  }
}

export const HRYANTRA_AI_SUGGESTIONS = [
  { label: 'Overview', prompt: 'Give me a company overview summary' },
  { label: 'Leads count', prompt: 'How many leads do we have?' },
  { label: 'Open jobs', prompt: 'Show open jobs' },
  { label: 'Interviews', prompt: 'Show upcoming interviews' },
  { label: 'Overdue tasks', prompt: 'Show overdue tasks' },
  { label: 'Help', prompt: 'What can you do?' },
];
