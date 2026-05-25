import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from '../../services/llmChatFallback.service.js';
import {
  DEFAULT_COMPANY_SERVICES,
  RECOMMENDED_COMPANY_SERVICES,
  getOrgCustomCompanyServices,
  normalizeServiceLabel,
  uniqueServicesCaseInsensitive,
} from './recruitmentMode.service.js';

const HISTORY_SCAN_LIMIT = 400;
const AI_CACHE_MAX = 120;
const aiSuggestCache = new Map();

function parseServiceField(raw) {
  if (!raw?.trim()) return [];
  return uniqueServicesCaseInsensitive(String(raw).split(/[;,]/));
}

function scoreMatch(label, query) {
  const q = query.trim().toLowerCase();
  const hay = label.toLowerCase();
  if (!q) return 1;
  if (hay === q) return 100;
  if (hay.startsWith(q)) return 80;
  if (hay.includes(q)) return 60;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.every((w) => hay.includes(w))) return 50;
  return 0;
}

/** Distinct service labels already used on leads/clients in this tenant. */
export async function collectUsedServiceLabels() {
  const [leads, clients] = await Promise.all([
    prisma.lead.findMany({
      where: {
        OR: [{ servicesNeeded: { not: null } }, { interestedNeeds: { not: null } }],
      },
      select: { servicesNeeded: true, interestedNeeds: true },
      take: HISTORY_SCAN_LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.client.findMany({
      where: { servicesNeeded: { not: null } },
      select: { servicesNeeded: true },
      take: HISTORY_SCAN_LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const labels = [];
  for (const row of leads) {
    labels.push(...parseServiceField(row.servicesNeeded));
    labels.push(...parseServiceField(row.interestedNeeds));
  }
  for (const row of clients) {
    labels.push(...parseServiceField(row.servicesNeeded));
  }
  return uniqueServicesCaseInsensitive(labels);
}

async function aiSuggestServices(query, selected, industry, limit) {
  const cacheKey = `${query.toLowerCase()}|${selected.join(',')}|${industry}|${limit}`;
  const cached = aiSuggestCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
    return cached.labels;
  }

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You suggest recruitment-agency service names for a CRM "Services Needed" field. Return JSON only: {"suggestions":["..."]}. Each label is 2–6 words, professional (e.g. "IT & Software Recruitment", "Executive Search", "Contract Staffing"). No duplicates. No markdown.',
        },
        {
          role: 'user',
          content: [
            `Search query: "${query}"`,
            industry ? `Client industry context: ${industry}` : '',
            selected.length ? `Already selected (exclude): ${selected.join('; ')}` : '',
            `Return up to ${limit} relevant recruitment/staffing service labels.`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    },
    'company-services-suggest',
    { quiet: true }
  );

  const raw = completion.choices?.[0]?.message?.content?.trim();
  let parsed = [];
  try {
    const json = raw ? JSON.parse(raw) : {};
    parsed = Array.isArray(json?.suggestions) ? json.suggestions : [];
  } catch {
    parsed = [];
  }

  const labels = uniqueServicesCaseInsensitive(
    parsed.map((s) => normalizeServiceLabel(s)).filter(Boolean)
  ).slice(0, limit);

  if (aiSuggestCache.size >= AI_CACHE_MAX) {
    const first = aiSuggestCache.keys().next().value;
    aiSuggestCache.delete(first);
  }
  aiSuggestCache.set(cacheKey, { at: Date.now(), labels });
  return labels;
}

/**
 * Typeahead suggestions: tenant history → org catalog → defaults → AI (OPENAI_API_KEY).
 * Scales to large catalogs without sending the full list to the browser.
 */
export async function suggestCompanyServicesOptions({
  query = '',
  selected = [],
  limit = 8,
  industry = '',
} = {}) {
  const q = normalizeServiceLabel(query);
  const exclude = new Set(
    (Array.isArray(selected) ? selected : String(selected || '').split(/[;,]/))
      .map((s) => normalizeServiceLabel(s).toLowerCase())
      .filter(Boolean)
  );
  const cap = Math.min(Math.max(Number(limit) || 8, 1), 15);
  const rows = [];
  const seen = new Set();

  const push = (label, source, rank = 0) => {
    const norm = normalizeServiceLabel(label);
    if (!norm) return;
    const key = norm.toLowerCase();
    if (exclude.has(key) || seen.has(key)) return;
    seen.add(key);
    rows.push({ label: norm, source, rank });
  };

  const usedLabels = await collectUsedServiceLabels();
  const custom = await getOrgCustomCompanyServices();
  const seedCatalog = uniqueServicesCaseInsensitive([
    ...RECOMMENDED_COMPANY_SERVICES,
    ...DEFAULT_COMPANY_SERVICES,
    ...custom,
  ]);

  if (!q) {
    for (const label of RECOMMENDED_COMPANY_SERVICES) push(label, 'catalog', 90);
    for (const label of usedLabels.slice(0, 12)) push(label, 'history', 85);
    for (const label of custom.slice(0, 8)) push(label, 'catalog', 70);
  } else {
    for (const label of usedLabels) {
      const rank = scoreMatch(label, q);
      if (rank > 0) push(label, 'history', rank + 20);
    }
    for (const label of custom) {
      const rank = scoreMatch(label, q);
      if (rank > 0) push(label, 'catalog', rank + 10);
    }
    for (const label of seedCatalog) {
      if (custom.some((c) => c.toLowerCase() === label.toLowerCase())) continue;
      const rank = scoreMatch(label, q);
      if (rank > 0) push(label, 'catalog', rank);
    }
  }

  rows.sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  const aiEnabled = hasLlmProvider();
  if (aiEnabled && q.length >= 2 && rows.length < cap) {
    try {
      const selectedLabels = (Array.isArray(selected) ? selected : [])
        .map((s) => normalizeServiceLabel(s))
        .filter(Boolean);
      const aiLabels = await aiSuggestServices(
        q,
        selectedLabels,
        industry,
        cap - rows.length
      );
      for (const label of aiLabels) push(label, 'ai', 55);
    } catch (err) {
      console.warn('[company-services-suggest] AI fallback skipped:', err?.message || err);
    }
  }

  rows.sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  return {
    suggestions: rows.slice(0, cap).map(({ label, source }) => ({ label, source })),
    aiEnabled,
  };
}
