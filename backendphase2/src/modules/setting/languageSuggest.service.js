import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from '../../services/llmChatFallback.service.js';

const HISTORY_SCAN_LIMIT = 300;
const AI_CACHE_MAX = 100;
const aiLanguageCache = new Map();
const aiProficiencyCache = new Map();

export const DEFAULT_LANGUAGES = [
  'English',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Mandarin Chinese',
  'Japanese',
  'Arabic',
  'Portuguese',
  'Russian',
  'Italian',
  'Korean',
  'Bengali',
  'Tamil',
  'Telugu',
  'Marathi',
  'Gujarati',
  'Kannada',
  'Malayalam',
  'Punjabi',
  'Dutch',
  'Turkish',
  'Vietnamese',
  'Thai',
  'Polish',
  'Swedish',
  'Urdu',
  'Filipino',
];

export const RECOMMENDED_LANGUAGES = ['English', 'Hindi', 'Spanish', 'French'];

export const DEFAULT_PROFICIENCIES = [
  'Basic',
  'Conversational',
  'Professional',
  'Native',
  'Fluent',
  'Intermediate',
  'Advanced',
  'Beginner',
];

export const RECOMMENDED_PROFICIENCIES = ['Conversational', 'Professional', 'Fluent', 'Native'];

function normalizeLabel(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function uniqueLabelsCaseInsensitive(labels) {
  const seen = new Set();
  const out = [];
  for (const label of labels) {
    const norm = normalizeLabel(label);
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

function parseLanguageRows(raw) {
  if (!raw) return [];
  const rows = Array.isArray(raw) ? raw : [];
  const languages = [];
  const proficiencies = [];
  for (const row of rows) {
    if (typeof row === 'string') {
      const norm = normalizeLabel(row);
      if (norm) languages.push(norm);
      continue;
    }
    if (row && typeof row === 'object') {
      const lang = normalizeLabel(row.language ?? row.name ?? row.label);
      const prof = normalizeLabel(row.proficiency ?? row.level);
      if (lang) languages.push(lang);
      if (prof) proficiencies.push(prof);
    }
  }
  return { languages, proficiencies };
}

async function collectUsedLanguageLabels() {
  const [jobs, candidates] = await Promise.all([
    prisma.job.findMany({
      where: { languages: { not: null } },
      select: { languages: true },
      take: HISTORY_SCAN_LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.candidate.findMany({
      where: { languages: { isEmpty: false } },
      select: { languages: true, languagesDetail: true },
      take: HISTORY_SCAN_LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const labels = [];
  for (const row of jobs) {
    labels.push(...parseLanguageRows(row.languages).languages);
  }
  for (const row of candidates) {
    if (Array.isArray(row.languages)) {
      for (const lang of row.languages) {
        const norm = normalizeLabel(lang);
        if (norm) labels.push(norm);
      }
    }
    labels.push(...parseLanguageRows(row.languagesDetail).languages);
  }
  return uniqueLabelsCaseInsensitive(labels);
}

async function collectUsedProficiencyLabels(language = '') {
  const jobs = await prisma.job.findMany({
    where: { languages: { not: null } },
    select: { languages: true },
    take: HISTORY_SCAN_LIMIT,
    orderBy: { updatedAt: 'desc' },
  });

  const labels = [];
  const langKey = normalizeLabel(language).toLowerCase();
  for (const row of jobs) {
    const rows = Array.isArray(row.languages) ? row.languages : [];
    for (const item of rows) {
      if (!item || typeof item !== 'object') continue;
      const lang = normalizeLabel(item.language ?? item.name);
      const prof = normalizeLabel(item.proficiency ?? item.level);
      if (!prof) continue;
      if (!langKey || lang.toLowerCase() === langKey) labels.push(prof);
    }
  }
  return uniqueLabelsCaseInsensitive(labels);
}

async function aiSuggestLanguages(query, selected, jobTitle, limit) {
  const cacheKey = `${query.toLowerCase()}|${selected.join(',')}|${jobTitle}|${limit}`;
  const cached = aiLanguageCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
    return cached.labels;
  }

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 120,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Suggest human language names for a job posting. Return JSON only: {"suggestions":["..."]}. Use standard English names (e.g. "English", "Hindi", "Mandarin Chinese"). No proficiency levels. No duplicates. No markdown.',
        },
        {
          role: 'user',
          content: [
            `Search: "${query}"`,
            jobTitle ? `Job title: ${jobTitle}` : '',
            selected.length ? `Exclude: ${selected.join('; ')}` : '',
            `Return up to ${limit} language names.`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    },
    'language-suggest',
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

  const labels = uniqueLabelsCaseInsensitive(
    parsed.map((s) => normalizeLabel(s)).filter(Boolean),
  ).slice(0, limit);

  if (aiLanguageCache.size >= AI_CACHE_MAX) {
    aiLanguageCache.delete(aiLanguageCache.keys().next().value);
  }
  aiLanguageCache.set(cacheKey, { at: Date.now(), labels });
  return labels;
}

async function aiSuggestProficiencies(query, selected, language, limit) {
  const cacheKey = `${query.toLowerCase()}|${selected.join(',')}|${language}|${limit}`;
  const cached = aiProficiencyCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
    return cached.labels;
  }

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 80,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Suggest language proficiency levels for a job posting. Return JSON only: {"suggestions":["..."]}. Short labels only (e.g. "Fluent", "Professional", "B2", "Native"). No duplicates. No markdown.',
        },
        {
          role: 'user',
          content: [
            `Search: "${query}"`,
            language ? `Language: ${language}` : '',
            selected.length ? `Exclude: ${selected.join('; ')}` : '',
            `Return up to ${limit} proficiency labels.`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    },
    'proficiency-suggest',
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

  const labels = uniqueLabelsCaseInsensitive(
    parsed.map((s) => normalizeLabel(s)).filter(Boolean),
  ).slice(0, limit);

  if (aiProficiencyCache.size >= AI_CACHE_MAX) {
    aiProficiencyCache.delete(aiProficiencyCache.keys().next().value);
  }
  aiProficiencyCache.set(cacheKey, { at: Date.now(), labels });
  return labels;
}

function buildSuggestions({
  query,
  selected,
  limit,
  usedLabels,
  defaults,
  recommended,
  aiFetcher,
  jobTitle = '',
  language = '',
}) {
  const q = normalizeLabel(query);
  const exclude = new Set(
    (Array.isArray(selected) ? selected : String(selected || '').split(/[;,]/))
      .map((s) => normalizeLabel(s).toLowerCase())
      .filter(Boolean),
  );
  const cap = Math.min(Math.max(Number(limit) || 8, 1), 12);
  const rows = [];
  const seen = new Set();

  const push = (label, source, rank = 0) => {
    const norm = normalizeLabel(label);
    if (!norm) return;
    const key = norm.toLowerCase();
    if (exclude.has(key) || seen.has(key)) return;
    seen.add(key);
    rows.push({ label: norm, source, rank });
  };

  if (!q) {
    for (const label of recommended) push(label, 'catalog', 90);
    for (const label of usedLabels.slice(0, 10)) push(label, 'history', 85);
  } else {
    for (const label of usedLabels) {
      const rank = scoreMatch(label, q);
      if (rank > 0) push(label, 'history', rank + 20);
    }
    for (const label of defaults) {
      const rank = scoreMatch(label, q);
      if (rank > 0) push(label, 'catalog', rank);
    }
  }

  rows.sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  return { rows, cap, q, exclude, seen };
}

export async function suggestLanguageOptions({
  query = '',
  selected = [],
  limit = 8,
  jobTitle = '',
} = {}) {
  const usedLabels = await collectUsedLanguageLabels();
  const { rows, cap, q } = buildSuggestions({
    query,
    selected,
    limit,
    usedLabels,
    defaults: DEFAULT_LANGUAGES,
    recommended: RECOMMENDED_LANGUAGES,
  });

  const aiEnabled = hasLlmProvider();
  if (aiEnabled && q.length >= 2 && rows.length < cap) {
    try {
      const selectedLabels = (Array.isArray(selected) ? selected : [])
        .map((s) => normalizeLabel(s))
        .filter(Boolean);
      const aiLabels = await aiSuggestLanguages(
        q,
        selectedLabels,
        normalizeLabel(jobTitle),
        cap - rows.length,
      );
      for (const label of aiLabels) {
        const norm = normalizeLabel(label);
        if (!norm) continue;
        const key = norm.toLowerCase();
        if (rows.some((r) => r.label.toLowerCase() === key)) continue;
        rows.push({ label: norm, source: 'ai', rank: 55 });
      }
    } catch (err) {
      console.warn('[language-suggest] AI fallback skipped:', err?.message || err);
    }
  }

  rows.sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  return {
    suggestions: rows.slice(0, cap).map(({ label, source }) => ({ label, source })),
    aiEnabled,
  };
}

export async function suggestProficiencyOptions({
  query = '',
  selected = [],
  limit = 8,
  language = '',
} = {}) {
  const usedLabels = await collectUsedProficiencyLabels(language);
  const { rows, cap, q } = buildSuggestions({
    query,
    selected,
    limit,
    usedLabels,
    defaults: DEFAULT_PROFICIENCIES,
    recommended: RECOMMENDED_PROFICIENCIES,
  });

  const aiEnabled = hasLlmProvider();
  if (aiEnabled && q.length >= 2 && rows.length < cap) {
    try {
      const selectedLabels = (Array.isArray(selected) ? selected : [])
        .map((s) => normalizeLabel(s))
        .filter(Boolean);
      const aiLabels = await aiSuggestProficiencies(
        q,
        selectedLabels,
        normalizeLabel(language),
        cap - rows.length,
      );
      for (const label of aiLabels) {
        const norm = normalizeLabel(label);
        if (!norm) continue;
        const key = norm.toLowerCase();
        if (rows.some((r) => r.label.toLowerCase() === key)) continue;
        rows.push({ label: norm, source: 'ai', rank: 55 });
      }
    } catch (err) {
      console.warn('[proficiency-suggest] AI fallback skipped:', err?.message || err);
    }
  }

  rows.sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  return {
    suggestions: rows.slice(0, cap).map(({ label, source }) => ({ label, source })),
    aiEnabled,
  };
}
