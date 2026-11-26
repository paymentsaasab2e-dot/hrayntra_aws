/**
 * Pure parsing layer for Brain typed commands — no database imports so the
 * matcher and pending-resolution logic can be unit-tested without a tenant db.
 * The executor in ariaKnownCommands.js re-exports everything here.
 */

function clean(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

function cmd(text) {
  return clean(text).replace(/[.!?]+$/, '').toLowerCase();
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Accepts 2026-11-26, 26/11/2026, 26 Nov 2026, Nov 26 — returns YYYY-MM-DD or null. */
export function parseCommandDate(raw) {
  const t = cmd(raw);
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{4}))?$/);
  if (m && MONTHS[m[2].slice(0, 3)]) {
    const year = m[3] || String(new Date().getFullYear());
    return `${year}-${String(MONTHS[m[2].slice(0, 3)]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = t.match(/^([a-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if (m && MONTHS[m[1].slice(0, 3)]) {
    const year = m[3] || String(new Date().getFullYear());
    return `${year}-${String(MONTHS[m[1].slice(0, 3)]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

const DATE_RE = '(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{4}|\\d{1,2}\\s+[a-z]{3,9}(?:\\s+\\d{4})?|[a-z]{3,9}\\s+\\d{1,2}(?:,?\\s*\\d{4})?)';

/** First match wins. Anything not listed stays with the normal Brain question path. */
export function matchKnownPeopleCommand(text) {
  const raw = clean(text).replace(/[.!?]+$/, '');
  const t = raw.toLowerCase();
  if (!t) return null;

  if (/^(undo|undo that|take that back|reverse that)$/.test(t)) return { kind: 'undo' };
  if (/^(cancel|stop|no|never ?mind)$/.test(t)) return { kind: 'cancel' };
  const num = t.match(/^(\d{1,2})$/);
  if (num) return { kind: 'choice', n: Number(num[1]) };

  // --- Phase A: punch / leave / lock / payroll ---
  if (/^punch(\s+(now|in|attendance))?$/.test(t)) return { kind: 'punch', name: '' };
  const punch = t.match(/^(?:punch|clock|log)\s+(?:in\s+|attendance\s+|for\s+|employee\s+)*(.+)$/);
  if (punch) return { kind: 'punch', name: punch[1].trim() };

  let m = t.match(/^(approve|reject)\s+(?:the\s+)?(oldest|first|next)\s+leave$/);
  if (m) return { kind: 'leave', decision: m[1] === 'reject' ? 'REJECTED' : 'APPROVED', oldest: true };
  m = t.match(/^(approve|reject)\s+leave(?:\s+(?:for|of)\s+(.+)|\s+(.+))?$/);
  if (m) {
    return {
      kind: 'leave',
      decision: m[1] === 'reject' ? 'REJECTED' : 'APPROVED',
      name: (m[2] || m[3] || '').trim(),
    };
  }

  if (/^lock\s+(?:this\s+|the\s+)?(?:attendance\s+)?month$/.test(t) || t === 'lock attendance' || t === 'lock') {
    return { kind: 'lock' };
  }
  if (t === 'run payroll' || /^close\s+(?:this\s+|the\s+)?month$/.test(t)) return { kind: 'payroll' };
  m = t.match(/^(approve|lock)\s+payroll$/);
  if (m) return { kind: 'payroll-decide', decision: m[1] === 'lock' ? 'LOCKED' : 'APPROVED' };

  // --- Phase B: other People screen actions ---
  m = t.match(/^apply\s+leave\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+)$/);
  if (m) return { kind: 'apply-leave', blob: m[1].trim(), startDate: m[2].trim(), endDate: m[3].trim() };

  m = t.match(new RegExp(`^regularise\\s+(.+?)\\s+${DATE_RE}$`));
  if (m) return { kind: 'regularise', name: m[1].trim(), date: m[2].trim() };

  m = t.match(/^complete\s+onboarding\s+(.+)$/);
  if (m) return { kind: 'onboarding', blob: m[1].trim() };

  m = t.match(/^mark\s+(.+?)\s+(?:as\s+)?no[-\s]?show$/) || t.match(/^no[-\s]?show\s+(.+)$/);
  if (m) return { kind: 'noshow', name: m[1].trim() };
  m = t.match(/^mark\s+(.+?)\s+joined$/);
  if (m) return { kind: 'crm', action: 'mark_placement_joined', candidate: m[1].trim() };
  m = t.match(/^join\s+(.+)$/);
  if (m) return { kind: 'join', name: m[1].trim() };
  m = t.match(/^defer\s+(.+)$/);
  if (m) return { kind: 'defer', name: m[1].trim() };

  m = t.match(/^start\s+exit\s+(?:for\s+)?(.+)$/);
  if (m) return { kind: 'exit-start', name: m[1].trim() };
  m = t.match(/^complete\s+exit\s+(?:for\s+)?(.+)$/);
  if (m) return { kind: 'exit-complete', name: m[1].trim() };

  m = t.match(/^assign\s+asset\s+(.+?)\s+to\s+(.+)$/);
  if (m) return { kind: 'asset-assign', asset: m[1].trim(), name: m[2].trim() };
  m = t.match(/^return\s+asset\s+(.+)$/);
  if (m) return { kind: 'asset-return', asset: m[1].trim() };

  m = t.match(/^issue\s+letter\s+(.+?)\s+to\s+(.+)$/);
  if (m) return { kind: 'letter', letterType: m[1].trim(), name: m[2].trim() };

  m = t.match(/^(approve|reject)\s+inbox(?:\s+(.+))?$/);
  if (m) {
    return {
      kind: 'inbox',
      decision: m[1] === 'reject' ? 'REJECTED' : 'APPROVED',
      pick: (m[2] || '').trim(),
    };
  }

  // --- Phase C: CRM sentences -> approved workflow actions ---
  m = t.match(/^create\s+lead\s+(?:for\s+)?(.+)$/);
  if (m) return { kind: 'crm', action: 'create_lead', company: m[1].trim() };
  m = t.match(/^update\s+lead\s+(.+?)\s+status\s+(.+)$/);
  if (m) return { kind: 'crm', action: 'update_lead', company: m[1].trim(), status: m[2].trim() };
  m = t.match(/^convert\s+lead\s+(.+?)(?:\s+to\s+client)?$/);
  if (m) return { kind: 'crm', action: 'convert_lead_to_client', company: m[1].trim() };
  m = t.match(/^create\s+client\s+(?:for\s+)?(.+)$/);
  if (m) return { kind: 'crm', action: 'create_client', company: m[1].trim() };
  m = t.match(/^create\s+job\s+(.+?)\s+for\s+(.+)$/);
  if (m) return { kind: 'crm', action: 'create_job', title: m[1].trim(), client: m[2].trim() };
  m = t.match(/^move\s+(.+?)\s+to\s+(.+?)\s+on\s+(.+)$/);
  if (m) return { kind: 'crm', action: 'move_candidate_stage', candidate: m[1].trim(), stage: m[2].trim(), job: m[3].trim() };
  m = t.match(/^schedule\s+interview\s+(?:for\s+)?(.+)\s+on\s+(.+)$/);
  if (m) return { kind: 'crm', action: 'schedule_interview', blob: m[1].trim(), date: m[2].trim() };
  m = t.match(/^add\s+task\s+(.+?)\s+for\s+(.+)$/);
  if (m) return { kind: 'crm', action: 'create_task', title: m[1].trim(), assignee: m[2].trim() };
  m = t.match(/^complete\s+task\s+(.+)$/);
  if (m) return { kind: 'crm', action: 'complete_task', title: m[1].trim() };
  m = t.match(/^create\s+placement\s+(?:for\s+)?(.+?)\s+on\s+(.+)$/);
  if (m) return { kind: 'crm', action: 'create_placement', candidate: m[1].trim(), job: m[2].trim() };

  return null;
}

/** True when the match is a People-screen write (vs undo/cancel/choice/CRM). */
export function isPeopleCommand(match) {
  return Boolean(match) && !['undo', 'cancel', 'choice', 'crm'].includes(match.kind);
}

export function listReply(intro, options) {
  return `${intro}\n${options.map((o) => `${o.n}. ${o.label}`).join('\n')}`;
}

/**
 * Resolve a stored pendingCommand against the next user text.
 * Returns {type:'command',command} | {type:'cancel'} | {type:'fresh',command} | {type:'reprompt',text} | {type:'none'}.
 * Pure — the caller executes the command.
 */
export function resolvePendingReply(pending, text) {
  const t = cmd(text);
  const fresh = matchKnownPeopleCommand(text);
  if (fresh && fresh.kind === 'cancel') return { type: 'cancel' };
  if (fresh && !['choice', 'undo'].includes(fresh.kind)) return { type: 'fresh', command: fresh };

  if (!pending || typeof pending !== 'object') return { type: 'none' };

  if (pending.expects === 'choice' && Array.isArray(pending.options)) {
    const num = t.match(/^(\d{1,2})$/);
    if (num) {
      const opt = pending.options.find((o) => o.n === Number(num[1]));
      if (opt) return { type: 'command', command: opt.command };
      return { type: 'reprompt', text: `${pending.prompt}\n\nReply with a number from 1 to ${pending.options.length}, or say cancel.` };
    }
    const matches = pending.options.filter((o) => String(o.match || o.label || '').toLowerCase().includes(t));
    if (matches.length === 1) return { type: 'command', command: matches[0].command };
    if (matches.length > 1) {
      const prompt = listReply('That still matches more than one:', matches);
      return { type: 'reprompt', text: `${prompt}\n\nReply with a number, or say cancel.` };
    }
    return { type: 'reprompt', text: `${pending.prompt}\n\nReply with a number or a name, or say cancel.` };
  }

  if (pending.expects === 'field' && pending.field && pending.command) {
    if (!t) return { type: 'reprompt', text: pending.prompt };
    const command = { ...pending.command, [pending.field]: clean(text) };
    return { type: 'command', command };
  }

  if (pending.expects === 'confirm' && pending.command) {
    if (/^(yes|y|confirm|ok|okay|sure|do it|go ahead)$/.test(t)) {
      return { type: 'command', command: pending.command };
    }
    if (fresh) return { type: 'cancel' };
    return { type: 'reprompt', text: `${pending.prompt}\n\nReply yes to confirm, or cancel.` };
  }

  return { type: 'none' };
}
