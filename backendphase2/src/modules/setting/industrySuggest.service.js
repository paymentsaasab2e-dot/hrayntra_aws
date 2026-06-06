import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from '../../services/llmChatFallback.service.js';

const HISTORY_SCAN_LIMIT = 300;
const AI_CACHE_MAX = 100;
const aiSuggestCache = new Map();

export const DEFAULT_INDUSTRIES = [
  'Information Technology',
  'Software & SaaS',
  'Healthcare',
  'Pharmaceuticals',
  'Financial Services',
  'Banking',
  'Insurance',
  'Manufacturing',
  'Retail',
  'E-commerce',
  'Education',
  'Real Estate',
  'Telecommunications',
  'Automotive',
  'Energy & Utilities',
  'Logistics & Supply Chain',
  'Hospitality & Tourism',
  'Media & Entertainment',
  'Construction',
  'Agriculture',
  'Government & Public Sector',
  'Consulting & Professional Services',
];

export const RECOMMENDED_INDUSTRIES = [
  'Information Technology',
  'Healthcare',
  'Financial Services',
  'Manufacturing',
];

function normalizeIndustryLabel(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function uniqueIndustriesCaseInsensitive(labels) {
  const seen = new Set();
  const out = [];
  for (const label of labels) {
    const norm = normalizeIndustryLabel(label);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
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

async function collectUsedIndustryLabels() {
  const [leads, clients] = await Promise.all([
    prisma.lead.findMany({
      where: { industry: { not: null } },
      select: { industry: true },
      take: HISTORY_SCAN_LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.client.findMany({
      where: { industry: { not: null } },
      select: { industry: true },
      take: HISTORY_SCAN_LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const labels = [];
  const pushField = (raw) => {
    for (const part of String(raw || '').split(/[;,]/)) {
      const norm = normalizeIndustryLabel(part);
      if (norm) labels.push(norm);
    }
  };
  for (const row of leads) pushField(row.industry);
  for (const row of clients) pushField(row.industry);
  return uniqueIndustriesCaseInsensitive(labels);
}

async function aiSuggestIndustries(query, selected, companyName, limit) {
  const cacheKey = `${query.toLowerCase()}|${selected.join(',')}|${companyName}|${limit}`;
  const cached = aiSuggestCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
    return cached.labels;
  }

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 180,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Suggest industry sector names for a CRM client record. Return JSON only: {"suggestions":["..."]}. Each label is 1–4 words (e.g. "Information Technology", "Healthcare"). No duplicates. No markdown.',
        },
        {
          role: 'user',
          content: [
            `Search: "${query}"`,
            companyName ? `Company: ${companyName}` : '',
            selected.length ? `Exclude: ${selected.join('; ')}` : '',
            `Return up to ${limit} industry labels.`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    },
    'industry-suggest',
    { quiet: true },
  );

  const raw = completion.choices?.[0]?.message?.content?.trim();
  let parsed = [];
  try {
    const json = raw ? JSON.parse(raw) : {};
    parsed = Array.isArray(json?.suggestions) ? json.suggestions : [];
  } catch {
    parsed = [];
  }

  const labels = uniqueIndustriesCaseInsensitive(
    parsed.map((s) => normalizeIndustryLabel(s)).filter(Boolean),
  ).slice(0, limit);

  if (aiSuggestCache.size >= AI_CACHE_MAX) {
    const first = aiSuggestCache.keys().next().value;
    aiSuggestCache.delete(first);
  }
  aiSuggestCache.set(cacheKey, { at: Date.now(), labels });
  return labels;
}

/** Typeahead: tenant history → default catalog → AI (only when local matches are sparse). */
export async function suggestIndustryOptions({
  query = '',
  selected = [],
  limit = 8,
  companyName = '',
} = {}) {
  const q = normalizeIndustryLabel(query);
  const exclude = new Set(
    (Array.isArray(selected) ? selected : String(selected || '').split(/[;,]/))
      .map((s) => normalizeIndustryLabel(s).toLowerCase())
      .filter(Boolean),
  );
  const cap = Math.min(Math.max(Number(limit) || 8, 1), 12);
  const rows = [];
  const seen = new Set();

  const push = (label, source, rank = 0) => {
    const norm = normalizeIndustryLabel(label);
    if (!norm) return;
    const key = norm.toLowerCase();
    if (exclude.has(key) || seen.has(key)) return;
    seen.add(key);
    rows.push({ label: norm, source, rank });
  };

  const usedLabels = await collectUsedIndustryLabels();

  if (!q) {
    for (const label of RECOMMENDED_INDUSTRIES) push(label, 'catalog', 90);
    for (const label of usedLabels.slice(0, 10)) push(label, 'history', 85);
  } else {
    for (const label of usedLabels) {
      const rank = scoreMatch(label, q);
      if (rank > 0) push(label, 'history', rank + 20);
    }
    for (const label of DEFAULT_INDUSTRIES) {
      const rank = scoreMatch(label, q);
      if (rank > 0) push(label, 'catalog', rank);
    }
  }

  rows.sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  const aiEnabled = hasLlmProvider();
  if (aiEnabled && q.length >= 2 && rows.length < cap) {
    try {
      const selectedLabels = (Array.isArray(selected) ? selected : [])
        .map((s) => normalizeIndustryLabel(s))
        .filter(Boolean);
      const aiLabels = await aiSuggestIndustries(
        q,
        selectedLabels,
        normalizeIndustryLabel(companyName),
        cap - rows.length,
      );
      for (const label of aiLabels) push(label, 'ai', 55);
    } catch (err) {
      console.warn('[industry-suggest] AI fallback skipped:', err?.message || err);
    }
  }

  rows.sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  return {
    suggestions: rows.slice(0, cap).map(({ label, source }) => ({ label, source })),
    aiEnabled,
  };
}
