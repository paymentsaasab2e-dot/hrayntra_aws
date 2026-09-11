/**
 * Submit-to-Client email templates (Settings → Public Visibility).
 * Used when opening Gmail / Outlook compose after sharing a preview link.
 */

export type SubmitToClientMailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  /** When true, this template is used by default for compose. */
  isDefault?: boolean;
  updatedAt: string;
};

export type SubmitToClientMailTemplateVars = {
  candidateName?: string;
  candidateNames?: string;
  jobTitle?: string;
  reviewUrl?: string;
  clientEmail?: string;
  clientName?: string;
  companyName?: string;
};

export const SUBMIT_TO_CLIENT_MAIL_TEMPLATE_PLACEHOLDERS = [
  { key: 'candidateName', label: 'First candidate name', sample: 'Priya Sharma' },
  { key: 'candidateNames', label: 'All candidate names', sample: 'Priya Sharma and 2 more candidates' },
  { key: 'jobTitle', label: 'Job title', sample: 'Frontend Developer' },
  { key: 'reviewUrl', label: 'Preview link', sample: 'https://…/client-review/…' },
  { key: 'clientEmail', label: 'Client email', sample: 'director@acme.com' },
  { key: 'clientName', label: 'Client / company name', sample: 'Acme Corp' },
  { key: 'companyName', label: 'Company name (alias)', sample: 'Acme Corp' },
] as const;

const STORAGE_PREFIX = 'submitToClientMailTemplates';
export const SUBMIT_TO_CLIENT_MAIL_TEMPLATES_CHANGED_EVENT =
  'hrayntra:submit-to-client-mail-templates-changed';

function currentUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const parsed = JSON.parse(localStorage.getItem('currentUser') || '{}') as { id?: string };
    return String(parsed?.id || '').trim();
  } catch {
    return '';
  }
}

function tenantKey(): string {
  if (typeof window === 'undefined') return 'default';
  return String(localStorage.getItem('tenantDbName') || 'default').trim() || 'default';
}

