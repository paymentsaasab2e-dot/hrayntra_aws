/**
 * Proxy to Phase 1 Help-page tickets (`/api/hq-tickets` on job portal frontend).
 * Source of truth: jobportal_himanshu/data/hq-analytics.json (see HQ_HELP_TICKETS_API.md).
 */

function phase1FrontendBase() {
  return String(
    process.env.PHASE1_FRONTEND_URL ||
      process.env.JOB_PORTAL_FRONTEND_URL ||
      process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL ||
      'http://localhost:3000',
  )
    .trim()
    .replace(/\/+$/, '');
}

const VALID_STATUSES = new Set(['open', 'in_progress', 'closed']);

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error || json?.message || `Phase 1 tickets HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function buildStats(tickets) {
  const list = Array.isArray(tickets) ? tickets : [];
  return {
    total: list.length,
    open: list.filter((t) => t.status === 'open').length,
    inProgress: list.filter((t) => t.status === 'in_progress').length,
    closed: list.filter((t) => t.status === 'closed').length,
  };
}

export const hqHelpTicketsService = {
  async listTickets(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.status && VALID_STATUSES.has(String(filters.status))) {
      qs.set('status', String(filters.status));
    }
    if (filters.email) qs.set('email', String(filters.email).trim().toLowerCase());
    if (filters.id) qs.set('id', String(filters.id).trim());
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 100));
    qs.set('limit', String(limit));

    const url = `${phase1FrontendBase()}/api/hq-tickets?${qs.toString()}`;
    const json = await fetchJson(url);

    if (filters.id) {
      const one = json?.data || null;
      return {
        tickets: one ? [one] : [],
        stats: buildStats(one ? [one] : []),
        openCount: one?.status === 'open' ? 1 : 0,
        source: 'phase1_help_page',
        phase1Url: url,
      };
    }

    const data = json?.data || {};
    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    return {
      tickets,
      stats: buildStats(tickets),
      openCount: Number(data.openCount) || tickets.filter((t) => t.status === 'open').length,
      count: Number(data.count) || tickets.length,
      note: data.note || null,
      source: 'phase1_help_page',
      phase1Url: `${phase1FrontendBase()}/api/hq-tickets`,
    };
  },

  async updateTicketStatus(id, status) {
    const ticketId = String(id || '').trim();
    const next = String(status || '').trim().toLowerCase();
    if (!ticketId) throw new Error('Ticket id is required');
    if (!VALID_STATUSES.has(next)) {
      throw new Error('status must be open, in_progress, or closed');
    }

    const url = `${phase1FrontendBase()}/api/hq-tickets`;
    const json = await fetchJson(url, {
      method: 'PATCH',
      body: JSON.stringify({ id: ticketId, status: next }),
    });
    return json?.data || null;
  },
};