function storageKey(): string {
  const user = currentUserId() || 'anon';
  return `${STORAGE_PREFIX}:${tenantKey()}:${user}`;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `stc-mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultSubmitToClientMailTemplate(): SubmitToClientMailTemplate {
  return {
    id: 'default',
    name: 'Default client email',
    subject: 'Candidate review: {{candidateNames}} — {{jobTitle}}',
    body: [
      'Hi,',
      '',
      'Please review {{candidateNames}} for {{jobTitle}}.',
      '',
      'Open this secure preview link to see the profile:',
      '{{reviewUrl}}',
      '',
      'This preview includes only the fields marked Visible in Submit to Client settings.',
      '',
      'Thank you,',
    ].join('\n'),
    isDefault: true,
    updatedAt: new Date().toISOString(),
  };
}

/** Lightweight conditional: {{#jobTitle}}…{{/jobTitle}} keeps block only when jobTitle is set. */
function applyConditionals(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_full, key: string, inner: string) => {
    const value = String(vars[key] || '').trim();
    return value ? inner : '';
  });
}

export function applySubmitToClientMailTemplate(
  template: Pick<SubmitToClientMailTemplate, 'subject' | 'body'> | null | undefined,
  vars: SubmitToClientMailTemplateVars,
): { subject: string; body: string } {
  const map: Record<string, string> = {
    candidateName: String(vars.candidateName || '').trim(),
    candidateNames: String(vars.candidateNames || vars.candidateName || '').trim(),
    jobTitle: String(vars.jobTitle || '').trim(),
    reviewUrl: String(vars.reviewUrl || '').trim(),
    clientEmail: String(vars.clientEmail || '').trim(),
    clientName: String(vars.clientName || vars.companyName || '').trim(),
    companyName: String(vars.companyName || vars.clientName || '').trim(),
  };

  const source = template || defaultSubmitToClientMailTemplate();
  let subject = applyConditionals(String(source.subject || ''), map);
  let body = applyConditionals(String(source.body || ''), map);

  for (const [key, value] of Object.entries(map)) {
    const token = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    subject = subject.replace(token, value);
    body = body.replace(token, value);
  }

  // Drop leftover unknown tokens.
  subject = subject.replace(/\{\{[^}]+\}\}/g, '').replace(/\s{2,}/g, ' ').trim();
  body = body.replace(/\{\{[^}]+\}\}/g, '');

  return { subject, body };
}

function normalizeTemplate(raw: unknown): SubmitToClientMailTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id || '').trim() || newId();
  const name = String(row.name || '').trim() || 'Untitled template';
  const subject = String(row.subject || '').trim();
  const body = String(row.body || '').trim();
  if (!subject && !body) return null;
  return {
    id,
    name,
    subject: subject || 'Candidate review',
    body: body || '{{reviewUrl}}',
    isDefault: row.isDefault === true,
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  };
}

export function listSubmitToClientMailTemplates(): SubmitToClientMailTemplate[] {
  if (typeof window === 'undefined') return [defaultSubmitToClientMailTemplate()];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [defaultSubmitToClientMailTemplate()];
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { templates?: unknown })?.templates)
        ? (parsed as { templates: unknown[] }).templates
        : [];
    const normalized = list.map(normalizeTemplate).filter(Boolean) as SubmitToClientMailTemplate[];
    if (!normalized.length) return [defaultSubmitToClientMailTemplate()];
    // Ensure exactly one default.
    if (!normalized.some((t) => t.isDefault)) {
      normalized[0] = { ...normalized[0]!, isDefault: true };
    }
    return normalized;
  } catch {
    return [defaultSubmitToClientMailTemplate()];
  }
}

export function getDefaultSubmitToClientMailTemplate(
  templates?: SubmitToClientMailTemplate[],
): SubmitToClientMailTemplate {
  const list = templates || listSubmitToClientMailTemplates();
  return list.find((t) => t.isDefault) || list[0] || defaultSubmitToClientMailTemplate();
}

export function saveSubmitToClientMailTemplates(templates: SubmitToClientMailTemplate[]): SubmitToClientMailTemplate[] {
  const cleaned = templates
    .map(normalizeTemplate)
    .filter(Boolean) as SubmitToClientMailTemplate[];
  let next = cleaned.length ? cleaned : [defaultSubmitToClientMailTemplate()];
  const defaultCount = next.filter((t) => t.isDefault).length;
  if (defaultCount === 0) {
    next = next.map((t, i) => ({ ...t, isDefault: i === 0 }));
  } else if (defaultCount > 1) {
    let seen = false;
    next = next.map((t) => {
      if (!t.isDefault) return t;
      if (seen) return { ...t, isDefault: false };
      seen = true;
      return t;
    });
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey(), JSON.stringify({ templates: next, updatedAt: new Date().toISOString() }));
    window.dispatchEvent(
      new CustomEvent(SUBMIT_TO_CLIENT_MAIL_TEMPLATES_CHANGED_EVENT, { detail: next }),
    );
  }
  return next;
}

export function upsertSubmitToClientMailTemplate(
  input: Partial<SubmitToClientMailTemplate> & { name: string; subject: string; body: string },
): { templates: SubmitToClientMailTemplate[]; saved: SubmitToClientMailTemplate } {
  const list = listSubmitToClientMailTemplates();
  const id = String(input.id || '').trim() || newId();
  const existingIndex = list.findIndex((t) => t.id === id);
  const row: SubmitToClientMailTemplate = {
    id,
    name: String(input.name || '').trim() || 'Untitled template',
    subject: String(input.subject || '').trim() || 'Candidate review',
    body: String(input.body || '').trim() || '{{reviewUrl}}',
    isDefault: input.isDefault === true,
    updatedAt: new Date().toISOString(),
  };
  let next =
    existingIndex >= 0
      ? list.map((t, i) => (i === existingIndex ? { ...t, ...row } : t))
      : [...list, row];
  if (row.isDefault) {
    next = next.map((t) => ({ ...t, isDefault: t.id === row.id }));
  }
  const templates = saveSubmitToClientMailTemplates(next);
  const saved = templates.find((t) => t.id === row.id) || row;
  return { templates, saved };
}

export function deleteSubmitToClientMailTemplate(id: string): SubmitToClientMailTemplate[] {
  const list = listSubmitToClientMailTemplates().filter((t) => t.id !== id);
  return saveSubmitToClientMailTemplates(list.length ? list : [defaultSubmitToClientMailTemplate()]);
}

export function setDefaultSubmitToClientMailTemplate(id: string): SubmitToClientMailTemplate[] {
  const list = listSubmitToClientMailTemplates().map((t) => ({
    ...t,
    isDefault: t.id === id,
  }));
  return saveSubmitToClientMailTemplates(list);
}

export function subscribeSubmitToClientMailTemplatesChanged(
  listener: (templates: SubmitToClientMailTemplate[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<SubmitToClientMailTemplate[]>).detail;
    if (Array.isArray(detail)) listener(detail);
    else listener(listSubmitToClientMailTemplates());
  };
  window.addEventListener(SUBMIT_TO_CLIENT_MAIL_TEMPLATES_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SUBMIT_TO_CLIENT_MAIL_TEMPLATES_CHANGED_EVENT, handler);
}
